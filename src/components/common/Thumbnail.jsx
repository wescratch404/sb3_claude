/**
 * Thumbnail — shows a project's stage thumbnail, or a generated placeholder.
 *
 * The placeholder is pure CSS (no stored image): a soft two-tone stage tinted
 * with a hue derived from the project name, plus the project's initials. It
 * costs nothing to render thousands of them.
 */
import React from 'react';
import { Box, Skeleton } from '@mui/material';
import { useThumbnail } from '../../hooks/useThumbnail.js';
import { hashHue } from '../../utils/format.js';

function initials(name = '') {
  const words = name.replace(/[_\-.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export function Placeholder({ name }) {
  const hue = hashHue(name);
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background: `linear-gradient(160deg, hsl(${hue} 70% 88%) 0%, hsl(${(hue + 40) % 360} 65% 78%) 100%)`,
        color: `hsl(${hue} 45% 32%)`,
        fontWeight: 700,
        fontSize: 'clamp(16px, 16cqw, 44px)',
        letterSpacing: '0.02em',
      }}
    >
      {initials(name)}
    </Box>
  );
}

/** A 4:3 stage-shaped frame containing the thumbnail. */
export default function Thumbnail({ project, sx }) {
  const src = useThumbnail(project.id, project.hasThumbnail);
  return (
    <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', bgcolor: '#fff', containerType: 'inline-size', ...sx }}>
      {src === undefined ? (
        <Skeleton variant="rectangular" animation="wave" sx={{ position: 'absolute', inset: 0, height: '100%' }} />
      ) : src ? (
        <Box
          component="img"
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Placeholder name={project.name} />
      )}
    </Box>
  );
}
