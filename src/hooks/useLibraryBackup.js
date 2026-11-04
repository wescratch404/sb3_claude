/**
 * useLibraryBackup.js — UI glue for metadata export/import and full
 * backup/restore (see services/backupService.js).
 */
import { useCallback, useMemo } from 'react';
import { useLibrary } from '../state/LibraryContext.jsx';
import { useDialogs } from '../components/dialogs/DialogProvider.jsx';
import { clearThumbnailCache } from './useThumbnail.js';
import * as backup from '../services/backupService.js';

/** Open a one-off file picker and resolve with the chosen File (or null). */
function pickOne(accept) {
  return new Promise((resolve) => {
    const el = Object.assign(document.createElement('input'), { type: 'file', accept });
    el.onchange = () => resolve(el.files[0] || null);
    el.click();
  });
}

export function useLibraryBackup() {
  const { state, actions } = useLibrary();
  const dialogs = useDialogs();

  const guard = useCallback(
    async (label, fn) => {
      try {
        await fn();
      } catch (err) {
        console.error(err);
        actions.toast(`${label} failed: ${err.message || err}`, 'error');
      } finally {
        actions.setTask(null);
      }
    },
    [actions],
  );

  return useMemo(
    () => ({
      exportMetadata: () =>
        guard('Export', async () => {
          if (await backup.exportMetadata(state)) actions.toast('Metadata exported');
        }),

      importMetadata: () =>
        guard('Import', async () => {
          const file = await pickOne('.json,application/json');
          if (!file) return;
          const res = await backup.importMetadata(file, state);
          await actions.reload();
          actions.toast(`Applied metadata to ${res.projects} project(s), ${res.folders} folder(s), ${res.tags} tag(s)`);
        }),

      backup: () =>
        guard('Backup', async () => {
          if (!state.projects.length) {
            actions.toast('The library is empty, so there is nothing to back up.', 'info');
            return;
          }
          actions.setTask({ label: 'Creating backup', done: 0, total: state.projects.length });
          const ok = await backup.backupLibrary(state, (done, total) => actions.setTask({ label: 'Creating backup', done, total }));
          if (ok) actions.toast('Backup saved');
        }),

      restore: () =>
        guard('Restore', async () => {
          const file = await pickOne('.zip,application/zip');
          if (!file) return;
          const mode = await dialogs.choose({
            title: 'Restore library backup',
            message: 'Merge adds the backup’s projects, folders and tags to your current library. Replace deletes the current library first, then restores the backup exactly.',
            options: [
              { value: 'replace', label: 'Replace library', color: 'error' },
              { value: 'merge', label: 'Merge', primary: true },
            ],
          });
          if (!mode) return;
          actions.setTask({ label: 'Restoring', done: 0, total: 1 });
          const res = await backup.restoreLibrary(file, mode, (done, total) => actions.setTask({ label: 'Restoring', done, total }));
          clearThumbnailCache();
          await actions.reload();
          actions.toast(`Restored ${res.restored} of ${res.total} projects`);
        }),
    }),
    [state, actions, dialogs, guard],
  );
}
