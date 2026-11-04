/**
 * Sidebar — navigation: library views, folders, tags, favourites and recents.
 */
import React, { useMemo, useState } from 'react';
import { Box, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AppsRounded from '@mui/icons-material/AppsRounded';
import InboxRounded from '@mui/icons-material/InboxRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import WhatshotRounded from '@mui/icons-material/WhatshotRounded';
import ArchiveRounded from '@mui/icons-material/ArchiveRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useDialogs } from '../dialogs/DialogProvider.jsx';
import { VIEWS, TAG_COLORS } from '../../state/constants.js';
import FolderTree, { useDropTarget } from '../folders/FolderTree.jsx';
import TagChip from '../common/TagChip.jsx';
import { FOLDER_MIME, hasType } from '../projects/dragData.js';

function SectionTitle({ children, action }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 2, pb: 0.5 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ flex: 1 }}>
        {children}
      </Typography>
      {action}
    </Box>
  );
}

function NavItem({ icon, label, count, active, onClick, dropProps, over }) {
  return (
    <ListItemButton
      selected={active}
      onClick={onClick}
      {...dropProps}
      sx={(t) => ({
        py: 0.4,
        minHeight: 32,
        ...(over && { outline: `2px dashed ${t.palette.primary.main}`, bgcolor: alpha(t.palette.primary.main, 0.12) }),
      })}
    >
      <ListItemIcon sx={{ minWidth: 30 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
      {count != null && (
        <Typography variant="caption" color="text.secondary">
          {count.toLocaleString()}
        </Typography>
      )}
    </ListItemButton>
  );
}

export default function Sidebar({ onNavigate }) {
  const { state, actions } = useLibrary();
  const dialogs = useDialogs();
  const [tagMenu, setTagMenu] = useState(null);

  const counts = useMemo(() => {
    let all = 0, unfiled = 0, fav = 0, archived = 0;
    const perTag = new Map();
    for (const p of state.projects) {
      if (p.archived) {
        archived++;
        continue;
      }
      all++;
      if (!p.folderId) unfiled++;
      if (p.favorite) fav++;
      (p.tags || []).forEach((t) => perTag.set(t, (perTag.get(t) || 0) + 1));
    }
    return { all, unfiled, fav, archived, perTag };
  }, [state.projects]);

  const go = (nav) => {
    actions.setSearch('');
    actions.navigate(nav);
    onNavigate?.();
  };
  const is = (type) => state.nav.type === type && !state.search;

  // Smart views that accept dropped projects.
  const unfiledDrop = useDropTarget((ids) => actions.moveProjects(ids, null));
  const favDrop = useDropTarget((ids) => actions.setFavorite(ids, true).then(() => actions.toast('Added to favorites')));
  const archiveDrop = useDropTarget((ids) => actions.archiveProjects(ids, true));

  // Dropping a folder on the "Folders" heading moves it to the top level.
  const [rootOver, setRootOver] = useState(false);
  const rootDrop = {
    onDragOver: (e) => {
      if (!hasType(e, FOLDER_MIME)) return;
      e.preventDefault();
      setRootOver(true);
    },
    onDragLeave: () => setRootOver(false),
    onDrop: (e) => {
      setRootOver(false);
      const id = e.dataTransfer.getData(FOLDER_MIME);
      if (id) actions.moveFolder(id, null);
    },
  };

  const newFolder = async () => {
    const name = await dialogs.prompt({ title: 'New folder', label: 'Folder name', confirmLabel: 'Create folder' });
    if (name) actions.createFolder(name, null);
  };

  return (
    <Box component="nav" aria-label="Library" sx={{ height: '100%', overflowY: 'auto', px: 1, pb: 2 }}>
      <SectionTitle>Library</SectionTitle>
      <List dense disablePadding>
        <NavItem icon={<AppsRounded fontSize="small" />} label="All projects" count={counts.all} active={is(VIEWS.all)} onClick={() => go({ type: VIEWS.all })} />
        <NavItem icon={<InboxRounded fontSize="small" />} label="Unfiled" count={counts.unfiled} active={is(VIEWS.unfiled)} onClick={() => go({ type: VIEWS.unfiled })} dropProps={unfiledDrop.props} over={unfiledDrop.over} />
        <NavItem icon={<StarRounded fontSize="small" sx={{ color: 'warning.main' }} />} label="Favorites" count={counts.fav} active={is(VIEWS.favorites)} onClick={() => go({ type: VIEWS.favorites })} dropProps={favDrop.props} over={favDrop.over} />
        <NavItem icon={<HistoryRounded fontSize="small" />} label="Recently opened" active={is(VIEWS.recent)} onClick={() => go({ type: VIEWS.recent })} />
        <NavItem icon={<WhatshotRounded fontSize="small" />} label="Most opened" active={is(VIEWS.mostOpened)} onClick={() => go({ type: VIEWS.mostOpened })} />
        <NavItem icon={<ArchiveRounded fontSize="small" />} label="Archive" count={counts.archived} active={is(VIEWS.archived)} onClick={() => go({ type: VIEWS.archived })} dropProps={archiveDrop.props} over={archiveDrop.over} />
        <NavItem icon={<InsightsRounded fontSize="small" />} label="Statistics" active={is(VIEWS.dashboard)} onClick={() => go({ type: VIEWS.dashboard })} />
      </List>

      <Box {...rootDrop} sx={(t) => ({ borderRadius: 1, ...(rootOver && { outline: `2px dashed ${t.palette.primary.main}` }) })}>
        <SectionTitle
          action={
            <Tooltip title="New folder">
              <IconButton size="small" onClick={newFolder} aria-label="New folder">
                <AddRounded fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        >
          Folders
        </SectionTitle>
      </Box>
      <List dense disablePadding>
        <FolderTree />
      </List>
      {state.folders.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, display: 'block' }}>
          Create folders like Games, Tutorials or Physics to group projects.
        </Typography>
      )}

      <SectionTitle>Tags</SectionTitle>
      {state.tags.length === 0 ? (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1.5, display: 'block' }}>
          Add tags from a project’s details panel or by selecting several projects.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 1.5, pt: 0.5 }}>
          {[...state.tags]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((t) => (
              <Box
                key={t.name}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setTagMenu({ tag: t, anchor: { left: e.clientX, top: e.clientY } });
                }}
                title="Click to filter. Right-click for colour and delete."
              >
                <TagChip
                  size="medium"
                  name={t.name}
                  count={counts.perTag.get(t.name) || 0}
                  color={t.color}
                  active={state.tagFilter.includes(t.name)}
                  onClick={() => actions.toggleTagFilter(t.name)}
                />
              </Box>
            ))}
        </Box>
      )}
      <Menu open={!!tagMenu} onClose={() => setTagMenu(null)} anchorReference="anchorPosition" anchorPosition={tagMenu?.anchor}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 24px)', gap: 0.75, px: 1.5, py: 1 }}>
          {TAG_COLORS.map((c) => (
            <Box
              key={c}
              component="button"
              aria-label={`Colour ${c}`}
              onClick={() => {
                actions.recolorTag(tagMenu.tag.name, c);
                setTagMenu(null);
              }}
              sx={{ width: 24, height: 24, borderRadius: '4px', border: 0, bgcolor: c, cursor: 'pointer', boxShadow: tagMenu?.tag.color === c ? '0 0 0 2px var(--tag-ring)' : 'none' }}
            />
          ))}
        </Box>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={async () => {
            const tag = tagMenu.tag;
            setTagMenu(null);
            const ok = await dialogs.confirm({
              title: `Delete tag “${tag.name}”?`,
              message: `It will be removed from ${counts.perTag.get(tag.name) || 0} project(s). The projects themselves are kept.`,
              confirmLabel: 'Delete tag',
              danger: true,
            });
            if (ok) actions.deleteTag(tag.name);
          }}
        >
          Delete tag
        </MenuItem>
      </Menu>
    </Box>
  );
}
