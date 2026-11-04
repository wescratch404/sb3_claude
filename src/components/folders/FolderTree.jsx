/**
 * FolderTree — the nested folder list in the sidebar.
 *
 *  - Click to open a folder; chevron to expand/collapse sub-folders.
 *  - Drop projects on a folder to move them there.
 *  - Drag a folder onto another folder to nest it (or onto "Folders" to un-nest).
 *  - "⋮" / right-click: new sub-folder, rename, move, delete.
 */
import React, { useMemo, useState } from 'react';
import { Box, IconButton, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import FolderRounded from '@mui/icons-material/FolderRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import MoreHorizRounded from '@mui/icons-material/MoreHorizRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useFolderIndex } from '../../hooks/useVisibleProjects.js';
import { useDialogs } from '../dialogs/DialogProvider.jsx';
import { VIEWS } from '../../state/constants.js';
import { FOLDER_MIME, PROJECT_MIME, hasType, readProjectIds } from '../projects/dragData.js';

/** Shared drop-target behaviour for anything that accepts projects/folders. */
export function useDropTarget(onProjects, onFolder) {
  const [over, setOver] = useState(false);
  const accepts = (e) => hasType(e, PROJECT_MIME) || (onFolder && hasType(e, FOLDER_MIME));
  return {
    over,
    props: {
      onDragOver: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e) => {
        setOver(false);
        if (hasType(e, PROJECT_MIME)) {
          e.preventDefault();
          e.stopPropagation();
          const ids = readProjectIds(e);
          if (ids.length) onProjects(ids);
        } else if (onFolder && hasType(e, FOLDER_MIME)) {
          e.preventDefault();
          e.stopPropagation();
          onFolder(e.dataTransfer.getData(FOLDER_MIME));
        }
      },
    },
  };
}

