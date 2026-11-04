/**
 * useElementSize.js — tracks an element's content size with ResizeObserver.
 * The virtualized grid/list need real pixel dimensions to lay out rows.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useElementSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observer = useRef(null);
  const ref = useCallback((node) => {
    observer.current?.disconnect();
    if (!node) return;
    observer.current = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
    });
    observer.current.observe(node);
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, size];
}
