/**
 * importService.js — turns user input (file pickers, folder pickers, drag and
 * drop, or the optional Node backend) into stored library projects.
 *
 * The pipeline is:  collect Files → skip duplicates → parse (JSZip) →
 * render thumbnail → write to IndexedDB, with a small concurrency pool and a
 * progress callback so importing thousands of files keeps the UI responsive.
 */
import { parseSb3 } from './sb3Parser.js';
import { addProject } from '../db/database.js';
import { uid, baseName, nextFrame } from '../utils/format.js';

const CONCURRENCY = 4;
const isSb3 = (name) => /\.sb3$/i.test(name);

/** A stable fingerprint used to detect re-imports of the same file. */
export const fingerprintOf = (file) => `${file.name}|${file.size}|${file.lastModified || 0}`;

/* ------------------------------------------------------------------ */
/* Collecting files                                                    */
/* ------------------------------------------------------------------ */

/** Filter a FileList / array down to .sb3 files. */
export const filterSb3 = (files) => Array.from(files || []).filter((f) => isSb3(f.name));

/**
 * Collect .sb3 files from a drag-and-drop DataTransfer, walking any dropped
 * folders recursively (webkitGetAsEntry is supported by all modern browsers).
 * Each returned File gets a `relativePath` so folder structure can be kept.
 */
export async function filesFromDataTransfer(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  const entries = items.map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null)).filter(Boolean);
  if (!entries.length) return filterSb3(dataTransfer.files);

  const out = [];
  const walk = async (entry, path) => {
    if (entry.isFile) {
      if (!isSb3(entry.name)) return;
      const file = await new Promise((res, rej) => entry.file(res, rej));
      file.relativePath = path ? `${path}/${file.name}` : file.name;
      out.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries returns results in batches; keep reading until empty.
      let batch;
      do {
        batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        for (const child of batch) await walk(child, path ? `${path}/${entry.name}` : entry.name);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

/** Files chosen via <input webkitdirectory> already carry webkitRelativePath. */
export function filesFromDirectoryInput(fileList) {
  return filterSb3(fileList).map((f) => {
    f.relativePath = f.webkitRelativePath || f.name;
    return f;
  });
}

/** True when the File System Access API directory picker can be used here. */
export const canUseDirectoryPicker = () => typeof window.showDirectoryPicker === 'function' && window.self === window.top;

/**
 * Use the File System Access API to pick a folder and read every .sb3 in it
 * (recursively). Throws AbortError if the user cancels.
 */
export async function filesFromDirectoryPicker() {
  const root = await window.showDirectoryPicker({ mode: 'read' });
  const out = [];
  const walk = async (dir, path) => {
    for await (const handle of dir.values()) {
      if (handle.kind === 'file' && isSb3(handle.name)) {
        const file = await handle.getFile();
        file.relativePath = `${path}/${handle.name}`;
        out.push(file);
      } else if (handle.kind === 'directory') {
        await walk(handle, `${path}/${handle.name}`);
      }
    }
  };
  await walk(root, root.name);
  return out;
}

/* ------------------------------------------------------------------ */
/* Optional Node backend (see /server)                                 */
/* ------------------------------------------------------------------ */

/** Returns server info when the optional Node backend is reachable. */
export async function detectServer() {
  // Hosted inside claude.ai (or opened from a file) there is no backend to find.
  if (window.claude || !/^https?:$/.test(location.protocol)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('/api/health', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.app === 'sb3-library-manager' ? json : null;
  } catch {
    return null;
  }
}

/** List .sb3 files in the server's configured library directory. */
export async function listServerFiles() {
  const res = await fetch('/api/library');
  if (!res.ok) throw new Error(`The server could not list its library folder (HTTP ${res.status}).`);
  return (await res.json()).files; // [{ path, name, size, mtime }]
}

/** Download the chosen server files as File objects ready for import. */
export async function filesFromServer(entries, onProgress) {
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const res = await fetch(`/api/library/file?path=${encodeURIComponent(e.path)}`);
    if (!res.ok) continue;
    const blob = await res.blob();
    const file = new File([blob], e.name, { lastModified: e.mtime });
    file.relativePath = e.path;
    out.push(file);
    onProgress?.(i + 1, entries.length);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Import pipeline                                                     */
/* ------------------------------------------------------------------ */

/**
 * Import files into the library.
 *
 * @param {File[]} files
 * @param {object} opts
 * @param {Set<string>} opts.existingFingerprints  skip files already imported
 * @param {(folderPath:string[]) => Promise<string|null>} [opts.resolveFolder]
 *        maps a file's sub-folder path to a library folder id (keeps structure)
 * @param {string|null} [opts.targetFolderId]  folder for files with no sub-path
 * @param {(p:{done:number,total:number,current:string}) => void} [opts.onProgress]
 * @param {(meta:object) => void} [opts.onProject]  called after each import
 * @param {{cancelled:boolean}} [opts.signal]
 * @returns {Promise<{imported:number, skipped:number, failed:{name:string,error:string}[]}>}
 */
export async function importFiles(files, opts) {
  const { existingFingerprints, resolveFolder, targetFolderId = null, onProgress, onProject, signal } = opts;
  const queue = files.filter((f) => isSb3(f.name));
  const total = queue.length;
  const result = { imported: 0, skipped: files.length - total, failed: [] };
  const seen = new Set(existingFingerprints);
  let doneCount = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length && !signal?.cancelled) {
      const file = queue[cursor++];
      const fp = fingerprintOf(file);
      try {
        if (seen.has(fp)) {
          result.skipped++;
        } else {
          seen.add(fp);
          const meta = await importOne(file, fp, { resolveFolder, targetFolderId });
          result.imported++;
          onProject?.(meta);
        }
      } catch (err) {
        result.failed.push({ name: file.name, error: err.message || String(err) });
      }
      doneCount++;
      onProgress?.({ done: doneCount, total, current: file.name });
      await nextFrame(); // keep the UI responsive between files
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total || 1) }, worker));
  return result;
}

/** Parse and store a single file. */
async function importOne(file, fingerprint, { resolveFolder, targetFolderId }) {
  // Read the bytes once: they are parsed here and stored below.
  const buffer = await file.arrayBuffer();
  const { title, info, thumbnail } = await parseSb3(buffer);

  // Keep the dropped folder structure (minus the file name and the picked root).
  let folderId = targetFolderId;
  const parts = (file.relativePath || '').split('/').filter(Boolean).slice(0, -1);
  if (resolveFolder && parts.length) folderId = await resolveFolder(parts, targetFolderId);

  const now = Date.now();
  const meta = {
    id: uid(),
    fileName: file.name,
    name: title || baseName(file.name), // editable display name
    title,
    size: file.size,
    fingerprint,
    folderId: folderId || null,
    tags: [],
    favorite: false,
    archived: false,
    notes: '',
    description: '',
    importedAt: now,
    modifiedAt: file.lastModified || now,
    updatedAt: now,
    openCount: 0,
    lastOpenedAt: null,
    hasThumbnail: !!thumbnail,
    info,
  };
  // Store a plain Blob (some browsers refuse to persist File objects from pickers).
  const blob = new Blob([buffer], { type: 'application/x.scratch.sb3' });
  await addProject(meta, blob, thumbnail);
  return meta;
}
