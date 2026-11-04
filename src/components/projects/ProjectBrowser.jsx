/**
 * ProjectBrowser — the centre pane: heading (view name or folder breadcrumb),
 * sub-folders, active tag filters, the bulk-action bar, and the grid or list.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Box, Breadcrumbs, Button, Chip, Link, Typography } from '@mui/material';
import FolderRounded from '@mui/icons-material/FolderRounded';
import FileUploadRounded from '@mui/icons-material/FileUploadRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useFolderIndex, useVisibleProjects } from '../../hooks/useVisibleProjects.js';
import { useProjectCommands } from '../../hooks/useProjectCommands.js';
import { VIEWS } from '../../state/constants.js';
import ProjectGrid from './ProjectGrid.jsx';
import ProjectList from './ProjectList.jsx';
import ProjectMenu from './ProjectMenu.jsx';
import BulkActionBar from './BulkActionBar.jsx';
import TagChip from '../common/TagChip.jsx';
import { startProjectDrag } from './dragData.js';

const VIEW_TITLES = {
  [VIEWS.all]: 'All projects',
  [VIEWS.unfiled]: 'Unfiled',
  [VIEWS.favorites]: 'Favorites',
  [VIEWS.recent]: 'Recently opened',
  [VIEWS.mostOpened]: 'Most opened',
  [VIEWS.archived]: 'Archive',
};

const EMPTY_TEXT = {
  [VIEWS.all]: 'Your library is empty. Import .sb3 files or a whole folder, or drop them anywhere on this window.',
  [VIEWS.unfiled]: 'Every project is in a folder.',
  [VIEWS.favorites]: 'Star a project to pin it here.',
  [VIEWS.recent]: 'Projects you run will appear here.',
  [VIEWS.mostOpened]: 'Run a few projects and your most-used ones will collect here.',
  [VIEWS.archived]: 'Archived projects are kept here, out of your other views.',
  [VIEWS.folder]: 'This folder is empty. Drag projects onto it in the sidebar, or use Move from a project’s menu.',
};

export default function ProjectBrowser({ onImport }) {
  const { state, actions } = useLibrary();
  const { list, searching } = useVisibleProjects();
  const folderIndex = useFolderIndex();
  const cmd = useProjectCommands();
  const [menu, setMenu] = useState(null); // { project, anchor }

  const tagColors = useMemo(() => new Map(state.tags.map((t) => [t.name, t.color])), [state.tags]);
  const orderedIds = useMemo(() => list.map((p) => p.id), [list]);

  // Stable handler bundle shared by every card/row (keeps memoization effective).
  const orderRef = React.useRef(orderedIds);
  orderRef.current = orderedIds;
  const selectionRef = React.useRef(state.selection);
  selectionRef.current = state.selection;

  const handlers = useMemo(
    () => ({
      onSelect: (e, id) =>
        actions.clickProject(id, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }, orderRef.current),
      onToggleCheck: (id) => actions.toggleSelect(id),
      onRun: (id) => cmd.run(id),
      onRename: (p) => cmd.rename(p),
      onDelete: (id) => cmd.remove(selectionRef.current.has(id) && selectionRef.current.size > 1 ? [...selectionRef.current] : [id]),
      onFavorite: (id) => cmd.toggleFavorite(id),
      onMenu: (project, anchor) => setMenu({ project, anchor }),
      onDragStart: (e, id) => startProjectDrag(e, id, selectionRef.current),
    }),
    [actions, cmd],
  );

  const folderLabel = useCallback((id) => folderIndex.pathLabel(id), [folderIndex]);
  const selectedIds = [...state.selection];
  const selectedProjects = state.projects.filter((p) => state.selection.has(p.id));
  const allSelected = list.length > 0 && list.every((p) => state.selection.has(p.id));

  /* ---------- heading ---------- */
  const { nav } = state;
  let heading;
  if (searching) {
    heading = <Typography variant="h5" component="h1">Results for “{state.search.trim()}”</Typography>;
  } else if (nav.type === VIEWS.folder) {
    const path = folderIndex.pathOf(nav.folderId);
    heading = (
      <Breadcrumbs aria-label="Folder path" sx={{ '& .MuiBreadcrumbs-separator': { mx: 0.75 } }}>
        {path.map((f, i) =>
          i === path.length - 1 ? (
            <Typography key={f.id} variant="h5" component="h1" color="text.primary">{f.name}</Typography>
          ) : (
            <Link key={f.id} component="button" underline="hover" color="text.secondary" variant="h6"
              onClick={() => actions.navigate({ type: VIEWS.folder, folderId: f.id })}>
              {f.name}
            </Link>
          ),
        )}
      </Breadcrumbs>
    );
  } else {
    heading = <Typography variant="h5" component="h1">{VIEW_TITLES[nav.type]}</Typography>;
  }

  const subfolders = !searching && nav.type === VIEWS.folder ? folderIndex.children(nav.folderId) : [];
  const countIn = (folderId) => state.projects.filter((p) => p.folderId === folderId && !p.archived).length;

  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          {heading}
          <Typography variant="body2" color="text.secondary">
            {list.length.toLocaleString()} project{list.length === 1 ? '' : 's'}
          </Typography>
        </Box>

        {subfolders.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {subfolders.map((f) => (
              <Chip
                key={f.id}
                icon={<FolderRounded />}
                label={`${f.name} (${countIn(f.id)})`}
                variant="outlined"
                onClick={() => actions.navigate({ type: VIEWS.folder, folderId: f.id })}
              />
            ))}
          </Box>
        )}

        {state.tagFilter.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">
              Showing projects tagged with all of
            </Typography>
            {state.tagFilter.map((t) => (
              <TagChip key={t} name={t} color={tagColors.get(t)} size="medium" onDelete={() => actions.toggleTagFilter(t)} />
            ))}
            <Button size="small" onClick={() => actions.setTagFilter([])}>Clear tag filter</Button>
          </Box>
        )}
      </Box>

      {/* One project uses the details panel; two or more get the bulk bar. */}
      {state.selection.size > 1 && (
        <BulkActionBar
          ids={selectedIds}
          allArchived={selectedProjects.length > 0 && selectedProjects.every((p) => p.archived)}
          visibleCount={list.length}
          onSelectAll={() => actions.selectAll(orderedIds)}
          onClear={actions.clearSelection}
        />
      )}

      {list.length === 0 ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 4 }}>
          <Box sx={{ maxWidth: 420, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              {searching || state.tagFilter.length ? 'No matching projects' : 'Nothing here yet'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {searching || state.tagFilter.length
                ? 'Try fewer words, or clear the tag filter. Search looks at names, file names, folders, tags and notes.'
                : EMPTY_TEXT[nav.type]}
            </Typography>
            {!searching && nav.type === VIEWS.all && (
              <Button variant="contained" startIcon={<FileUploadRounded />} onClick={onImport}>
                Import projects
              </Button>
            )}
          </Box>
        </Box>
      ) : state.view === 'grid' ? (
        <ProjectGrid items={list} selection={state.selection} handlers={handlers} tagColors={tagColors} />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', mx: 2, mb: 2, mt: 1, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <ProjectList
            items={list}
            selection={state.selection}
            handlers={handlers}
            sort={state.sort}
            onSort={actions.setSort}
            folderLabel={folderLabel}
            allSelected={allSelected}
            onToggleAll={() => (allSelected ? actions.clearSelection() : actions.selectAll(orderedIds))}
          />
        </Box>
      )}

      <ProjectMenu project={menu?.project} anchor={menu?.anchor} onClose={() => setMenu(null)} />
    </Box>
  );
}
