# Scratch SB3 Library Manager

Organize, browse, preview and run large local collections of Scratch `.sb3`
projects. Built for libraries of hundreds to thousands of projects
(tested with 6,000: loads in about 0.6 s, searches in about 0.3 s).

## Quick start

```bash
npm install
npm run dev                 # development server on http://localhost:5173
```

Production, with the optional Node server:

```bash
npm run build
LIBRARY_DIR=~/ScratchProjects npm start   # http://127.0.0.1:5174
```

`LIBRARY_DIR` is optional. When set, the Import menu gains
"From server library folder…", which imports every `.sb3` under that folder
in one go, keeping its sub-folder structure.

Single self-contained HTML file (offline use, static hosting):

```bash
npm run build:single        # → dist-single/index.html
```

## Features

- **Import**: single files, many files, whole folders (File System Access API
  with a `webkitdirectory` fallback), drag and drop of files or folders.
  Dropped folder structures become nested library folders. Duplicates are
  skipped; unreadable files are reported.
- **Thumbnails**: `.sb3` files carry no screenshot, so the first stage frame is
  rebuilt from the archive: backdrop plus visible sprites at their saved
  position, size, direction and layer. Projects without drawable costumes get
  a generated placeholder.
- **Grid and list views**: virtualized (react-window), multi-select with
  Ctrl/⌘-click and Shift-click, sortable list columns.
- **Folders**: nested; create, rename, move (drag a folder onto another),
  delete (projects move to Unfiled, never deleted).
- **Tags**: Scratch block-category colours, multi-tag filtering (AND),
  bulk add/remove, recolour and delete from the sidebar.
- **Run**: embedded TurboWarp player (Scaffolding, pinned to 3.13.0) loads the
  `.sb3` straight from IndexedDB. Green flag, stop, turbo, FPS counter,
  fullscreen. Cloud variables are stored locally per project.
- **Details panel**: name, thumbnail, folder, tags, size, dates, sprite/block
  counts, extensions, auto-saving description and notes.
- **Search**: global and instant across names, file names, folder paths, tags,
  notes and descriptions.
- **Bulk operations**: move, add/remove tags, favourite, export (.zip), archive,
  delete.
- **Favourites, Recently opened, Most opened, Archive** smart views.
- **Statistics**: totals, storage use (library and browser quota), projects per
  folder and per tag, imports over 30 days, recent and most-opened lists.
- **Backup**: metadata JSON export/import (matched by id or file fingerprint),
  full backup `.zip` (metadata + every `.sb3` + thumbnails), restore by merge
  or replace.

## Keyboard

| Key | Action |
| --- | --- |
| `/` or Ctrl/⌘+K | Focus search |
| Ctrl/⌘+A | Select all visible projects |
| Enter / double-click | Run project |
| F2 | Rename selected project |
| Delete | Delete selection (with confirmation) |
| Esc | Clear search or selection |

## Architecture

```
server/index.js            Optional Express server: static hosting + LIBRARY_DIR API
src/
  main.jsx                 Providers: theme → library state → dialogs → App
  App.jsx                  Layout shell, drag-drop overlay, shortcuts, toasts
  theme.js                 MUI theme (light + dark)
  db/database.js           IndexedDB wrapper; metadata, blobs and thumbnails in separate stores
  services/
    sb3Parser.js           JSZip parsing, stats, stage-thumbnail rendering
    importService.js       File collection (pickers, drop, server) + import pipeline
    backupService.js       Metadata JSON, full backup/restore, project export
    downloadService.js     Saves files (normal tab or embedded host)
    turbowarpService.js    Lazy-loads and configures TurboWarp Scaffolding
  state/
    LibraryContext.jsx     Reducer + persisted actions (single source of truth)
    constants.js           Views, sort options, tag palette
  hooks/                   useVisibleProjects, useThumbnail (LRU), useImporter,
                           useProjectCommands, useLibraryBackup, useElementSize
  components/
    layout/                TopToolbar, Sidebar, DetailsPanel
    projects/              ProjectBrowser, ProjectGrid, ProjectList, ProjectCard,
                           ProjectMenu, BulkActionBar, dragData
    folders/               FolderTree (+ shared drop-target hook)
    dialogs/               Promise-based DialogProvider and dialogs
    player/                PlayerDialog (TurboWarp)
    dashboard/             StatsDashboard, Charts
    common/                TagChip, Thumbnail, ErrorBoundary
```

Key decision: binary data (`.sb3` blobs, thumbnails) lives in separate
IndexedDB stores from metadata, so listing, searching and sorting never touch
megabytes of data. Only cards on screen read their thumbnails.

## Notes

- Everything stays in the browser's IndexedDB; nothing is uploaded. Browsers
  can evict site storage under pressure, so make regular backups.
- The TurboWarp player script (~1.8 MB) is fetched from jsDelivr the first time
  a project runs, then cached.
- Under a strict Content-Security-Policy without `unsafe-eval`, the player falls
  back to TurboWarp's interpreter (slower than its compiler).
