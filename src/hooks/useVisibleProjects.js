/**
 * useVisibleProjects.js — derives the list shown in the centre pane from the
 * library state: current view (folder / smart view), global search, tag
 * filters and sort order. All memoized, so typing in the search box over a
 * 5000-project library stays instant.
 */
import { useDeferredValue, useMemo } from 'react';
import { useLibrary } from '../state/LibraryContext.jsx';
import { buildFolderIndex } from '../utils/folders.js';
import { VIEWS, RECENT_LIMIT } from '../state/constants.js';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function useFolderIndex() {
  const { state } = useLibrary();
  return useMemo(() => buildFolderIndex(state.folders), [state.folders]);
}

export function useVisibleProjects() {
  const { state } = useLibrary();
  const { projects, nav, sort, tagFilter } = state;
  const search = useDeferredValue(state.search.trim().toLowerCase());
  const folderIndex = useFolderIndex();

  // Pre-built lowercase haystack per project: name, file name, folder path, tags, notes.
  const haystacks = useMemo(() => {
    const m = new Map();
    for (const p of projects) {
      m.set(
        p.id,
        [p.name, p.fileName, folderIndex.pathLabel(p.folderId), (p.tags || []).join(' '), p.notes, p.description]
          .join('\n')
          .toLowerCase(),
      );
    }
    return m;
  }, [projects, folderIndex]);

  return useMemo(() => {
    let list;
    const searching = search.length > 0;

    if (searching) {
      // Global search: the whole library, archived projects included.
      const terms = search.split(/\s+/);
      list = projects.filter((p) => {
        const h = haystacks.get(p.id);
        return terms.every((t) => h.includes(t));
      });
    } else {
      switch (nav.type) {
        case VIEWS.folder:
          list = projects.filter((p) => p.folderId === nav.folderId && !p.archived);
          break;
        case VIEWS.unfiled:
          list = projects.filter((p) => !p.folderId && !p.archived);
          break;
        case VIEWS.favorites:
          list = projects.filter((p) => p.favorite && !p.archived);
          break;
        case VIEWS.archived:
          list = projects.filter((p) => p.archived);
          break;
        case VIEWS.recent:
          list = projects
            .filter((p) => p.lastOpenedAt)
            .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
            .slice(0, RECENT_LIMIT);
          break;
        case VIEWS.mostOpened:
          list = projects
            .filter((p) => p.openCount > 0)
            .sort((a, b) => b.openCount - a.openCount)
            .slice(0, RECENT_LIMIT);
          break;
        default:
          list = projects.filter((p) => !p.archived);
      }
    }

    if (tagFilter.length) {
      list = list.filter((p) => tagFilter.every((t) => (p.tags || []).includes(t)));
    }

    // Recent and Most opened keep their own natural order unless searching.
    const keepOrder = !searching && (nav.type === VIEWS.recent || nav.type === VIEWS.mostOpened);
    if (!keepOrder) {
      const dir = sort.dir === 'asc' ? 1 : -1;
      const key = sort.key;
      list = [...list].sort((a, b) => {
        if (key === 'name') return dir * collator.compare(a.name, b.name);
        const av = a[key] || 0;
        const bv = b[key] || 0;
        return av === bv ? collator.compare(a.name, b.name) : dir * (av - bv);
      });
    }
    return { list, searching };
  }, [projects, haystacks, search, nav, sort, tagFilter]);
}
