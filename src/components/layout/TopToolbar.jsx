/**
 * TopToolbar — import, global search, new folder, view toggle, sort and the
 * library menu (metadata export/import, backup/restore).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AppBar, Box, Button, Divider, IconButton, InputAdornment, InputBase, ListItemIcon, ListItemText, Menu, MenuItem,
  ToggleButton, ToggleButtonGroup, Toolbar, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FileUploadRounded from '@mui/icons-material/FileUploadRounded';
import InsertDriveFileRounded from '@mui/icons-material/InsertDriveFileRounded';
import DriveFolderUploadRounded from '@mui/icons-material/DriveFolderUploadRounded';
import DnsRounded from '@mui/icons-material/DnsRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CreateNewFolderRounded from '@mui/icons-material/CreateNewFolderRounded';
import GridViewRounded from '@mui/icons-material/GridViewRounded';
import ViewListRounded from '@mui/icons-material/ViewListRounded';
import SortRounded from '@mui/icons-material/SortRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import DataObjectRounded from '@mui/icons-material/DataObjectRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import BackupRounded from '@mui/icons-material/BackupRounded';
import RestoreRounded from '@mui/icons-material/RestoreRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useDialogs } from '../dialogs/DialogProvider.jsx';
import { SORT_OPTIONS, VIEWS } from '../../state/constants.js';

export default function TopToolbar({ importer, library, server, onOpenServerImport, onToggleSidebar, onToggleDetails }) {
  const { state, actions } = useLibrary();
  const dialogs = useDialogs();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const searchRef = useRef(null);
  const [importAnchor, setImportAnchor] = useState(null);
  const [sortAnchor, setSortAnchor] = useState(null);
  const [libAnchor, setLibAnchor] = useState(null);

  // "/" or Ctrl/⌘+K focuses search.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const newFolder = async () => {
    const parentId = state.nav.type === VIEWS.folder ? state.nav.folderId : null;
    const name = await dialogs.prompt({
      title: parentId ? 'New sub-folder' : 'New folder',
      label: 'Folder name',
      confirmLabel: 'Create folder',
      helperText: parentId ? 'Created inside the folder you have open.' : undefined,
    });
    if (name) {
      const f = await actions.createFolder(name, parentId);
      actions.toast(`Created folder ${f.name}`);
    }
  };

  const closeLib = (fn) => () => {
    setLibAnchor(null);
    fn();
  };

  return (
    <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Toolbar variant="dense" sx={{ gap: 1, minHeight: 56, px: { xs: 1, sm: 2 } }}>
        {compact && (
          <IconButton aria-label="Open sidebar" onClick={onToggleSidebar} edge="start">
            <MenuRounded />
          </IconButton>
        )}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, mr: 1 }}>
          <Box aria-hidden sx={{ width: 26, height: 20, borderRadius: '4px', bgcolor: 'primary.main', position: 'relative', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.2)', '&::before': { content: '""', position: 'absolute', top: -3, left: 5, width: 9, height: 4, borderRadius: '2px 2px 0 0', bgcolor: 'primary.main' } }} />
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            SB3 Library
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<FileUploadRounded />}
          onClick={(e) => setImportAnchor(e.currentTarget)}
          aria-haspopup="menu"
          sx={{ flexShrink: 0, minWidth: 0, px: compact ? 1.25 : 2 }}
        >
          {compact ? '' : 'Import'}
        </Button>
        <Menu anchorEl={importAnchor} open={!!importAnchor} onClose={() => setImportAnchor(null)}>
          <MenuItem onClick={() => { setImportAnchor(null); importer.pickFiles(); }}>
            <ListItemIcon><InsertDriveFileRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary=".sb3 files…" secondary="One or many at once" />
          </MenuItem>
          <MenuItem onClick={() => { setImportAnchor(null); importer.pickFolder(); }}>
            <ListItemIcon><DriveFolderUploadRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary="A folder…" secondary="Includes sub-folders, keeps their structure" />
          </MenuItem>
          {server && (
            <MenuItem onClick={() => { setImportAnchor(null); onOpenServerImport(); }}>
              <ListItemIcon><DnsRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="From server library folder…" secondary={server.libraryDir} />
            </MenuItem>
          )}
          <Divider />
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
            Tip: drop files or folders anywhere on the window.
          </Typography>
        </Menu>

        {/* Global search */}
        <Box
          sx={(t) => ({
            flex: 1,
            maxWidth: 560,
            mx: { xs: 0.5, md: 2 },
            display: 'flex',
            alignItems: 'center',
            px: 1.25,
            height: 38,
            borderRadius: 2,
            bgcolor: t.palette.sunken,
            border: `1px solid ${t.palette.divider}`,
            '&:focus-within': { borderColor: t.palette.primary.main, boxShadow: `0 0 0 3px ${alpha(t.palette.primary.main, 0.18)}` },
          })}
        >
          <InputBase
            inputRef={searchRef}
            fullWidth
            placeholder={compact ? 'Search' : 'Search names, folders, tags, notes'}
            value={state.search}
            onChange={(e) => actions.setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && actions.setSearch('')}
            inputProps={{ 'aria-label': 'Search projects' }}
            startAdornment={
              <InputAdornment position="start">
                <SearchRounded fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            }
            endAdornment={
              state.search ? (
                <IconButton size="small" aria-label="Clear search" onClick={() => actions.setSearch('')}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              ) : (
                !compact && (
                  <Typography variant="caption" color="text.secondary" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: 0.75 }}>
                    /
                  </Typography>
                )
              )
            }
          />
        </Box>

        {!compact && (
          <Tooltip title="New folder">
            <IconButton onClick={newFolder} aria-label="New folder">
              <CreateNewFolderRounded />
            </IconButton>
          </Tooltip>
        )}

        <ToggleButtonGroup
          size="small"
          exclusive
          value={state.view}
          onChange={(_, v) => v && actions.setView(v)}
          aria-label="View"
          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
        >
          <ToggleButton value="grid" aria-label="Grid view"><GridViewRounded fontSize="small" /></ToggleButton>
          <ToggleButton value="list" aria-label="List view"><ViewListRounded fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>

        <Tooltip title="Sort">
          <IconButton onClick={(e) => setSortAnchor(e.currentTarget)} aria-label="Sort">
            <SortRounded />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={sortAnchor} open={!!sortAnchor} onClose={() => setSortAnchor(null)}>
          {SORT_OPTIONS.map((o) => (
            <MenuItem key={o.key} selected={state.sort.key === o.key} onClick={() => actions.setSort({ ...state.sort, key: o.key })}>
              <ListItemIcon>{state.sort.key === o.key && <CheckRounded fontSize="small" />}</ListItemIcon>
              {o.label}
            </MenuItem>
          ))}
          <Divider />
          {[
            ['asc', 'Ascending'],
            ['desc', 'Descending'],
          ].map(([dir, label]) => (
            <MenuItem key={dir} selected={state.sort.dir === dir} onClick={() => actions.setSort({ ...state.sort, dir })}>
              <ListItemIcon>{state.sort.dir === dir && <CheckRounded fontSize="small" />}</ListItemIcon>
              {label}
            </MenuItem>
          ))}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <Divider />
            <MenuItem onClick={() => { actions.setView(state.view === 'grid' ? 'list' : 'grid'); setSortAnchor(null); }}>
              <ListItemIcon>{state.view === 'grid' ? <ViewListRounded fontSize="small" /> : <GridViewRounded fontSize="small" />}</ListItemIcon>
              {state.view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
            </MenuItem>
          </Box>
        </Menu>

        <Tooltip title="Library: backup and metadata">
          <IconButton onClick={(e) => setLibAnchor(e.currentTarget)} aria-label="Library menu">
            <MoreVertRounded />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={libAnchor} open={!!libAnchor} onClose={() => setLibAnchor(null)}>
          <MenuItem onClick={closeLib(library.exportMetadata)}>
            <ListItemIcon><DataObjectRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary="Export metadata JSON" secondary="Folders, tags, notes; no project files" />
          </MenuItem>
          <MenuItem onClick={closeLib(library.importMetadata)}>
            <ListItemIcon><UploadFileRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary="Import metadata JSON…" secondary="Applies to projects already in the library" />
          </MenuItem>
          <Divider />
          <MenuItem onClick={closeLib(library.backup)}>
            <ListItemIcon><BackupRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary="Back up library" secondary="Everything, including .sb3 files, as one .zip" />
          </MenuItem>
          <MenuItem onClick={closeLib(library.restore)}>
            <ListItemIcon><RestoreRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary="Restore from backup…" />
          </MenuItem>
        </Menu>

        {compact && (
          <IconButton aria-label="Show details" onClick={onToggleDetails} edge="end">
            <InfoOutlined />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  );
}
