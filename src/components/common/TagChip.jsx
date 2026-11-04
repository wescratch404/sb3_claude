/**
 * TagChip — a tag rendered like a small Scratch block: flat category colour,
 * a darker bottom edge, and a little "notch" on top. Reused in cards, the
 * details panel, the sidebar and dialogs.
 */
import React from 'react';
import { Box, ButtonBase } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';

/** Pick readable text (dark on yellows/oranges, white otherwise). */
function textOn(hex = '#888888') {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 170 ? '#2A2205' : '#FFFFFF';
}

export default function TagChip({ name, count, color = '#8A93A6', size = 'small', onClick, onDelete, active, sx }) {
  const small = size === 'small';
  const content = (
    <Box
      component="span"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        maxWidth: '100%',
        px: small ? 0.75 : 1,
        py: small ? '1px' : '3px',
        fontSize: small ? 11 : 12.5,
        fontWeight: 500,
        lineHeight: 1.5,
        color: textOn(color),
        bgcolor: color,
        borderRadius: '4px',
        boxShadow: `inset 0 -2px 0 rgba(0,0,0,0.18)${active ? ', 0 0 0 2px var(--tag-ring)' : ''}`,
        whiteSpace: 'nowrap',
        // The Scratch-block notch.
        '&::before': {
          content: '""',
          position: 'absolute',
          top: -2,
          left: small ? 7 : 9,
          width: small ? 8 : 10,
          height: 3,
          borderRadius: '2px 2px 0 0',
          bgcolor: color,
        },
        ...sx,
      }}
    >
      <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {name}
      </Box>
      {count != null && (
        <Box component="span" sx={{ opacity: 0.75, fontWeight: 400 }}>
          {count}
        </Box>
      )}
      {onDelete && (
        <ButtonBase
          aria-label={`Remove tag ${name}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          sx={{ borderRadius: '50%', color: 'inherit', opacity: 0.8, '&:hover': { opacity: 1 } }}
        >
          <CloseRounded sx={{ fontSize: small ? 12 : 14 }} />
        </ButtonBase>
      )}
    </Box>
  );
  if (!onClick) return content;
  return (
    <ButtonBase onClick={onClick} sx={{ borderRadius: '4px', mt: '2px' }} aria-pressed={active ? 'true' : 'false'}>
      {content}
    </ButtonBase>
  );
}
