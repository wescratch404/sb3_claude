/**
 * App.jsx — the desktop-style shell:
 *
 *   ┌──────────────────────── Top toolbar ────────────────────────┐
 *   │ Sidebar        │ Centre: grid / list / statistics │ Details │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Below the md breakpoint the sidebar and details panel become drawers.
 * Also hosts window-level behaviour: file drag-and-drop import, keyboard
 * shortcuts, the progress strip for long tasks, and toasts.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, CircularProgress, Drawer, LinearProgress, Snackbar, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FileUploadRounded from '@mui/icons-material/FileUploadRounded';
import { useLibrary } from './state/LibraryContext.jsx';
import { VIEWS } from './state/constants.js';
import { useImporter } from './hooks/useImporter.js';
import { useLibraryBackup } from './hooks/useLibraryBackup.js';
import { useVisibleProjects } from './hooks/useVisibleProjects.js';
import { useProjectCommands } from './hooks/useProjectCommands.js';
import { detectServer } from './services/importService.js';
import TopToolbar from './components/layout/TopToolbar.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import DetailsPanel from './components/layout/DetailsPanel.jsx';
import ProjectBrowser from './components/projects/ProjectBrowser.jsx';
import StatsDashboard from './components/dashboard/StatsDashboard.jsx';
import PlayerDialog from './components/player/PlayerDialog.jsx';
import ServerImportDialog from './components/dialogs/ServerImportDialog.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';

const SIDEBAR_W = 256;
const DETAILS_W = 320;

/** Window-wide overlay shown while files are dragged over the app. */
function useFileDropZone(onDrop) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    const isFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const enter = (e) => {
      if (!isFiles(e)) return;
      depth.current++;
      setActive(true);
    };
    const over = (e) => isFiles(e) && e.preventDefault();
    const leave = (e) => {
      if (!isFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setActive(false);
    };
    const drop = (e) => {
      if (!isFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      onDrop(e.dataTransfer);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onDrop]);
  return active;
}

