/**
 * useProjectCommands.js — the user-facing commands that act on projects
 * (run, rename, delete, move, tag, export, archive, favourite).
 *
 * Cards, list rows, the details panel, context menus and the bulk action bar
 * all call these, so confirmations, wording and toasts are identical
 * everywhere.
 */
import { useCallback, useMemo } from 'react';
import { useLibrary } from '../state/LibraryContext.jsx';
import { useDialogs } from '../components/dialogs/DialogProvider.jsx';
import { exportProjects } from '../services/backupService.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function useProjectCommands() {
  const { state, actions } = useLibrary();
  const dialogs = useDialogs();

  const byIds = useCallback(
    (ids) => {
      const set = new Set(ids);
      return state.projects.filter((p) => set.has(p.id));
    },
    [state.projects],
  );

  return useMemo(
    () => ({
      run: (id) => actions.runProject(id),

      rename: async (project) => {
        const name = await dialogs.prompt({ title: 'Rename project', label: 'Project name', initial: project.name, confirmLabel: 'Rename' });
        if (name && name !== project.name) {
          await actions.renameProject(project.id, name);
          actions.toast('Renamed');
        }
      },

      remove: async (ids) => {
        const items = byIds(ids);
        if (!items.length) return;
        const ok = await dialogs.confirm({
          title: items.length === 1 ? `Delete “${items[0].name}”?` : `Delete ${plural(items.length, 'project')}?`,
          message: 'The .sb3 files stored in this library will be removed. Files on your computer are not affected. To keep projects out of the way without deleting them, use Archive instead.',
          confirmLabel: 'Delete',
          danger: true,
        });
        if (ok) await actions.deleteProjects(ids);
      },

      move: async (ids) => {
        const res = await dialogs.chooseFolder({ title: `Move ${plural(ids.length, 'project')}` });
        if (res) await actions.moveProjects(ids, res.folderId);
      },

      editTags: async (ids, mode = 'edit') => {
        const projects = byIds(ids);
        const res = await dialogs.editTags({ projects, mode });
        if (!res) return;
        if (res.add.length) await actions.addTags(ids, res.add);
        if (res.remove.length) await actions.removeTags(ids, res.remove);
        if (res.add.length || res.remove.length) actions.toast('Tags updated');
      },

      exportFiles: async (ids) => {
        const projects = byIds(ids);
        try {
          actions.setTask({ label: 'Preparing export', done: 0, total: projects.length });
          const ok = await exportProjects(projects, (done, total) => actions.setTask({ label: 'Preparing export', done, total }));
          if (ok) actions.toast(`Exported ${plural(projects.length, 'project')}`);
        } catch (err) {
          actions.toast(err.message, 'error');
        } finally {
          actions.setTask(null);
        }
      },

      archive: (ids, archived = true) => actions.archiveProjects(ids, archived),
      toggleFavorite: (id) => actions.toggleFavorite(id),
      setFavorite: (ids, fav) => actions.setFavorite(ids, fav),
    }),
    [actions, dialogs, byIds],
  );
}
