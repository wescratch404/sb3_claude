/**
 * ProjectMenu — the "more actions" / right-click menu for a project.
 * When the clicked project is part of a multi-selection, actions apply to the
 * whole selection (like a desktop file manager).
 */
import React from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DriveFileMoveRounded from '@mui/icons-material/DriveFileMoveRounded';
import LocalOfferRounded from '@mui/icons-material/LocalOfferRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded';
import ArchiveRounded from '@mui/icons-material/ArchiveRounded';
import UnarchiveRounded from '@mui/icons-material/UnarchiveRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { useLibrary } from '../../state/LibraryContext.jsx';
import { useProjectCommands } from '../../hooks/useProjectCommands.js';

export default function ProjectMenu({ project, anchor, onClose }) {
  const { state } = useLibrary();
  const cmd = useProjectCommands();
  if (!project) return null;

  const inSelection = state.selection.has(project.id) && state.selection.size > 1;
  const ids = inSelection ? [...state.selection] : [project.id];
  const n = ids.length;
  const suffix = inSelection ? ` (${n})` : '';
  const act = (fn) => () => {
    onClose();
    fn();
  };

  // `anchor` is either a DOM element or a {left, top} point (right-click).
  const anchorProps = anchor?.nodeType
    ? { anchorEl: anchor }
    : { anchorReference: 'anchorPosition', anchorPosition: anchor ? { left: anchor.left, top: anchor.top } : undefined };

  return (
    <Menu open={!!anchor} onClose={onClose} {...anchorProps} onClick={(e) => e.stopPropagation()}>
      {!inSelection && (
        <MenuItem onClick={act(() => cmd.run(project.id))}>
          <ListItemIcon><PlayArrowRounded fontSize="small" sx={{ color: 'success.main' }} /></ListItemIcon>
          <ListItemText>Run</ListItemText>
        </MenuItem>
      )}
      {!inSelection && (
        <MenuItem onClick={act(() => cmd.rename(project))}>
          <ListItemIcon><EditRounded fontSize="small" /></ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
      )}
      <MenuItem onClick={act(() => cmd.move(ids))}>
        <ListItemIcon><DriveFileMoveRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Move to folder{suffix}</ListItemText>
      </MenuItem>
      <MenuItem onClick={act(() => cmd.editTags(ids))}>
        <ListItemIcon><LocalOfferRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Edit tags{suffix}</ListItemText>
      </MenuItem>
      <MenuItem onClick={act(() => cmd.setFavorite(ids, !project.favorite))}>
        <ListItemIcon>
          {project.favorite ? <StarBorderRounded fontSize="small" /> : <StarRounded fontSize="small" sx={{ color: 'warning.main' }} />}
        </ListItemIcon>
        <ListItemText>{project.favorite ? 'Remove from favorites' : 'Add to favorites'}{suffix}</ListItemText>
      </MenuItem>
      <MenuItem onClick={act(() => cmd.exportFiles(ids))}>
        <ListItemIcon><FileDownloadRounded fontSize="small" /></ListItemIcon>
        <ListItemText>Export{suffix}</ListItemText>
      </MenuItem>
      <MenuItem onClick={act(() => cmd.archive(ids, !project.archived))}>
        <ListItemIcon>{project.archived ? <UnarchiveRounded fontSize="small" /> : <ArchiveRounded fontSize="small" />}</ListItemIcon>
        <ListItemText>{project.archived ? 'Restore from archive' : 'Archive'}{suffix}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem onClick={act(() => cmd.remove(ids))} sx={{ color: 'error.main' }}>
        <ListItemIcon><DeleteRounded fontSize="small" color="error" /></ListItemIcon>
        <ListItemText>Delete{suffix}</ListItemText>
      </MenuItem>
    </Menu>
  );
}
