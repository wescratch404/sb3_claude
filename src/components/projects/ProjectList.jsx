/**
 * ProjectList — compact, virtualized rows (react-window FixedSizeList).
 * Shows the file name and size by default; folder and date columns appear
 * when there is room. Column headers sort the list.
 */
import React, { memo, useMemo } from 'react';
import { FixedSizeList, areEqual } from 'react-window';
import { Box, ButtonBase, Checkbox, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import StarRounded from '@mui/icons-material/StarRounded';
import StarBorderRounded from '@mui/icons-material/StarBorderRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import MoreVertRounded from '@mui/icons-material/MoreVertRounded';
import { useElementSize } from '../../hooks/useElementSize.js';
import { formatBytes, formatShortDate } from '../../utils/format.js';

const ROW_H = 38;

/** Grid template shared by the header and rows. */
const columnsFor = (wide) =>
  wide ? '36px 28px minmax(0,1fr) 180px 90px 120px 76px' : '36px 28px minmax(0,1fr) 84px 76px';

const Row = memo(({ index, style, data }) => {
  const { items, selection, handlers, wide, folderLabel } = data;
  const p = items[index];
  const selected = selection.has(p.id);
  return (
    <Box
      style={style}
      role="row"
      aria-selected={selected}
      tabIndex={0}
      draggable
      onDragStart={(e) => handlers.onDragStart(e, p.id)}
      onClick={(e) => handlers.onSelect(e, p.id)}
      onDoubleClick={() => handlers.onRun(p.id)}
      onKeyDown={(e) => e.key === 'Enter' && handlers.onRun(p.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        handlers.onMenu(p, { left: e.clientX, top: e.clientY });
      }}
      sx={(t) => ({
        display: 'grid',
        gridTemplateColumns: columnsFor(wide),
        alignItems: 'center',
        px: 1,
        borderBottom: `1px solid ${t.palette.divider}`,
        bgcolor: selected ? alpha(t.palette.primary.main, t.palette.mode === 'light' ? 0.1 : 0.2) : 'transparent',
        opacity: p.archived ? 0.65 : 1,
        '&:hover': { bgcolor: selected ? undefined : t.palette.action.hover },
        '& .row-run': { opacity: 0 },
        '&:hover .row-run, &:focus-within .row-run': { opacity: 1 },
        '@media (hover: none)': { '& .row-run': { opacity: 1 } },
        outline: 'none',
        '&:focus-visible': { boxShadow: `inset 0 0 0 2px ${t.palette.primary.main}` },
      })}
    >
      <Checkbox
        size="small"
        checked={selected}
        onClick={(e) => e.stopPropagation()}
        onChange={() => handlers.onToggleCheck(p.id)}
        inputProps={{ 'aria-label': `Select ${p.name}` }}
        sx={{ p: 0.5 }}
      />
      <IconButton
        size="small"
        aria-label={p.favorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => {
          e.stopPropagation();
          handlers.onFavorite(p.id);
        }}
        sx={{ p: 0.25, color: p.favorite ? 'warning.main' : 'text.disabled' }}
      >
        {p.favorite ? <StarRounded sx={{ fontSize: 18 }} /> : <StarBorderRounded sx={{ fontSize: 18 }} />}
      </IconButton>
      <Typography variant="body2" noWrap title={p.fileName} sx={{ px: 1 }}>
        {p.name === p.fileName.replace(/\.sb3$/i, '') ? p.fileName : (
          <>
            {p.name}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {p.fileName}
            </Typography>
          </>
        )}
      </Typography>
      {wide && (
        <Typography variant="caption" color="text.secondary" noWrap sx={{ pr: 1 }}>
          {folderLabel(p.folderId) || 'Unfiled'}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', pr: 1 }}>
        {formatBytes(p.size)}
      </Typography>
      {wide && (
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right', pr: 1 }}>
          {formatShortDate(p.modifiedAt)}
        </Typography>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton
          className="row-run"
          size="small"
          aria-label={`Run ${p.name}`}
          onClick={(e) => {
            e.stopPropagation();
            handlers.onRun(p.id);
          }}
          sx={{ color: 'success.main' }}
        >
          <FlagRounded fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            handlers.onMenu(p, e.currentTarget);
          }}
        >
          <MoreVertRounded fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}, areEqual);

function HeaderCell({ label, sortKey, sort, onSort, align = 'left' }) {
  const active = !!sortKey && sort?.key === sortKey;
  const Arrow = sort?.dir === 'asc' ? ArrowUpwardRounded : ArrowDownwardRounded;
  if (!sortKey) {
    return (
      <Typography component="span" sx={{ px: 1, fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
    );
  }
  return (
    <ButtonBase
      onClick={() => onSort({ key: sortKey, dir: active && sort.dir === 'asc' ? 'desc' : 'asc' })}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      sx={{
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 0.5,
        px: 1,
        height: '100%',
        fontSize: 12,
        fontWeight: 600,
        color: active ? 'text.primary' : 'text.secondary',
        borderRadius: 1,
      }}
    >
      {label}
      {active && <Arrow sx={{ fontSize: 14 }} />}
    </ButtonBase>
  );
}

function ProjectList({ items, selection, handlers, sort, onSort, folderLabel, allSelected, onToggleAll }) {
  const [ref, { width, height }] = useElementSize();
  const wide = width > 760;
  const itemData = useMemo(
    () => ({ items, selection, handlers, wide, folderLabel }),
    [items, selection, handlers, wide, folderLabel],
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        role="row"
        sx={{
          display: 'grid',
          gridTemplateColumns: columnsFor(wide),
          alignItems: 'center',
          height: 34,
          px: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={!allSelected && selection.size > 0}
          onChange={onToggleAll}
          inputProps={{ 'aria-label': 'Select all' }}
          sx={{ p: 0.5 }}
        />
        <span />
        <HeaderCell label="Name" sortKey="name" sort={sort} onSort={onSort} />
        {wide && <HeaderCell label="Folder" />}
        <HeaderCell label="Size" sortKey="size" sort={sort} onSort={onSort} align="right" />
        {wide && <HeaderCell label="Modified" sortKey="modifiedAt" sort={sort} onSort={onSort} align="right" />}
        <span />
      </Box>
      <Box ref={ref} role="grid" aria-label="Projects" sx={{ flex: 1, minHeight: 0, bgcolor: 'background.paper' }}>
        {width > 0 && height > 0 && (
          <FixedSizeList itemCount={items.length} itemSize={ROW_H} width={width} height={height} itemData={itemData} overscanCount={8}>
            {Row}
          </FixedSizeList>
        )}
      </Box>
    </Box>
  );
}

export default memo(ProjectList);
