/**
 * database.js — a small promise-based wrapper around IndexedDB.
 *
 * Storage layout (one database, several object stores):
 *
 *   projects  keyPath "id"   Lightweight metadata only (no binary data), so the
 *                            whole library (5000+ rows) loads into memory fast.
 *   files     out-of-line    The raw .sb3 Blob for each project id. Read only
 *                            when a project is run, exported or backed up.
 *   thumbs    out-of-line    A small PNG data URL per project id. Read lazily
 *                            by cards as they scroll into view.
 *   folders   keyPath "id"   { id, name, parentId, createdAt }  (nestable)
 *   tags      keyPath "name" { name, color }
 *   settings  out-of-line    Arbitrary UI preferences (view mode, sort, …)
 *
 * Splitting binary data from metadata is the key performance decision:
 * listing, searching and sorting never touch the multi-megabyte blobs.
 */

const DB_NAME = 'sb3-library-manager';
const DB_VERSION = 1;

export const STORES = {
  projects: 'projects',
  files: 'files',
  thumbs: 'thumbs',
  folders: 'folders',
  tags: 'tags',
  settings: 'settings',
};

let dbPromise = null;

/** Open (and on first run, create) the database. Memoized. */
export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support IndexedDB, so the library cannot be stored.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.projects)) {
        const s = db.createObjectStore(STORES.projects, { keyPath: 'id' });
        s.createIndex('folderId', 'folderId');
        s.createIndex('fingerprint', 'fingerprint');
      }
      if (!db.objectStoreNames.contains(STORES.files)) db.createObjectStore(STORES.files);
      if (!db.objectStoreNames.contains(STORES.thumbs)) db.createObjectStore(STORES.thumbs);
      if (!db.objectStoreNames.contains(STORES.folders)) db.createObjectStore(STORES.folders, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORES.tags)) db.createObjectStore(STORES.tags, { keyPath: 'name' });
      if (!db.objectStoreNames.contains(STORES.settings)) db.createObjectStore(STORES.settings);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('The library database is open in another tab with an older version. Close other tabs and reload.'));
  });
  return dbPromise;
}

/** Wrap an IDBRequest in a promise. */
const promisify = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Resolve when a transaction commits (or reject when it aborts). */
const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Transaction aborted'));
  });

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

export async function getAll(store) {
  const db = await openDB();
  return promisify(db.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const db = await openDB();
  return promisify(db.transaction(store).objectStore(store).get(key));
}

/** Put one value. Pass `key` only for out-of-line stores. */
export async function put(store, value, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  if (key === undefined) tx.objectStore(store).put(value);
  else tx.objectStore(store).put(value, key);
  return done(tx);
}

/** Put many inline-keyed values in a single transaction (fast bulk writes). */
export async function putMany(store, values) {
  if (!values.length) return;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  return done(tx);
}

export async function remove(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  return done(tx);
}

export async function removeMany(store, keys) {
  if (!keys.length) return;
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  keys.forEach((k) => tx.objectStore(store).delete(k));
  return done(tx);
}

export async function clearAll() {
  const db = await openDB();
  const names = Object.values(STORES);
  const tx = db.transaction(names, 'readwrite');
  names.forEach((n) => tx.objectStore(n).clear());
  return done(tx);
}

/* ------------------------------------------------------------------ */
/* Project-specific helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Store a freshly imported project: metadata, file blob and thumbnail are
 * written atomically so a crash never leaves half a project behind.
 */
export async function addProject(meta, blob, thumbDataUrl) {
  const db = await openDB();
  const tx = db.transaction([STORES.projects, STORES.files, STORES.thumbs], 'readwrite');
  tx.objectStore(STORES.projects).put(meta);
  tx.objectStore(STORES.files).put(blob, meta.id);
  if (thumbDataUrl) tx.objectStore(STORES.thumbs).put(thumbDataUrl, meta.id);
  return done(tx);
}

/** Delete projects and all their binary data. */
export async function deleteProjects(ids) {
  if (!ids.length) return;
  const db = await openDB();
  const tx = db.transaction([STORES.projects, STORES.files, STORES.thumbs], 'readwrite');
  for (const id of ids) {
    tx.objectStore(STORES.projects).delete(id);
    tx.objectStore(STORES.files).delete(id);
    tx.objectStore(STORES.thumbs).delete(id);
  }
  return done(tx);
}

export const getProjectFile = (id) => get(STORES.files, id);
export const getThumbnail = (id) => get(STORES.thumbs, id);

/** Read every key/value of an out-of-line store (used by backups). */
export async function getAllEntries(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const out = [];
    const req = db.transaction(store).objectStore(store).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return resolve(out);
      out.push([cursor.key, cursor.value]);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const getSetting = (key) => get(STORES.settings, key);
export const setSetting = (key, value) => put(STORES.settings, value, key);
