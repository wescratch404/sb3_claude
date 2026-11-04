/**
 * Charts.jsx — tiny dependency-free charts built from divs, themed with MUI.
 * HBarChart: labelled horizontal bars. ColumnChart: a time series of columns.
 */
import React from 'react';
import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';

export function HBarChart({ data, emptyText = 'No data yet.', onSelect }) {
  if (!data.length) return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.75 }}>
      {data.map((d) => (
        <Box component="li" key={d.key ?? d.label}>
          <ButtonBase
            onClick={onSelect ? () => onSelect(d) : undefined}
            disabled={!onSelect}
            sx={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 34%) 1fr 48px', alignItems: 'center', gap: 1, width: '100%', borderRadius: 1, textAlign: 'left', py: 0.25 }}
          >
            <Typography variant="body2" noWrap title={d.label}>{d.label}</Typography>
            <Box sx={{ height: 14, bgcolor: 'action.hover', borderRadius: '3px', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', width: `${(d.value / max) * 100}%`, minWidth: d.value ? 3 : 0, bgcolor: d.color || 'primary.main', borderRadius: '3px' }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>{d.value.toLocaleString()}</Typography>
          </ButtonBase>
        </Box>
      ))}
    </Box>
  );
}

export function ColumnChart({ data, height = 120 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height }} role="img" aria-label="Imports per day for the last 30 days">
        {data.map((d) => (
          <Tooltip key={d.label} title={`${d.label}: ${d.value} imported`}>
            <Box
              sx={{
                flex: 1,
                // Pixel heights: percentage heights are unreliable inside tooltip wrappers.
                height: d.value ? Math.max(3, Math.round((d.value / max) * height)) : 2,
                alignSelf: 'flex-end',
                bgcolor: d.value ? 'primary.main' : 'divider',
                borderRadius: '2px 2px 0 0',
              }}
            />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{data[0]?.label}</Typography>
        <Typography variant="caption" color="text.secondary">Today</Typography>
      </Box>
    </Box>
  );
}
