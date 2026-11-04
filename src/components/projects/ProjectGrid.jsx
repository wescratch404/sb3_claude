/**
 * ProjectGrid — virtualized card grid (react-window FixedSizeGrid).
 *
 * Only the rows in (and just around) the viewport are mounted, so scrolling
 * through 5000+ projects stays smooth and only visible thumbnails are read
 * from IndexedDB. Column count adapts to the available width.
 */
import React, { forwardRef, memo, useMemo } from 'react';
import { FixedSizeGrid, areEqual } from 'react-window';
import { Box } from '@mui/material';
import ProjectCard from './ProjectCard.jsx';
import { useElementSize } from '../../hooks/useElementSize.js';

const MIN_CARD = 196; // px
const GAP = 14;
const PAD = 16;
const FOOTER = 66; // name row + tag/actions row

/** Pads the inner scroll area so the first row isn't glued to the toolbar. */
const Inner = forwardRef(({ style, ...rest }, ref) => (
  <div ref={ref} style={{ ...style, height: style.height + PAD * 2, position: 'relative' }} {...rest} />
));

const Cell = memo(({ columnIndex, rowIndex, style, data }) => {
  const { items, columns, cardW, handlers, selection, tagColors } = data;
  const index = rowIndex * columns + columnIndex;
  const project = items[index];
  if (!project) return null;
  return (
    <div
      style={{
        ...style,
        left: style.left + PAD,
        top: style.top + PAD,
        width: cardW,
        height: style.height - GAP,
      }}
    >
      <ProjectCard
        project={project}
        selected={selection.has(project.id)}
        showCheckbox={selection.size > 0}
        tagColors={tagColors}
        {...handlers}
      />
    </div>
  );
}, areEqual);

function ProjectGrid({ items, selection, handlers, tagColors }) {
  const [ref, { width, height }] = useElementSize();

  const layout = useMemo(() => {
    const usable = Math.max(0, width - PAD * 2);
    const columns = Math.max(1, Math.floor((usable + GAP) / (MIN_CARD + GAP)));
    const cardW = Math.floor((usable - GAP * (columns - 1)) / columns);
    const rowH = Math.round(cardW * 0.75) + FOOTER + GAP + 2;
    return { columns, cardW, rowH };
  }, [width]);

  const itemData = useMemo(
    () => ({ items, columns: layout.columns, cardW: layout.cardW, handlers, selection, tagColors }),
    [items, layout, handlers, selection, tagColors],
  );

  return (
    <Box ref={ref} role="grid" aria-label="Projects" sx={{ flex: 1, minHeight: 0 }}>
      {width > 0 && height > 0 && (
        <FixedSizeGrid
          columnCount={layout.columns}
          columnWidth={layout.cardW + GAP}
          rowCount={Math.ceil(items.length / layout.columns)}
          rowHeight={layout.rowH}
          width={width}
          height={height}
          itemData={itemData}
          innerElementType={Inner}
          overscanRowCount={2}
          style={{ overflowX: 'hidden' }}
        >
          {Cell}
        </FixedSizeGrid>
      )}
    </Box>
  );
}

export default memo(ProjectGrid);
