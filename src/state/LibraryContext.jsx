/**
 * LibraryContext.jsx — the single source of truth for the library.
 *
 * Holds all project/folder/tag metadata in memory (loaded once from
 * IndexedDB), plus UI state (current view, search, sort, selection). Every
 * mutating action writes to IndexedDB first and then updates React state, so
 * the UI always reflects what is actually persisted.
 *
 * Components use the `useLibrary()` hook to read `state` and call `actions`.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import * as db from '../db/database.js';
import { uid } from '../utils/format.js';
import { VIEWS, TAG_COLORS, STARTER_FOLDERS } from './constants.js';

const LibraryContext = createContext(null);

const initialState = {
  loading: true,
  error: null,
  projects: [],
  folders: [],
  tags: [],
  // UI state
  nav: { type: VIEWS.all, folderId: null },
  search: '',
  tagFilter: [], // tag names; a project must have ALL of them
  view: 'grid',
  sort: { key: 'importedAt', dir: 'desc' },
  selection: new Set(),
  anchorId: null, // last clicked project, for shift-click ranges
  activeId: null, // project shown in the details panel
  playerId: null, // project open in the player
  toast: null, // { message, severity }
  task: null, // long-running task progress { label, done, total }
};

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

function reducer(state, action) {
  switch (action.type) {
    case 'loaded':
      return { ...state, loading: false, ...action.payload };
    case 'error':
      return { ...state, loading: false, error: action.error };
    case 'projectsUpsert': {
      const map = new Map(state.projects.map((p) => [p.id, p]));
      action.projects.forEach((p) => map.set(p.id, p));
      return { ...state, projects: Array.from(map.values()) };
    }
    case 'projectsRemove': {
      const gone = new Set(action.ids);
      const selection = new Set([...state.selection].filter((id) => !gone.has(id)));
      return {
        ...state,
        projects: state.projects.filter((p) => !gone.has(p.id)),
        selection,
        activeId: gone.has(state.activeId) ? null : state.activeId,
      };
    }
    case 'folders':
      return { ...state, folders: action.folders };
    case 'folderAdd':
      return { ...state, folders: [...state.folders, action.folder] };
    case 'tagsAdd':
      return { ...state, tags: [...state.tags, ...action.tags] };
    case 'tags':
      return { ...state, tags: action.tags };
    case 'set':
      return { ...state, ...action.patch };
    case 'navigate':
      return { ...state, nav: action.nav, selection: new Set(), anchorId: null };
    case 'select':
      return { ...state, selection: action.selection, anchorId: action.anchorId ?? state.anchorId, activeId: action.activeId ?? state.activeId };
    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

export function LibraryProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // A ref mirror lets async actions read the latest state without re-binding.
  const ref = useRef(state);
  ref.current = state;

  /* ---------- initial load ---------- */
  useEffect(() => {
    (async () => {
      try {
        const [projects, folders, tags, view, sort] = await Promise.all([
          db.getAll(db.STORES.projects),
          db.getAll(db.STORES.folders),
          db.getAll(db.STORES.tags),
          db.getSetting('view'),
          db.getSetting('sort'),
        ]);
        let startFolders = folders;
        const seeded = await db.getSetting('seeded');
        if (!seeded && !folders.length && !projects.length) {
          startFolders = STARTER_FOLDERS.map((name, i) => ({ id: uid(), name, parentId: null, createdAt: Date.now() + i }));
          await db.putMany(db.STORES.folders, startFolders);
          await db.setSetting('seeded', true);
        }
        dispatch({
          type: 'loaded',
          payload: { projects, folders: startFolders, tags, ...(view && { view }), ...(sort && { sort }) },
        });
      } catch (err) {
        dispatch({ type: 'error', error: err.message || String(err) });
      }
    })();
  }, []);

  /* ---------- helpers ---------- */
  const toast = useCallback((message, severity = 'success') => dispatch({ type: 'set', patch: { toast: { message, severity, key: Date.now() } } }), []);
  const setTask = useCallback((task) => dispatch({ type: 'set', patch: { task } }), []);

  /** Apply a patch to several projects and persist it. */
  const updateProjects = useCallback(async (ids, patchOrFn) => {
    const idSet = new Set(ids);
    const now = Date.now();
    const changed = ref.current.projects
      .filter((p) => idSet.has(p.id))
      .map((p) => ({ ...p, ...(typeof patchOrFn === 'function' ? patchOrFn(p) : patchOrFn), updatedAt: now }));
    await db.putMany(db.STORES.projects, changed);
    dispatch({ type: 'projectsUpsert', projects: changed });
    return changed;
  }, []);

  /* ---------- actions ---------- */
  const actions = useMemo(() => {
    const pendingFolders = new Map(); // see resolveFolderPath
    const a = {
      toast,
      setTask,
      dismissToast: () => dispatch({ type: 'set', patch: { toast: null } }),

      /* UI */
      navigate: (nav) => dispatch({ type: 'navigate', nav: { folderId: null, ...nav } }),
      setSearch: (search) => dispatch({ type: 'set', patch: { search } }),
      setTagFilter: (tagFilter) => dispatch({ type: 'set', patch: { tagFilter } }),
      toggleTagFilter: (name) => {
        const cur = ref.current.tagFilter;
        dispatch({ type: 'set', patch: { tagFilter: cur.includes(name) ? cur.filter((t) => t !== name) : [...cur, name] } });
      },
      setView: (view) => {
        dispatch({ type: 'set', patch: { view } });
        db.setSetting('view', view);
      },
      setSort: (sort) => {
        dispatch({ type: 'set', patch: { sort } });
        db.setSetting('sort', sort);
      },
      setActive: (activeId) => dispatch({ type: 'set', patch: { activeId } }),

      /**
       * Selection with desktop semantics.
       * @param {string} id clicked project
       * @param {{ctrl:boolean, shift:boolean}} mods
       * @param {string[]} orderedIds the currently visible order (for ranges)
       */
      clickProject: (id, { ctrl = false, shift = false } = {}, orderedIds = []) => {
        const { selection, anchorId } = ref.current;
        if (shift && anchorId) {
          const i1 = orderedIds.indexOf(anchorId);
          const i2 = orderedIds.indexOf(id);
          if (i1 !== -1 && i2 !== -1) {
            const [s, e] = i1 < i2 ? [i1, i2] : [i2, i1];
            const next = new Set(ctrl ? selection : []);
            orderedIds.slice(s, e + 1).forEach((x) => next.add(x));
            dispatch({ type: 'select', selection: next, activeId: id });
            return;
          }
        }
        if (ctrl) {
          const next = new Set(selection);
          next.has(id) ? next.delete(id) : next.add(id);
          dispatch({ type: 'select', selection: next, anchorId: id, activeId: id });
          return;
        }
        dispatch({ type: 'select', selection: new Set([id]), anchorId: id, activeId: id });
      },
      toggleSelect: (id) => {
        const next = new Set(ref.current.selection);
        next.has(id) ? next.delete(id) : next.add(id);
        dispatch({ type: 'select', selection: next, anchorId: id });
      },
      selectAll: (ids) => dispatch({ type: 'select', selection: new Set(ids) }),
      clearSelection: () => dispatch({ type: 'select', selection: new Set() }),

      /* Projects */
      addImported: (metas) => dispatch({ type: 'projectsUpsert', projects: metas }),
      updateProjects,
      renameProject: (id, name) => updateProjects([id], { name: name.trim() }),
      setNotes: (id, patch) => updateProjects([id], patch),
      toggleFavorite: (id) => updateProjects([id], (p) => ({ favorite: !p.favorite })),
      setFavorite: (ids, favorite) => updateProjects(ids, { favorite }),
      moveProjects: async (ids, folderId) => {
        await updateProjects(ids, { folderId: folderId || null });
        const folder = ref.current.folders.find((f) => f.id === folderId);
        toast(`Moved ${ids.length} project${ids.length === 1 ? '' : 's'} to ${folder ? folder.name : 'Unfiled'}`);
      },
      archiveProjects: async (ids, archived = true) => {
        await updateProjects(ids, { archived });
        toast(`${archived ? 'Archived' : 'Restored'} ${ids.length} project${ids.length === 1 ? '' : 's'}`);
        if (archived) dispatch({ type: 'select', selection: new Set() });
      },
      deleteProjects: async (ids) => {
        await db.deleteProjects(ids);
        dispatch({ type: 'projectsRemove', ids });
        toast(`Deleted ${ids.length} project${ids.length === 1 ? '' : 's'}`);
      },
      /** Record a run (for Recent / Most opened) and open the player. */
      runProject: async (id) => {
        dispatch({ type: 'set', patch: { playerId: id } });
        await updateProjects([id], (p) => ({ openCount: (p.openCount || 0) + 1, lastOpenedAt: Date.now() }));
      },
      closePlayer: () => dispatch({ type: 'set', patch: { playerId: null } }),

      /* Tags */
      ensureTags: async (names) => {
        const existing = new Set(ref.current.tags.map((t) => t.name.toLowerCase()));
        const fresh = [];
        names.forEach((n) => {
          if (!existing.has(n.toLowerCase())) {
            existing.add(n.toLowerCase());
            fresh.push({ name: n, color: TAG_COLORS[(ref.current.tags.length + fresh.length) % TAG_COLORS.length] });
          }
        });
        if (fresh.length) {
          await db.putMany(db.STORES.tags, fresh);
          dispatch({ type: 'tagsAdd', tags: fresh });
        }
      },
      addTags: async (ids, names) => {
        const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
        if (!clean.length) return;
        await a.ensureTags(clean);
        await updateProjects(ids, (p) => ({ tags: [...new Set([...(p.tags || []), ...clean])] }));
      },
      removeTags: async (ids, names) => {
        const drop = new Set(names);
        await updateProjects(ids, (p) => ({ tags: (p.tags || []).filter((t) => !drop.has(t)) }));
      },
      recolorTag: async (name, color) => {
        const tags = ref.current.tags.map((t) => (t.name === name ? { ...t, color } : t));
        await db.put(db.STORES.tags, { name, color });
        dispatch({ type: 'tags', tags });
      },
      deleteTag: async (name) => {
        const users = ref.current.projects.filter((p) => (p.tags || []).includes(name)).map((p) => p.id);
        if (users.length) await a.removeTags(users, [name]);
        await db.remove(db.STORES.tags, name);
        dispatch({ type: 'tags', tags: ref.current.tags.filter((t) => t.name !== name) });
        dispatch({ type: 'set', patch: { tagFilter: ref.current.tagFilter.filter((t) => t !== name) } });
      },

      /* Folders */
      createFolder: async (name, parentId = null) => {
        const folder = { id: uid(), name: name.trim(), parentId, createdAt: Date.now() };
        await db.put(db.STORES.folders, folder);
        dispatch({ type: 'folderAdd', folder });
        return folder;
      },
      renameFolder: async (id, name) => {
        pendingFolders.clear();
        const folders = ref.current.folders.map((f) => (f.id === id ? { ...f, name: name.trim() } : f));
        await db.put(db.STORES.folders, folders.find((f) => f.id === id));
        dispatch({ type: 'folders', folders });
      },
      /** Re-parent a folder; refuses to move a folder inside itself. */
      moveFolder: async (id, parentId) => {
        if (id === parentId) return;
        pendingFolders.clear();
        const { folders } = ref.current;
        for (let p = parentId; p; p = folders.find((f) => f.id === p)?.parentId) {
          if (p === id) {
            toast('A folder cannot be moved inside one of its own sub-folders.', 'warning');
            return;
          }
        }
        const next = folders.map((f) => (f.id === id ? { ...f, parentId: parentId || null } : f));
        await db.put(db.STORES.folders, next.find((f) => f.id === id));
        dispatch({ type: 'folders', folders: next });
      },
      /** Delete a folder and its sub-folders; their projects become Unfiled. */
      deleteFolder: async (id) => {
        pendingFolders.clear();
        const { folders, nav } = ref.current;
        const doomed = new Set([id]);
        let grew = true;
        while (grew) {
          grew = false;
          folders.forEach((f) => {
            if (f.parentId && doomed.has(f.parentId) && !doomed.has(f.id)) {
              doomed.add(f.id);
              grew = true;
            }
          });
        }
        const orphanIds = ref.current.projects.filter((p) => doomed.has(p.folderId)).map((p) => p.id);
        if (orphanIds.length) await updateProjects(orphanIds, { folderId: null });
        await db.removeMany(db.STORES.folders, [...doomed]);
        dispatch({ type: 'folders', folders: folders.filter((f) => !doomed.has(f.id)) });
        if (nav.type === VIEWS.folder && doomed.has(nav.folderId)) a.navigate({ type: VIEWS.all });
      },
      /**
       * Find or create a nested folder path, e.g. ['Tutorials','Beginner'],
       * under `rootId`. Used to keep folder structure when importing folders.
       */
      resolveFolderPath: async (parts, rootId = null) => {
        let parent = rootId;
        for (const name of parts) {
          // Several import workers may ask for the same new folder at once, so
          // in-flight creations are shared through `pendingFolders`.
          const key = `${parent || ''}/${name.toLowerCase()}`;
          if (!pendingFolders.has(key)) {
            const found = ref.current.folders.find(
              (f) => (f.parentId || null) === (parent || null) && f.name.toLowerCase() === name.toLowerCase(),
            );
            pendingFolders.set(key, found ? Promise.resolve(found.id) : a.createFolder(name, parent).then((f) => f.id));
          }
          parent = await pendingFolders.get(key);
        }
        return parent;
      },

      /** Reload everything from IndexedDB (after restore / metadata import). */
      reload: async () => {
        const [projects, folders, tags] = await Promise.all([
          db.getAll(db.STORES.projects),
          db.getAll(db.STORES.folders),
          db.getAll(db.STORES.tags),
        ]);
        dispatch({ type: 'loaded', payload: { projects, folders, tags, selection: new Set(), activeId: null } });
      },
    };
    return a;
  }, [toast, setTask, updateProjects]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

/** Access library state and actions. */
export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return ctx;
}
