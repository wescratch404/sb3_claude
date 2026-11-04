/**
 * constants.js — shared enums and palettes.
 */

/** Sidebar "smart" views. Folders are addressed as { type: 'folder', folderId }. */
export const VIEWS = {
  all: 'all',
  unfiled: 'unfiled',
  favorites: 'favorites',
  recent: 'recent',
  mostOpened: 'mostOpened',
  archived: 'archived',
  folder: 'folder',
  dashboard: 'dashboard',
};

export const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'size', label: 'File size' },
  { key: 'importedAt', label: 'Date imported' },
  { key: 'modifiedAt', label: 'Date modified' },
  { key: 'lastOpenedAt', label: 'Last opened' },
  { key: 'openCount', label: 'Times opened' },
];

/**
 * Tag colours borrowed from Scratch's block categories, so tags feel at home
 * to Scratch creators: Motion, Looks, Sound, Events, Control, Sensing,
 * Operators, Variables, Lists, My Blocks, Pen.
 */
export const TAG_COLORS = [
  '#4C97FF', '#9966FF', '#CF63CF', '#FFBF00', '#FFAB19',
  '#5CB1D6', '#59C059', '#FF8C1A', '#FF661A', '#FF6680', '#0FBD8C',
];

/** Folders offered to brand-new libraries (the user can delete them). */
export const STARTER_FOLDERS = ['Games', 'Tutorials', 'Physics Simulations', 'Math Projects', 'Experiments'];

/** How many items the Recent / Most opened views show. */
export const RECENT_LIMIT = 60;
