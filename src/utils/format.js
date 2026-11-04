/**
 * format.js — small, dependency-free formatting and id helpers.
 */

/** Human-readable byte size: 1536 → "1.5 KB". */
export function formatBytes(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const shortFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

export const formatDate = (ts) => (ts ? dateFmt.format(new Date(ts)) : '—');
export const formatShortDate = (ts) => (ts ? shortFmt.format(new Date(ts)) : '—');

/** "3 minutes ago" style relative time. */
export function timeAgo(ts) {
  if (!ts) return 'never';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps = [
    [60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year'],
  ];
  let v = (Date.now() - ts) / 1000;
  for (const [div, unit] of steps) {
    if (Math.abs(v) < div) return rtf.format(-Math.round(v), unit);
    v /= div;
  }
  return '';
}

/** Collision-resistant id (uses crypto.randomUUID where available). */
export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Strip the extension from a file name. */
export const baseName = (name = '') => name.replace(/\.sb3$/i, '');

/** Deterministic small hash of a string → 0..359 (used for placeholder hues). */
export function hashHue(str = '') {
  // FNV-1a with a final avalanche step, so names that differ by one
  // character ("Demo 1", "Demo 2") still get clearly different hues.
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) % 360;
}

/** Yield to the browser so long loops don't freeze the UI. */
export const nextFrame = () => new Promise((r) => setTimeout(r, 0));
