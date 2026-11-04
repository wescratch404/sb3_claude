/**
 * FolderPickerDialog — choose a destination folder (or "Unfiled") from the
 * nested tree, with the option to create a new folder on the spot.
 * Resolves with { folderId } or null when cancelled.
 */
import React, { useMemo, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemIcon, ListItemText, TextField, Box,
} from '@mui/material';
import FolderRounded from '@mui/icons-material/FolderRounded';
import InboxRounded from '@mui/icons-material/InboxRounded';
import CreateNewFolderRounded from '@mui/icons-material/CreateNewFolderRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { buildFolderIndex } from '../../utils/folders.js';

export default function FolderPickerDialog({ title = 'Move to folder', confirmLabel = 'Move here', excludeId, onClose }) {
  const { state, actions } = useLibrary();
  const index = useMemo(() => buildFolderIndex(state.folders), [state.folders]);
  const [selected, setSelected] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // When moving a folder, hide it and its descendants.
  const rows = index.flatten().filter(({ folder }) => {
    if (!excludeId) return true;
    return !index.pathOf(folder.id).some((f) => f.id === excludeId);
  });

  const create = async () => {
    if (!newName.trim()) return;
    const f = await actions.createFolder(newName, selected);
    setSelected(f.id);
    setNewName('');
    setCreating(false);
  };

  return (
    <Dialog open onClose={() => onClose(null)} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers sx={{ p: 1, maxHeight: 420 }}>
        <List dense disablePadding>
          <ListItemButton selected={selected === null} onClick={() => setSelected(null)}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <InboxRounded fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={excludeId ? 'Top level' : 'Unfiled'} />
          </ListItemButton>
          {rows.map(({ folder, depth }) => (
            <ListItemButton
              key={folder.id}
              selected={selected === folder.id}
              onClick={() => setSelected(folder.id)}
              onDoubleClick={() => onClose({ folderId: folder.id })}
              sx={{ pl: 1 + depth * 2 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                <FolderRounded fontSize="small" sx={{ color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText primary={folder.name} primaryTypographyProps={{ noWrap: true }} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ px: 1, pt: 1 }}>
          {creating ? (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); create(); }} sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" autoFocus fullWidth label="New folder name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button type="submit" disabled={!newName.trim()}>Create</Button>
            </Box>
          ) : (
            <Button size="small" startIcon={<CreateNewFolderRounded />} onClick={() => setCreating(true)}>
              New folder {selected ? `inside “${index.byId.get(selected)?.name}”` : ''}
            </Button>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button variant="contained" onClick={() => onClose({ folderId: selected })}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