/** Keyboard shortcuts for the project views. */
function useShortcuts() {
  const { state, actions } = useLibrary();
  const { list } = useVisibleProjects();
  const cmd = useProjectCommands();
  const ctx = useRef();
  ctx.current = { state, actions, list, cmd };

  useEffect(() => {
    const onKey = (e) => {
      const { state: s, actions: a, list: l, cmd: c } = ctx.current;
      const el = document.activeElement;
      if (/input|textarea|select/i.test(el?.tagName || '') || el?.isContentEditable) return;
      if (document.querySelector('.MuiDialog-root, .MuiPopover-root')) return; // a dialog/menu owns the keyboard
      const ids = [...s.selection];
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        a.selectAll(l.map((p) => p.id));
      } else if (e.key === 'Escape' && ids.length) {
        a.clearSelection();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && ids.length) {
        e.preventDefault();
        c.remove(ids);
      } else if (e.key === 'F2' && s.activeId) {
        const p = s.projects.find((x) => x.id === s.activeId);
        if (p) c.rename(p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const { state, actions } = useLibrary();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const importer = useImporter();
  const library = useLibraryBackup();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [server, setServer] = useState(null);
  const [serverDialog, setServerDialog] = useState(false);
  useShortcuts();

  const dropping = useFileDropZone(importer.importDrop);

  useEffect(() => {
    detectServer().then((s) => setServer(s?.hasLibrary ? s : null));
  }, []);

  // On small screens, open the details drawer when a single project is picked by tap.
  const lastActive = useRef(state.activeId);
  useEffect(() => {
    if (compact && state.activeId && state.activeId !== lastActive.current && state.selection.size === 1) setDetailsOpen(true);
    lastActive.current = state.activeId;
  }, [state.activeId, compact, state.selection.size]);

  if (state.loading) {
    return (
      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (state.error) {
    return (
      <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 3 }}>
        <Alert severity="error" sx={{ maxWidth: 520 }}>
          The library could not be opened. {state.error}
        </Alert>
      </Box>
    );
  }

  const showDashboard = state.nav.type === VIEWS.dashboard && !state.search;
  const sidebar = (
    <ErrorBoundary name="sidebar">
      <Sidebar onNavigate={() => setSidebarOpen(false)} />
    </ErrorBoundary>
  );
  const details = (
    <ErrorBoundary name="details panel">
      <DetailsPanel onClose={compact || !wide ? () => setDetailsOpen(false) : undefined} />
    </ErrorBoundary>
  );
  const detailsDocked = wide; // ≥1200px: always-visible right panel

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary' }}>
      <TopToolbar
        importer={importer}
        library={library}
        server={server}
        onOpenServerImport={() => setServerDialog(true)}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onToggleDetails={() => setDetailsOpen((v) => !v)}
      />

      {/* Thin progress strip for imports, exports and backups. */}
      <Box sx={{ height: 3, flexShrink: 0 }}>
        {state.task && (
          <LinearProgress
            variant={state.task.total ? 'determinate' : 'indeterminate'}
            value={state.task.total ? (state.task.done / state.task.total) * 100 : 0}
            aria-label={state.task.label}
          />
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {compact ? (
          <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)} PaperProps={{ sx: { width: SIDEBAR_W } }}>
            {sidebar}
          </Drawer>
        ) : (
          <Box sx={{ width: SIDEBAR_W, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>{sidebar}</Box>
        )}

        <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <ErrorBoundary name={showDashboard ? 'statistics view' : 'project view'} key={showDashboard ? 'stats' : 'browser'}>
            {showDashboard ? <StatsDashboard /> : <ProjectBrowser onImport={importer.pickFiles} />}
          </ErrorBoundary>
        </Box>

        {detailsDocked ? (
          <Box component="aside" aria-label="Project details" sx={{ width: DETAILS_W, flexShrink: 0, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflowY: 'auto' }}>
            {details}
          </Box>
        ) : (
          <Drawer anchor="right" open={detailsOpen} onClose={() => setDetailsOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: DETAILS_W + 40 } } }}>
            {details}
          </Drawer>
        )}
      </Box>

      {/* Task label (e.g. "Importing 120 / 3000") */}
      {state.task && (
        <Box
          role="status"
          sx={(t) => ({
            position: 'fixed', left: '50%', bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)',
            px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: `1px solid ${t.palette.divider}`,
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)', maxWidth: '90vw', zIndex: t.zIndex.snackbar,
          })}
        >
          <Typography variant="body2" noWrap>
            {state.task.label} {state.task.total ? `${state.task.done.toLocaleString()} / ${state.task.total.toLocaleString()}` : '…'}
            {state.task.current && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>{state.task.current}</Typography>
            )}
          </Typography>
        </Box>
      )}

      {/* Drag-and-drop overlay */}
      {dropping && (
        <Box
          sx={(t) => ({
            position: 'fixed', inset: 12, zIndex: t.zIndex.modal + 1, pointerEvents: 'none',
            border: `3px dashed ${t.palette.primary.main}`, borderRadius: 4,
            bgcolor: alpha(t.palette.primary.main, 0.08), backdropFilter: 'blur(2px)',
            display: 'grid', placeItems: 'center',
          })}
        >
          <Box sx={{ textAlign: 'center', bgcolor: 'background.paper', px: 4, py: 3, borderRadius: 3, boxShadow: 3 }}>
            <FileUploadRounded color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h6">Drop to import</Typography>
            <Typography variant="body2" color="text.secondary">
              .sb3 files or whole folders{state.nav.type === VIEWS.folder ? ', into the open folder' : ''}
            </Typography>
          </Box>
        </Box>
      )}

      <ErrorBoundary name="player">
        <PlayerDialog />
      </ErrorBoundary>
      <ServerImportDialog
        open={serverDialog}
        onClose={() => setServerDialog(false)}
        onImport={(files) => importer.importFileList(files, { keepStructure: true })}
        existingFingerprints={new Set(state.projects.map((p) => p.fingerprint))}
      />

      <Snackbar
        key={state.toast?.key}
        open={!!state.toast}
        autoHideDuration={state.toast?.severity === 'error' ? 8000 : 4000}
        onClose={(_, reason) => reason !== 'clickaway' && actions.dismissToast()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {state.toast ? (
          <Alert severity={state.toast.severity} variant="filled" onClose={actions.dismissToast} sx={{ maxWidth: 560 }}>
            {state.toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
