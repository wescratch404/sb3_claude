/**
 * folders.js — pure helpers for the nested folder tree.
 */

/** Build { byId, children(parentId) , pathOf(id) } lookups from a flat list. */
export function buildFolderIndex(folders) {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const kids = new Map();
  for (const f of folders) {
    const key = f.parentId || null;
    if (!kids.has(key)) kids.set(key, []);
    kids.get(key).push(f);
  }
  for (const list of kids.values()) list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const pathCache = new Map();
  const pathOf = (id) => {
    if (!id) return [];
    if (pathCache.has(id)) return pathCache.get(id);
    const out = [];
    const guard = new Set();
    for (let f = byId.get(id); f && !guard.has(f.id); f = byId.get(f.parentId)) {
      guard.add(f.id);
      out.unshift(f);
    }
    pathCache.set(id, out);
    return out;
  };

  return {
    byId,
    children: (parentId) => kids.get(parentId || null) || [],
    pathOf,
    /** "Tutorials / Beginner" */
    pathLabel: (id) => pathOf(id).map((f) => f.name).join(' / '),
    /** Folders in depth-first order with their depth (for menus). */
    flatten: () => {
      const out = [];
      const walk = (parentId, depth) => {
        for (const f of kids.get(parentId) || []) {
          out.push({ folder: f, depth });
          walk(f.id, depth + 1);
        }
      };
      walk(null, 0);
      return out;
    },
  };
}
