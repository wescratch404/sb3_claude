/**
 * server/index.js — optional Node.js backend for Scratch SB3 Library Manager.
 *
 * The app itself is local-first: projects live in the browser's IndexedDB and
 * run in the embedded TurboWarp player, so no server is required. This small
 * Express server adds two things when you run the app yourself:
 *
 *  1. Serves the production build (`npm run build` → /dist) with sensible
 *     caching headers.
 *  2. Exposes a read-only "server library folder" (LIBRARY_DIR) so a folder of
 *     .sb3 files on this machine or NAS can be imported in one click from the
 *     Import menu, without picking files in the browser.
 *
 * Usage:
 *   npm run build
 *   LIBRARY_DIR=~/ScratchProjects PORT=5174 npm start
 *
 * Security: file access is confined to LIBRARY_DIR (paths are resolved and
 * checked against it), only *.sb3 files are listed or served, and the server
 * binds to localhost unless HOST is set.
 */
import express from 'express';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || '127.0.0.1';
const expandHome = (p) => (p && p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);
const LIBRARY_DIR = process.env.LIBRARY_DIR ? path.resolve(expandHome(process.env.LIBRARY_DIR)) : null;
const MAX_FILES = 20000;

const app = express();
app.disable('x-powered-by');

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({ app: 'sb3-library-manager', ok: true, libraryDir: LIBRARY_DIR ? path.basename(LIBRARY_DIR) : null, hasLibrary: !!LIBRARY_DIR });
});

/** Recursively list .sb3 files under LIBRARY_DIR (relative paths). */
async function walk(dir, base, out) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable folder: skip it
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) return;
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, base, out);
    else if (entry.isFile() && /\.sb3$/i.test(entry.name)) {
      const st = await fs.stat(full);
      out.push({
        path: path.relative(base, full).split(path.sep).join('/'),
        name: entry.name,
        size: st.size,
        mtime: Math.round(st.mtimeMs),
      });
    }
  }
}

app.get('/api/library', async (_req, res) => {
  if (!LIBRARY_DIR) return res.status(404).json({ error: 'No LIBRARY_DIR configured on the server.' });
  const files = [];
  await walk(LIBRARY_DIR, LIBRARY_DIR, files);
  files.sort((a, b) => a.path.localeCompare(b.path));
  res.json({ root: path.basename(LIBRARY_DIR), files });
});

app.get('/api/library/file', async (req, res) => {
  if (!LIBRARY_DIR) return res.status(404).end();
  const rel = String(req.query.path || '');
  const full = path.resolve(LIBRARY_DIR, rel);
  // Refuse anything outside the library folder or that isn't an .sb3.
  if (!full.startsWith(LIBRARY_DIR + path.sep) || !/\.sb3$/i.test(full)) return res.status(400).json({ error: 'Invalid path' });
  try {
    const st = await fs.stat(full);
    res.setHeader('Content-Type', 'application/x.scratch.sb3');
    res.setHeader('Content-Length', st.size);
    res.setHeader('Last-Modified', st.mtime.toUTCString());
    createReadStream(full).pipe(res);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

/* ------------------------------------------------------------------ */
/* Static app                                                          */
/* ------------------------------------------------------------------ */

// Hashed assets can be cached forever; index.html must always revalidate.
app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(DIST, { index: false }));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(DIST, 'index.html'), (err) => {
    if (err) res.status(500).send('Build not found. Run "npm run build" first.');
  });
});

app.listen(PORT, HOST, () => {
  console.log(`SB3 Library Manager → http://${HOST}:${PORT}`);
  console.log(LIBRARY_DIR ? `Server library folder: ${LIBRARY_DIR}` : 'No LIBRARY_DIR set (server-folder import disabled).');
});
