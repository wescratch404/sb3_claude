/**
 * useThumbnail.js — lazily reads a project's thumbnail from IndexedDB.
 *
 * Only cards that are actually rendered (the virtualized grid renders just the
 * visible rows) call this, and results are kept in a bounded LRU cache so
 * scrolling back and forth does not re-read the database.
 */
import { useEffect, useState } from 'react';
import { getThumbnail } from '../db/database.js';

const MAX_CACHE = 800;
const cache = new Map(); // id → dataURL | null
const inflight = new Map(); // id → Promise

function remember(id, value) {
  cache.delete(id);
  cache.set(id, value);
  if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

function load(id) {
  if (!inflight.has(id)) {
    inflight.set(
      id,
      getThumbnail(id)
        .catch(() => null)
        .then((v) => {
          remember(id, v || null);
          inflight.delete(id);
          return v || null;
        }),
    );
  }
  return inflight.get(id);
}

/** Forget a cached thumbnail (e.g. after a project is deleted or restored). */
export const invalidateThumbnail = (id) => cache.delete(id);
export const clearThumbnailCache = () => cache.clear();

/**
 * @param {string} id project id
 * @param {boolean} enabled false when the project is known to have no thumbnail
 * @returns {string|null|undefined} data URL, null (none), undefined (loading)
 */
export function useThumbnail(id, enabled = true) {
  const [src, setSrc] = useState(() => (enabled ? cache.get(id) : null));
  useEffect(() => {
    if (!enabled) {
      setSrc(null);
      return undefined;
    }
    if (cache.has(id)) {
      setSrc(cache.get(id));
      return undefined;
    }
    let alive = true;
    setSrc(undefined);
    load(id).then((v) => alive && setSrc(v));
    return () => {
      alive = false;
    };
  }, [id, enabled]);
  return src;
}
