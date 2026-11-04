/**
 * backupService.js — metadata export/import and full library backup/restore.
 *
 *  Metadata JSON  → folders, tags and per-project metadata (no binaries).
 *                   Small; good for syncing organisation between machines
 *                   that already hold the same .sb3 files.
 *  Full backup    → a .zip with library.json, every .sb3 and every thumbnail.
 *                   Restoring it recreates the library exactly.
 *  Project export → selected .sb3 files bundled into one .zip (or a single .sb3).
 */
import JSZip from 'jszip';
import * as db from '../db/database.js';
import { saveFile } from './downloadService.js';
import { nextFrame } from '../utils/format.js';

const FORMAT = 'sb3-library-manager';
const VERSION = 1;
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

/** Build the metadata document from in-memory state. */
function metadataDoc({ projects, folders, tags }) {
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), folders, tags, projects };
}

export async function exportMetadata(state) {
  const json = JSON.stringify(metadataDoc(state), null, 2);
  return saveFile(`sb3-library-metadata-${stamp()}.json`, json);
}

/**
 * Merge a metadata JSON into the library. Projects are matched by id first,
 * then by fingerprint (file name + size + date), so metadata exported on
 * another machine applies to the same files imported there.
 * @returns {{folders:number, tags:number, projects:number}} counts applied
 */
export async function importMetadata(file, current) {
  const doc = JSON.parse(await file.text());
  if (doc.format !== FORMAT) throw new Error('This JSON file was not exported by Scratch SB3 Library Manager.');

  const byId = new Map(current.projects.map((p) => [p.id, p]));
  const byFp = new Map(current.projects.map((p) => [p.fingerprint, p]));
  const updated = [];
  for (const incoming of doc.projects || []) {
    const target = byId.get(incoming.id) || byFp.get(incoming.fingerprint);
    if (!target) continue;
    const { id, fingerprint, size, fileName, hasThumbnail, info, ...editable } = incoming;
    updated.push({ ...target, ...editable, updatedAt: Date.now() });
  }
  await db.putMany(db.STORES.folders, doc.folders || []);
  await db.putMany(db.STORES.tags, doc.tags || []);
  await db.putMany(db.STORES.projects, updated);
  return { folders: (doc.folders || []).length, tags: (doc.tags || []).length, projects: updated.length };
}

/** Full backup: metadata + every .sb3 + thumbnails, as one zip. */
export async function backupLibrary(state, onProgress) {
  const zip = new JSZip();
  zip.file('library.json', JSON.stringify(metadataDoc(state)));
  const filesDir = zip.folder('files');
  const thumbs = {};
  const total = state.projects.length;
  for (let i = 0; i < total; i++) {
    const p = state.projects[i];
    const blob = await db.getProjectFile(p.id);
    if (blob) filesDir.file(`${p.id}.sb3`, blob, { binary: true });
    const thumb = await db.getThumbnail(p.id);
    if (thumb) thumbs[p.id] = thumb;
    onProgress?.(i + 1, total);
    if (i % 25 === 0) await nextFrame();
  }
  zip.file('thumbnails.json', JSON.stringify(thumbs));
  // .sb3 files are already compressed, so STORE keeps backups fast.
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return saveFile(`sb3-library-backup-${stamp()}.zip`, out);
}

/**
 * Restore a backup zip. `mode` is 'merge' (keep existing, add missing) or
 * 'replace' (wipe the library first).
 */
export async function restoreLibrary(file, mode, onProgress) {
  const zip = await JSZip.loadAsync(file);
  const libEntry = zip.file('library.json');
  if (!libEntry) throw new Error('This zip is not a library backup (library.json is missing).');
  const doc = JSON.parse(await libEntry.async('string'));
  if (doc.format !== FORMAT) throw new Error('This backup was not created by Scratch SB3 Library Manager.');
  const thumbs = zip.file('thumbnails.json') ? JSON.parse(await zip.file('thumbnails.json').async('string')) : {};

  if (mode === 'replace') await db.clearAll();
  await db.putMany(db.STORES.folders, doc.folders || []);
  await db.putMany(db.STORES.tags, doc.tags || []);

  const projects = doc.projects || [];
  let restored = 0;
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const entry = zip.file(`files/${p.id}.sb3`);
    if (entry) {
      const blob = new Blob([await entry.async('arraybuffer')], { type: 'application/x.scratch.sb3' });
      await db.addProject(p, blob, thumbs[p.id] || null);
      restored++;
    }
    onProgress?.(i + 1, projects.length);
    if (i % 10 === 0) await nextFrame();
  }
  return { restored, total: projects.length };
}

/** Export projects: one → .sb3, several → a .zip of .sb3 files. */
export async function exportProjects(projects, onProgress) {
  if (projects.length === 1) {
    const p = projects[0];
    const blob = await db.getProjectFile(p.id);
    if (!blob) throw new Error(`The file for "${p.name}" is missing from storage.`);
    return saveFile(safeFileName(p.name, p.fileName), blob);
  }
  const zip = new JSZip();
  const used = new Set();
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const blob = await db.getProjectFile(p.id);
    if (!blob) continue;
    let name = safeFileName(p.name, p.fileName);
    for (let n = 2; used.has(name.toLowerCase()); n++) name = name.replace(/( \(\d+\))?\.sb3$/i, ` (${n}).sb3`);
    used.add(name.toLowerCase());
    zip.file(name, blob, { binary: true });
    onProgress?.(i + 1, projects.length);
  }
  const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return saveFile(`sb3-projects-${projects.length}-${stamp()}.zip`, out);
}

/** Use the display name as the file name, keeping it filesystem-safe. */
function safeFileName(name, fallback) {
  const clean = (name || '').replace(/[\\/:*?"<>|]+/g, '_').trim();
  return clean ? `${clean}.sb3` : fallback;
}
