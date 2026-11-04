/**
 * ServerImportDialog — import from the Node server's library folder.
 * Only shown when the optional backend (see /server) is running.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton,
  ListItemIcon, ListItemText, TextField, Typography,
} from '@mui/material';
import { listServerFiles, filesFromServer } from '../../services/importService.js';
import { formatBytes } from '../../utils/format.js';

export default function ServerImportDialog({ open, onClose, onImport, existingFingerprints }) {
  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState(new Set());
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFiles(null);
    setError('');
    listServerFiles()
      .then((list) => {
        setFiles(list);
        // Pre-select files that are not in the library yet.
        setChosen(new Set(list.filter((f) => !existingFingerprints.has(`${f.name}|${f.size}|${f.mtime}`)).map((f) => f.path)));
      })
      .catch((e) => setError(e.message));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(
    () => (files || []).filter((f) => f.path.toLowerCase().includes(filter.toLowerCase())).slice(0, 500),
    [files, filter],
  );

  const toggle = (p) => setChosen((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });

  const run = async () => {
    const entries = files.filter((f) => chosen.has(f.path));
    setBusy({ done: 0, total: entries.length });
    const got = await filesFromServer(entries, (done, total) => setBusy({ done, total }));
    setBusy(null);
    onClose();
    onImport(got);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Import from server library folder</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!files && !error && <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>}
        {files && (
          <>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <TextField size="small" fullWidth label="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <Button size="small" onClick={() => setChosen(new Set(files.map((f) => f.path)))}>All</Button>
              <Button size="small" onClick={() => setChosen(new Set())}>None</Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {files.length} .sb3 files found, {chosen.size} selected. Folder structure is kept.
            </Typography>
            <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
              {shown.map((f) => (
                <ListItemButton key={f.path} onClick={() => toggle(f.path)} dense>
                  <ListItemIcon sx={{ minWidth: 36 }}><Checkbox edge="start" size="small" checked={chosen.has(f.path)} tabIndex={-1} /></ListItemIcon>
                  <ListItemText primary={f.path} secondary={formatBytes(f.size)} primaryTypographyProps={{ noWrap: true }} />
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!chosen.size || !!busy} onClick={run}>
          {busy ? `Downloading ${busy.done}/${busy.total}…` : `Import ${chosen.size}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
