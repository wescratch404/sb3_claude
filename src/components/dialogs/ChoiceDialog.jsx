/** ChoiceDialog — pick one of several labelled actions (e.g. Merge vs Replace). */
import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export default function ChoiceDialog({ title, message, options = [], onClose }) {
  return (
    <Dialog open onClose={() => onClose(null)} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText component="div">{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        {options.map((o) => (
          <Button key={o.value} variant={o.primary ? 'contained' : 'outlined'} color={o.color || 'primary'} onClick={() => onClose(o.value)}>
            {o.label}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  );
}
