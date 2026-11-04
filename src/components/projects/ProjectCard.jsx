/**
 * ProjectCard — one project in the grid view.
 *
 * The thumbnail sits in a stage-shaped (4:3) frame. Hovering (or focusing)
 * reveals a green-flag Run button over the stage, echoing Scratch's own
 * player, plus Rename and Delete buttons. On touch screens those controls are
 * always visible. The card is draggable onto sidebar folders.
 */
import React, { memo } from 'react';
import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import FlagRounded from '@mui/icons-material/FlagRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import Thumbnail from '../common/Thumbnail.jsx';
import TagChip from '../common/TagChip.jsx';

function ProjectCard({
  project, selected, showCheckbox, tagColors,
  onSelect, onToggleCheck, onRun, onRename, onDelete, onFavorite, onMenu, onDragStart,
}) {
  const tags = project.tags || [];
  return (
    <Box
      role="gridcell"
      aria-selected={selected}
      tabIndex={0}
      draggable
      onDragStart={(e) => onDragStart(e, project.id)}
      onClick={(e) => onSelect(e, project.id)}
      onDoubleClick={() => onRun(project.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onRun(project.id);
        if (e.key === ' ') {
          e.preventDefault();
          onToggleCheck(project.id);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(project, { left: e.clientX, top: e.clientY });
      }}
      sx={(t) => ({
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '10px',
        overflow: 'hidden',
        cursor: 'default',
        bgcolor: 'background.paper',
        border: `1px solid ${selected ? t.palette.primary.main : t.palette.divider}`,
        boxShadow: selected ? `0 0 0 2px ${alpha(t.palette.primary.main, 0.35)}` : 'none',
        opacity: project.archived ? 0.7 : 1,
        '& .card-reveal': { opacity: 0, transition: 'opacity 120ms' },
        '&:hover .card-reveal, &:focus-within .card-reveal': { opacity: 1 },
        '@media (hover: none)': { '& .card-reveal': { opacity: 1 } },
        outline: 'none',
        '&:focus-visible': { borderColor: t.palette.primary.main },
      })}
    >
      {/* Stage */}
      <Box sx={{ position: 'relative', borderBottom: 1, borderColor: 'divider' }}>
        <Thumbnail project={project} />
        <Box
          className={showCheckbox || selected ? undefined : 'card-reveal'}
          sx={{ position: 'absolute', top: 4, left: 4 }}
        >
          <Checkbox
            size="small"
            checked={selected}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onToggleCheck(project.id)}
            inputProps={{ 'aria-label': `Select ${project.name}` }}
            sx={{ p: 0.5, bgcolor: 'rgba(255,255,255,0.85)', borderRadius: 1, '&:hover': { bgcolor: '#fff' } }}
          />
        </Box>
        <Tooltip title="Run">
          <IconButton
            className="card-reveal"
            aria-label={`Run ${project.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onRun(project.id);
            }}
            sx={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 40,
              height: 40,
              bgcolor: 'success.main',
              color: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              '&:hover': { bgcolor: 'success.dark' },
            }}
          >
            <FlagRounded />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 1.25, pt: 0.75, pb: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5, minHeight: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" fontWeight={500} noWrap title={project.name} sx={{ flex: 1, minWidth: 0 }}>
            {project.name}
          </Typography>
          <IconButton
            size="small"
            aria-label={project.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={(e) => {
              e.stopPropagation();
              onFavorite(project.id);
            }}
            className={project.favorite ? undefined : 'card-reveal'}
            sx={{ p: 0.25, color: project.favorite ? 'warning.main' : 'text.secondary' }}
          >
            {project.favorite ? <StarRounded fontSize="small" /> : <StarBorderRounded fontSize="small" />}
          </IconButton>
        </Box>
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 24 }}>
          <Box sx={{ display: 'flex', gap: 0.5, flex: 1, minWidth: 0, overflow: 'hidden', pt: '2px' }}>
            {tags.slice(0, 2).map((t) => (
              <TagChip key={t} name={t} color={tagColors.get(t)} sx={{ maxWidth: 'calc(50% - 16px)', flexShrink: 0 }} />
            ))}
            {tags.length > 2 && (
              <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                +{tags.length - 2}
              </Typography>
            )}
          </Box>
          {/* Overlays the tags on hover instead of permanently taking their space. */}
          <Box className="card-reveal" sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', pl: 1, bgcolor: 'background.paper', boxShadow: (t) => `-8px 0 8px ${t.palette.background.paper}` }}>
            <Tooltip title="Rename">
              <IconButton size="small" aria-label="Rename" onClick={(e) => { e.stopPropagation(); onRename(project); }} sx={{ p: 0.4 }}>
                <EditRounded sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" aria-label="Delete" onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} sx={{ p: 0.4 }}>
                <DeleteOutlineRounded sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="More actions">
              <IconButton size="small" aria-label="More actions" onClick={(e) => { e.stopPropagation(); onMenu(project, e.currentTarget); }} sx={{ p: 0.4 }}>
                <MoreVertRounded sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

export default memo(ProjectCard);
