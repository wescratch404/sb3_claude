/**
 * PlayerDialog — runs a project in an embedded TurboWarp player.
 *
 * The .sb3 Blob is read from IndexedDB and handed to TurboWarp Scaffolding as
 * an ArrayBuffer — no upload, no server round-trip. Controls: green flag,
 * stop, turbo mode, an optional FPS counter, and fullscreen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, IconButton, LinearProgress, Switch, FormControlLabel, Tooltip, Typography, useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import FlagRounded from '@mui/icons-material/FlagRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import FullscreenRounded from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRounded from '@mui/icons-material/FullscreenExitRounded';
import BoltRounded from '@mui/icons-material/BoltRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { getProjectFile } from '../../db/database.js';
import { createPlayer } from '../../services/turbowarpService.js';

/** Best-effort teardown so closed players stop using CPU and audio. */
function destroyPlayer(player) {
  if (!player) return;
  try { player.stopAll(); } catch { /* ignore */ }
  try { player.vm.stop(); } catch { /* ignore */ }
  try { player.vm.quit?.(); } catch { /* ignore */ }
  try { player.audioEngine?.audioContext?.close?.(); } catch { /* ignore */ }
}

export default function PlayerDialog() {
  const { state, actions } = useLibrary();
  const theme = useTheme();
  const small = useMediaQuery(theme.breakpoints.down('sm'));
  const project = state.projects.find((p) => p.id === state.playerId);
  const open = !!project;

  const frameRef = useRef(null); // element that goes fullscreen
  const stageRef = useRef(null); // element Scaffolding renders into
  const playerRef = useRef(null);
  const [phase, setPhase] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [running, setRunning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [maximized, setMaximized] = useState(false); // fallback when Fullscreen API is blocked

  /* ---------- load the project whenever a new one is opened ---------- */
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    let frames = 0;
    let fpsTimer;

    (async () => {
      setPhase('loading');
      setError('');
      setProgress(null);
      setRunning(false);
      setTurbo(false);
      try {
        const blob = await getProjectFile(project.id);
        if (!blob) throw new Error('This project’s file is missing from the library storage. Re-import the .sb3 file.');
        const buffer = await blob.arrayBuffer();
        // Wait one frame so the dialog's stage element is mounted.
        await new Promise((r) => requestAnimationFrame(r));
        if (cancelled || !stageRef.current) return;

        stageRef.current.innerHTML = '';
        const player = await createPlayer(stageRef.current, { cloudKey: project.id });
        if (cancelled) {
          destroyPlayer(player);
          return;
        }
        playerRef.current = player;
        player.storage.onprogress = (total, loaded) => setProgress(total ? loaded / total : null);
        player.vm.runtime.on('PROJECT_RUN_START', () => setRunning(true));
        player.vm.runtime.on('PROJECT_RUN_STOP', () => setRunning(false));
        player.vm.runtime.on('AFTER_EXECUTE', () => { frames++; });
        fpsTimer = setInterval(() => { setFps(frames); frames = 0; }, 1000);

        await player.loadProject(buffer);
        if (cancelled) return;
        player.relayout();
        player.start();
        player.greenFlag(); // the user pressed Run, so start straight away
        setPhase('ready');
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError(err?.message || String(err));
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(fpsTimer);
      destroyPlayer(playerRef.current);
      playerRef.current = null;
      if (stageRef.current) stageRef.current.innerHTML = '';
    };
  }, [open, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- fullscreen ---------- */
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === frameRef.current);
      setTimeout(() => playerRef.current?.relayout(), 50);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => playerRef.current?.relayout(), 60);
    return () => clearTimeout(t);
  }, [maximized, small]);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (maximized) {
      setMaximized(false);
      return;
    }
    try {
      await frameRef.current.requestFullscreen();
    } catch {
      setMaximized(true); // e.g. inside an iframe that disallows fullscreen
    }
  }, [maximized]);

  const close = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setMaximized(false);
    actions.closePlayer();
  };

  /* ---------- keyboard: Esc closes (when not fullscreen) ---------- */
  const onTurbo = (e) => {
    setTurbo(e.target.checked);
    playerRef.current?.vm.setTurboMode(e.target.checked);
  };

  const ready = phase === 'ready';

  return (
    <Dialog
      open={open}
      onClose={close}
      fullScreen={small || maximized}
      maxWidth={false}
      PaperProps={{ sx: { width: small || maximized ? '100%' : 'min(92vw, 1000px)', bgcolor: 'background.paper', overflow: 'hidden' } }}
      aria-labelledby="player-title"
    >
      <Box ref={frameRef} sx={{ display: 'flex', flexDirection: 'column', height: small || maximized || fullscreen ? '100%' : 'auto', bgcolor: fullscreen ? '#000' : 'background.paper' }}>
        {/* Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.75, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
          <Tooltip title="Green flag">
            <span>
              <IconButton
                aria-label="Green flag"
                disabled={!ready}
                onClick={() => playerRef.current?.greenFlag()}
                sx={{ color: 'success.main', bgcolor: running ? 'action.selected' : 'transparent' }}
              >
                <FlagRounded />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Stop">
            <span>
              <IconButton aria-label="Stop" disabled={!ready} onClick={() => playerRef.current?.stopAll()} sx={{ color: 'error.main' }}>
                <StopRounded />
              </IconButton>
            </span>
          </Tooltip>
          <Typography id="player-title" variant="subtitle1" noWrap sx={{ flex: 1, minWidth: 0, px: 1 }}>
            {project?.name}
          </Typography>
          <FormControlLabel
            sx={{ mr: 0.5, display: { xs: 'none', sm: 'inline-flex' } }}
            control={<Switch size="small" checked={turbo} onChange={onTurbo} disabled={!ready} />}
            label={<Box sx={{ display: 'flex', alignItems: 'center', fontSize: 13 }}><BoltRounded sx={{ fontSize: 16 }} />Turbo</Box>}
          />
          <FormControlLabel
            sx={{ mr: 0.5 }}
            control={<Switch size="small" checked={showFps} onChange={(e) => setShowFps(e.target.checked)} />}
            label={<Typography sx={{ fontSize: 13 }}>FPS</Typography>}
          />
          <Tooltip title={fullscreen || maximized ? 'Exit fullscreen' : 'Fullscreen'}>
            <IconButton aria-label="Fullscreen" onClick={toggleFullscreen}>
              {fullscreen || maximized ? <FullscreenExitRounded /> : <FullscreenRounded />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton aria-label="Close player" onClick={close}>
              <CloseRounded />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Stage */}
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            bgcolor: '#111',
            ...(small || maximized || fullscreen ? { minHeight: 0 } : { aspectRatio: '4 / 3', maxHeight: 'calc(92vh - 60px)' }),
          }}
        >
          <Box ref={stageRef} sx={{ position: 'absolute', inset: 0 }} />

          {phase === 'loading' && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center' }}>
              <Box>
                <CircularProgress color="inherit" size={36} />
                <Typography sx={{ mt: 2 }}>Starting the TurboWarp player…</Typography>
                {progress != null && <LinearProgress variant="determinate" value={progress * 100} sx={{ mt: 1, width: 200, mx: 'auto' }} />}
              </Box>
            </Box>
          )}

          {phase === 'error' && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 3 }}>
              <Alert severity="error" sx={{ maxWidth: 480 }} action={<Button color="inherit" size="small" onClick={close}>Close</Button>}>
                The project could not be started. {error}
              </Alert>
            </Box>
          )}

          {showFps && ready && (
            <Box sx={{ position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 600, pointerEvents: 'none' }}>
              {fps} FPS
            </Box>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
