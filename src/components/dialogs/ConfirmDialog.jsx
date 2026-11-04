/** ConfirmDialog — yes/no confirmation, red when the action is destructive. */
import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

export default function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onClose }) {
  return (
    <Dialog open onClose={() => onClose(false)} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      {message && (
        <DialogContent>
          <DialogContentText component="div">{message}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={() => onClose(false)}>Cancel</Button>
        <Button autoFocus variant="contained" color={danger ? 'error' : 'primary'} onClick={() => onClose(true)}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
