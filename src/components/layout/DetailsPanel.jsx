/**
 * DetailsPanel — right-hand panel for the selected project.
 * Shows the stage preview, folder, tags, file facts and project statistics,
 * and lets the user edit the description and notes (saved automatically).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Divider, IconButton, Link, TextField, Tooltip, Typography } from '@mui/material';
import FlagRounded from '@mui/icons-material/FlagRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded';
import ArchiveRounded from '@mui/icons-material/ArchiveRounded';
import UnarchiveRounded from '@mui/icons-material/UnarchiveRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useFolderIndex } from '../../hooks/useVisibleProjects.js';
import { useProjectCommands } from '../../hooks/useProjectCommands.js';
import { VIEWS } from '../../state/constants.js';
import Thumbnail from '../common/Thumbnail.jsx';
import TagChip from '../common/TagChip.jsx';
import { formatBytes, formatDate, timeAgo } from '../../utils/format.js';

/** Text field that saves itself shortly after the user stops typing. */
function AutoSaveField({ projectId, field, value, label, placeholder, minRows }) {
  const { actions } = useLibrary();
  const [text, setText] = useState(value || '');
  const [status, setStatus] = useState('');
  const timer = useRef();
  const latest = useRef({ projectId, text: value || '', dirty: false });

  // Reset when switching projects; flush pending edits of the previous one.
  useEffect(() => {
    setText(value || '');
    setStatus('');
    latest.current = { projectId, text: value || '', dirty: false };
    return () => {
      clearTimeout(timer.current);
      if (latest.current.dirty) actions.setNotes(latest.current.projectId, { [field]: latest.current.text });
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (e) => {
    const v = e.target.value;
    setText(v);
    setStatus('Editing…');
    latest.current = { projectId, text: v, dirty: true };
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await actions.setNotes(projectId, { [field]: v });
      latest.current.dirty = false;
      setStatus('Saved');
    }, 600);
  };

  return (
    <TextField
      fullWidth
      multiline
      minRows={minRows}
      maxRows={12}
      size="small"
      label={label}
      placeholder={placeholder}
      value={text}
      onChange={onChange}
      helperText={status || ' '}
    />
  );
}

function Fact({ label, children }) {
  return (
    <>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>{children}</Typography>
    </>
  );
}

export default function DetailsPanel({ onClose }) {
  const { state, actions } = useLibrary();
  const folderIndex = useFolderIndex();
  const cmd = useProjectCommands();
  const tagColors = useMemo(() => new Map(state.tags.map((t) => [t.name, t.color])), [state.tags]);
  const project = state.projects.find((p) => p.id === state.activeId);

  const header = onClose && (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 0.5 }}>
      <IconButton aria-label="Close details" onClick={onClose}><CloseRounded /></IconButton>
    </Box>
  );

  if (state.selection.size > 1) {
    return (
      <Box sx={{ p: 2 }}>
        {header}
        <Typography variant="h6">{state.selection.size} projects selected</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Use the bar above the projects to move, tag, export, archive or delete them together. Ctrl/⌘-click adds or removes one project; Shift-click selects a range.
        </Typography>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 2 }}>
        {header}
        <Typography variant="h6" gutterBottom>Project details</Typography>
        <Typography variant="body2" color="text.secondary">
          Select a project to see its folder, tags, size and notes. Double-click a project, or press Enter, to run it.
        </Typography>
      </Box>
    );
  }

  const info = project.info || {};
  const folderPath = folderIndex.pathOf(project.folderId);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {header}
      <Box sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', position: 'relative' }}>
        <Thumbnail project={project} />
      </Box>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <Typography variant="h6" component="h2" sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.3 }}>
            {project.name}
          </Typography>
          <Tooltip title="Rename">
            <IconButton size="small" onClick={() => cmd.rename(project)} aria-label="Rename"><EditRounded fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title={project.favorite ? 'Remove from favorites' : 'Add to favorites'}>
            <IconButton size="small" onClick={() => cmd.toggleFavorite(project.id)} aria-label="Favorite" sx={{ color: project.favorite ? 'warning.main' : 'text.secondary' }}>
              {project.favorite ? <StarRounded fontSize="small" /> : <StarBorderRounded fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{project.fileName}</Typography>
      </Box>

      <Button variant="contained" color="success" size="large" startIcon={<FlagRounded />} onClick={() => cmd.run(project.id)}>
        Run project
      </Button>

      {/* Folder */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Folder</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
            {folderPath.length ? (
              folderPath.map((f, i) => (
                <React.Fragment key={f.id}>
                  {i > 0 && ' / '}
                  <Link component="button" underline="hover" onClick={() => actions.navigate({ type: VIEWS.folder, folderId: f.id })}>
                    {f.name}
                  </Link>
                </React.Fragment>
              ))
            ) : (
              'Unfiled'
            )}
          </Typography>
          <Button size="small" onClick={() => cmd.move([project.id])}>Change</Button>
        </Box>
      </Box>

      {/* Tags */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Tags</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
          {(project.tags || []).map((t) => (
            <TagChip key={t} name={t} color={tagColors.get(t)} size="medium" onDelete={() => actions.removeTags([project.id], [t])} />
          ))}
          <Button size="small" startIcon={<AddRounded />} onClick={() => cmd.editTags([project.id])}>
            {project.tags?.length ? 'Edit' : 'Add tags'}
          </Button>
        </Box>
      </Box>

      <AutoSaveField projectId={project.id} field="description" value={project.description} label="Description" placeholder="What does this project show or teach?" minRows={2} />
      <AutoSaveField projectId={project.id} field="notes" value={project.notes} label="Notes" placeholder="Ideas, to-dos, video script links…" minRows={3} />

      <Divider />

      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, alignItems: 'baseline' }}>
        <Fact label="File size">{formatBytes(project.size)}</Fact>
        <Fact label="Modified">{formatDate(project.modifiedAt)}</Fact>
        <Fact label="Imported">{formatDate(project.importedAt)}</Fact>
        <Fact label="Last opened">{project.lastOpenedAt ? timeAgo(project.lastOpenedAt) : 'Never'}</Fact>
        <Fact label="Times opened">{project.openCount || 0}</Fact>
        <Fact label="Sprites">{info.sprites ?? '—'}</Fact>
        <Fact label="Blocks">{info.blocks?.toLocaleString() ?? '—'}</Fact>
        <Fact label="Costumes / sounds">{info.costumes ?? 0} / {info.sounds ?? 0}</Fact>
        {info.extensions?.length > 0 && <Fact label="Extensions">{info.extensions.join(', ')}</Fact>}
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" startIcon={<FileDownloadRounded />} onClick={() => cmd.exportFiles([project.id])}>Export .sb3</Button>
        <Button size="small" startIcon={project.archived ? <UnarchiveRounded /> : <ArchiveRounded />} onClick={() => cmd.archive([project.id], !project.archived)}>
          {project.archived ? 'Restore' : 'Archive'}
        </Button>
        <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} onClick={() => cmd.remove([project.id])}>Delete</Button>
      </Box>
    </Box>
  );
}
