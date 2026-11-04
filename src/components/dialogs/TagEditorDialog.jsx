/**
 * TagEditorDialog — add or remove tags on one or many projects.
 *
 * Every library tag is shown with its state across the selected projects:
 *   on all (✓), on some (–), or on none. Clicking a tag toggles it between
 *   "on all" and "on none". New tags can be typed in. On save the dialog
 *   resolves with { add: string[], remove: string[] }.
 *
 * `mode="remove"` starts with only the tags present on the selection.
 */
import React, { useMemo, useState } from 'react';
import {
  Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import CheckRounded from '@mui/icons-material/CheckRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import TagChip from '../common/TagChip.jsx';

export default function TagEditorDialog({ projects, mode = 'edit', onClose }) {
  const { state } = useLibrary();
  const colorOf = useMemo(() => new Map(state.tags.map((t) => [t.name, t.color])), [state.tags]);

  // How many of the selected projects carry each tag.
  const counts = useMemo(() => {
    const m = new Map();
    projects.forEach((p) => (p.tags || []).forEach((t) => m.set(t, (m.get(t) || 0) + 1)));
    return m;
  }, [projects]);

  const initial = useMemo(() => {
    const m = new Map();
    state.tags.forEach((t) => {
      const c = counts.get(t.name) || 0;
      m.set(t.name, c === 0 ? 'none' : c === projects.length ? 'all' : 'some');
    });
    return m;
  }, [state.tags, counts, projects.length]);

  const [status, setStatus] = useState(initial);
  const [input, setInput] = useState('');

  const visibleTags = [...status.keys()].filter((name) => mode !== 'remove' || initial.get(name) !== 'none');

  const toggle = (name) =>
    setStatus((s) => new Map(s).set(name, s.get(name) === 'all' ? 'none' : 'all'));

  const addNew = (raw) => {
    const name = (raw || '').trim();
    if (!name) return;
    const existing = [...status.keys()].find((n) => n.toLowerCase() === name.toLowerCase());
    setStatus((s) => new Map(s).set(existing || name, 'all'));
    setInput('');
  };

  const save = () => {
    const add = [];
    const remove = [];
    status.forEach((st, name) => {
      const before = initial.get(name) || 'none';
      if (st === before) return;
      if (st === 'all') add.push(name);
      if (st === 'none') remove.push(name);
    });
    onClose({ add, remove });
  };

  const label = projects.length === 1 ? `“${projects[0].name}”` : `${projects.length} projects`;

  return (
    <Dialog open onClose={() => onClose(null)} fullWidth maxWidth="sm">
      <DialogTitle>
        {mode === 'remove' ? 'Remove tags from' : 'Tags for'} {label}
      </DialogTitle>
      <DialogContent dividers>
        {mode !== 'remove' && (
          <Autocomplete
            freeSolo
            options={state.tags.map((t) => t.name)}
            inputValue={input}
            onInputChange={(_, v) => setInput(v)}
            onChange={(_, v) => addNew(v)}
            renderInput={(params) => (
              <TextField
                {...params}
                autoFocus
                size="small"
                label="Add a tag"
                placeholder="e.g. Platformer, Physics, Education"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && input.trim()) {
                    e.preventDefault();
                    addNew(input);
                  }
                }}
              />
            )}
            sx={{ mb: 2 }}
          />
        )}
        {visibleTags.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            {mode === 'remove' ? 'These projects have no tags.' : 'No tags yet. Type a name above and press Enter.'}
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
              Click a tag to switch it on or off for {projects.length === 1 ? 'this project' : 'every selected project'}.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {visibleTags.map((name) => {
                const st = status.get(name);
                return (
                  <Box
                    key={name}
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, opacity: st === 'none' ? 0.45 : 1 }}
                  >
                    <TagChip
                      size="medium"
                      name={name}
                      color={colorOf.get(name) || '#8A93A6'}
                      active={st !== 'none'}
                      onClick={() => toggle(name)}
                    />
                    {st === 'all' && <CheckRounded sx={{ fontSize: 16, color: 'text.secondary' }} titleAccess="On all" />}
                    {st === 'some' && <RemoveRounded sx={{ fontSize: 16, color: 'text.secondary' }} titleAccess="On some" />}
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save tags
        </Button>
      </DialogActions>
    </Dialog>
  );
}
