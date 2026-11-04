/** TextPromptDialog — a single text field (rename project, new folder, …). */
import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

export default function TextPromptDialog({ title, label = 'Name', initial = '', confirmLabel = 'Save', helperText, onClose }) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();
  const submit = (e) => {
    e.preventDefault();
    if (trimmed) onClose(trimmed);
  };
  return (
    <Dialog open onClose={() => onClose(null)} fullWidth maxWidth="xs">
      <form onSubmit={submit}>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={label}
            value={value}
            helperText={helperText}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => {
              // Select the name without its extension, like a desktop file manager.
              const v = e.target.value;
              const dot = v.toLowerCase().endsWith('.sb3') ? v.length - 4 : v.length;
              e.target.setSelectionRange(0, dot);
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(null)}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
