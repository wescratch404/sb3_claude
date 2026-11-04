/**
 * BulkActionBar — appears when projects are selected. Move, tag, favourite,
 * export, archive or delete the whole selection at once.
 */
import React from 'react';
import { Box, Button, Divider, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseRounded from '@mui/icons-material/CloseRounded';
import DriveFileMoveRounded from '@mui/icons-material/DriveFileMoveRounded';
import LocalOfferRounded from '@mui/icons-material/LocalOfferRounded';
import LabelOffRounded from '@mui/icons-material/LabelOffRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded';
import ArchiveRounded from '@mui/icons-material/ArchiveRounded';
import UnarchiveRounded from '@mui/icons-material/UnarchiveRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import SelectAllRounded from '@mui/icons-material/SelectAllRounded';
import { useProjectCommands } from '../../hooks/useProjectCommands.js';

export default function BulkActionBar({ ids, allArchived, visibleCount, onSelectAll, onClear }) {
  const cmd = useProjectCommands();
  const n = ids.length;
  const actions = [
    { label: 'Move', icon: <DriveFileMoveRounded />, run: () => cmd.move(ids) },
    { label: 'Add tags', icon: <LocalOfferRounded />, run: () => cmd.editTags(ids, 'edit') },
    { label: 'Remove tags', icon: <LabelOffRounded />, run: () => cmd.editTags(ids, 'remove') },
    { label: 'Favorite', icon: <StarRounded />, run: () => cmd.setFavorite(ids, true) },
    { label: 'Export', icon: <FileDownloadRounded />, run: () => cmd.exportFiles(ids) },
    allArchived
      ? { label: 'Restore', icon: <UnarchiveRounded />, run: () => cmd.archive(ids, false) }
      : { label: 'Archive', icon: <ArchiveRounded />, run: () => cmd.archive(ids, true) },
  ];
  return (
    <Box
      role="toolbar"
      aria-label="Selected projects"
      sx={(t) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        mx: 2,
        mt: 1,
        borderRadius: 2,
        bgcolor: alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.1 : 0.2),
        border: `1px solid ${alpha(t.palette.primary.main, 0.35)}`,
        overflowX: 'auto',
        flexShrink: 0,
      })}
    >
      <Tooltip title="Clear selection (Esc)">
        <IconButton size="small" onClick={onClear} aria-label="Clear selection">
          <CloseRounded fontSize="small" />
        </IconButton>
      </Tooltip>
      <Typography variant="body2" fontWeight={600} sx={{ px: 0.5, whiteSpace: 'nowrap' }}>
        {n} selected
      </Typography>
      {n < visibleCount && (
        <Button size="small" startIcon={<SelectAllRounded />} onClick={onSelectAll} sx={{ whiteSpace: 'nowrap' }}>
          Select all {visibleCount}
        </Button>
      )}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {actions.map((a) => (
        <Button key={a.label} size="small" color="inherit" startIcon={a.icon} onClick={a.run} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
          {a.label}
        </Button>
      ))}
      <Box sx={{ flex: 1 }} />
      <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => cmd.remove(ids)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
        Delete
      </Button>
    </Box>
  );
}