function FolderNode({ folder, depth, index, counts, expanded, toggle, onMenu }) {
  const { state, actions } = useLibrary();
  const children = index.children(folder.id);
  const isOpen = expanded.has(folder.id);
  const active = state.nav.type === VIEWS.folder && state.nav.folderId === folder.id && !state.search;
  const drop = useDropTarget(
    (ids) => actions.moveProjects(ids, folder.id),
    (folderId) => folderId && actions.moveFolder(folderId, folder.id),
  );

  return (
    <>
      <ListItemButton
        selected={active}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(FOLDER_MIME, folder.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => {
          actions.setSearch('');
          actions.navigate({ type: VIEWS.folder, folderId: folder.id });
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu(folder, { left: e.clientX, top: e.clientY });
        }}
        {...drop.props}
        sx={(t) => ({
          pl: 0.5 + depth * 1.5,
          pr: 0.5,
          py: 0.25,
          minHeight: 32,
          '& .folder-more': { opacity: 0 },
          '&:hover .folder-more, &:focus-visible .folder-more': { opacity: 1 },
          '@media (hover: none)': { '& .folder-more': { opacity: 1 } },
          ...(drop.over && { outline: `2px dashed ${t.palette.primary.main}`, bgcolor: alpha(t.palette.primary.main, 0.12) }),
        })}
      >
        <IconButton
          size="small"
          aria-label={isOpen ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
          onClick={(e) => {
            e.stopPropagation();
            toggle(folder.id);
          }}
          sx={{ p: 0.25, visibility: children.length ? 'visible' : 'hidden' }}
        >
          <ChevronRightRounded sx={{ fontSize: 18, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} />
        </IconButton>
        <ListItemIcon sx={{ minWidth: 26 }}>
          {active ? <FolderOpenRounded fontSize="small" color="primary" /> : <FolderRounded fontSize="small" sx={{ color: 'text.secondary' }} />}
        </ListItemIcon>
        <ListItemText primary={folder.name} primaryTypographyProps={{ noWrap: true, fontSize: 13 }} />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          {counts.get(folder.id) || ''}
        </Typography>
        <IconButton
          className="folder-more"
          size="small"
          aria-label={`Folder actions for ${folder.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onMenu(folder, e.currentTarget);
          }}
          sx={{ p: 0.25, ml: 0.25 }}
        >
          <MoreHorizRounded sx={{ fontSize: 18 }} />
        </IconButton>
      </ListItemButton>
      {isOpen &&
        children.map((c) => (
          <FolderNode key={c.id} folder={c} depth={depth + 1} index={index} counts={counts} expanded={expanded} toggle={toggle} onMenu={onMenu} />
        ))}
    </>
  );
}

export default function FolderTree() {
  const { state, actions } = useLibrary();
  const index = useFolderIndex();
  const dialogs = useDialogs();
  const [expanded, setExpanded] = useState(() => new Set());
  const [menu, setMenu] = useState(null); // { folder, anchor }

  // Direct (non-archived) project count per folder.
  const counts = useMemo(() => {
    const m = new Map();
    state.projects.forEach((p) => p.folderId && !p.archived && m.set(p.folderId, (m.get(p.folderId) || 0) + 1));
    return m;
  }, [state.projects]);

  const toggle = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Keep the active folder's ancestors expanded so it is always visible.
  React.useEffect(() => {
    if (state.nav.type !== VIEWS.folder) return;
    const ancestors = index.pathOf(state.nav.folderId).slice(0, -1).map((f) => f.id);
    if (ancestors.some((id) => !expanded.has(id))) setExpanded((s) => new Set([...s, ...ancestors]));
  }, [state.nav, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => setMenu(null);
  const f = menu?.folder;
  const anchorProps = menu?.anchor?.nodeType
    ? { anchorEl: menu.anchor }
    : { anchorReference: 'anchorPosition', anchorPosition: menu?.anchor };

  const newSub = async () => {
    close();
    const name = await dialogs.prompt({ title: `New folder inside “${f.name}”`, label: 'Folder name', confirmLabel: 'Create folder' });
    if (name) {
      await actions.createFolder(name, f.id);
      setExpanded((s) => new Set([...s, f.id]));
    }
  };
  const rename = async () => {
    close();
    const name = await dialogs.prompt({ title: 'Rename folder', label: 'Folder name', initial: f.name, confirmLabel: 'Rename' });
    if (name) await actions.renameFolder(f.id, name);
  };
  const move = async () => {
    close();
    const res = await dialogs.chooseFolder({ title: `Move “${f.name}” into…`, confirmLabel: 'Move folder', excludeId: f.id });
    if (res) await actions.moveFolder(f.id, res.folderId);
  };
  const remove = async () => {
    close();
    const subtree = state.folders.filter((x) => index.pathOf(x.id).some((p) => p.id === f.id));
    const ids = new Set(subtree.map((x) => x.id));
    const n = state.projects.filter((p) => ids.has(p.folderId)).length;
    const ok = await dialogs.confirm({
      title: `Delete folder “${f.name}”?`,
      message:
        (subtree.length > 1 ? `Its ${subtree.length - 1} sub-folder${subtree.length > 2 ? 's' : ''} will be deleted too. ` : '') +
        (n ? `The ${n} project${n === 1 ? '' : 's'} inside will move to Unfiled — no projects are deleted.` : 'The folder is empty.'),
      confirmLabel: 'Delete folder',
      danger: true,
    });
    if (ok) await actions.deleteFolder(f.id);
  };

  return (
    <Box>
      {index.children(null).map((folder) => (
        <FolderNode key={folder.id} folder={folder} depth={0} index={index} counts={counts} expanded={expanded} toggle={toggle} onMenu={(folder, anchor) => setMenu({ folder, anchor })} />
      ))}
      <Menu open={!!menu} onClose={close} {...anchorProps}>
        <MenuItem onClick={newSub}>New sub-folder</MenuItem>
        <MenuItem onClick={rename}>Rename</MenuItem>
        <MenuItem onClick={move}>Move to…</MenuItem>
        <MenuItem onClick={remove} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>
    </Box>
  );
}
