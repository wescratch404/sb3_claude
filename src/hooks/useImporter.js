/**
 * useImporter.js — connects the import service to the UI: hidden file inputs,
 * folder picking, drag-and-drop, progress reporting and the result toast.
 *
 * Files land in the folder currently open in the sidebar (or Unfiled), and
 * dropped/picked folder structures are recreated as nested library folders.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLibrary } from '../state/LibraryContext.jsx';
import { VIEWS } from '../state/constants.js';
import {
  importFiles, filterSb3, filesFromDataTransfer, filesFromDirectoryInput,
  canUseDirectoryPicker, filesFromDirectoryPicker,
} from '../services/importService.js';

export function useImporter() {
  const { state, actions } = useLibrary();
  const stateRef = useRef(state);
  stateRef.current = state;
  const fileInput = useRef(null);
  const folderInput = useRef(null);

  /** Create the two hidden <input type=file> elements once. */
  useEffect(() => {
    const make = (dir) => {
      const el = document.createElement('input');
      el.type = 'file';
      el.multiple = true;
      el.accept = '.sb3';
      if (dir) el.webkitdirectory = true;
      el.style.display = 'none';
      document.body.appendChild(el);
      return el;
    };
    fileInput.current = make(false);
    folderInput.current = make(true);
    return () => {
      fileInput.current.remove();
      folderInput.current.remove();
    };
  }, []);

  const run = useCallback(
    async (files, { keepStructure = false } = {}) => {
      const sb3 = filterSb3(files);
      if (!sb3.length) {
        actions.toast('No .sb3 files found in what you chose.', 'warning');
        return;
      }
      const { nav, projects } = stateRef.current;
      const targetFolderId = nav.type === VIEWS.folder ? nav.folderId : null;
      const existing = new Set(projects.map((p) => p.fingerprint));
      const batch = [];
      let lastFlush = performance.now();
      const flush = () => {
        if (batch.length) actions.addImported(batch.splice(0));
        lastFlush = performance.now();
      };

      actions.setTask({ label: 'Importing', done: 0, total: sb3.length });
      const result = await importFiles(sb3, {
        existingFingerprints: existing,
        targetFolderId,
        resolveFolder: keepStructure ? (parts, root) => actions.resolveFolderPath(parts, root) : undefined,
        onProject: (meta) => {
          batch.push(meta);
          // Add to the UI in batches: smooth for thousands of files.
          if (batch.length >= 50 || performance.now() - lastFlush > 400) flush();
        },
        onProgress: ({ done, total, current }) => actions.setTask({ label: 'Importing', done, total, current }),
      });
      flush();
      actions.setTask(null);

      const parts = [`Imported ${result.imported} project${result.imported === 1 ? '' : 's'}`];
      if (result.skipped) parts.push(`${result.skipped} already in the library`);
      if (result.failed.length) parts.push(`${result.failed.length} could not be read (${result.failed.slice(0, 2).map((f) => f.name).join(', ')}${result.failed.length > 2 ? '…' : ''})`);
      actions.toast(parts.join('. '), result.failed.length ? 'warning' : 'success');
      if (result.failed.length) console.table(result.failed);
    },
    [actions],
  );

  const pickFiles = useCallback(() => {
    const el = fileInput.current;
    el.value = '';
    el.onchange = () => run(Array.from(el.files));
    el.click();
  }, [run]);

  const pickFolder = useCallback(async () => {
    // Prefer the File System Access API; fall back to <input webkitdirectory>
    // where it is unavailable or blocked (Firefox, Safari, embedded frames).
    if (canUseDirectoryPicker()) {
      try {
        const files = await filesFromDirectoryPicker();
        await run(files, { keepStructure: true });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    const el = folderInput.current;
    el.value = '';
    el.onchange = () => run(filesFromDirectoryInput(el.files), { keepStructure: true });
    el.click();
  }, [run]);

  const importDrop = useCallback(
    async (dataTransfer) => {
      const files = await filesFromDataTransfer(dataTransfer);
      const hasFolders = files.some((f) => (f.relativePath || '').includes('/'));
      await run(files, { keepStructure: hasFolders });
    },
    [run],
  );

  return { pickFiles, pickFolder, importDrop, importFileList: run };
}
