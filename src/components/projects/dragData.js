/**
 * dragData.js — drag-and-drop payloads between project views and folders.
 */
export const PROJECT_MIME = 'application/x-sb3-projects';
export const FOLDER_MIME = 'application/x-sb3-folder';

/** Start dragging projects; drags the whole selection if the item is in it. */
export function startProjectDrag(e, projectId, selection) {
  const ids = selection.has(projectId) ? [...selection] : [projectId];
  e.dataTransfer.setData(PROJECT_MIME, JSON.stringify(ids));
  e.dataTransfer.effectAllowed = 'move';
  // A compact drag image that shows how many projects are moving.
  const ghost = document.createElement('div');
  ghost.textContent = ids.length === 1 ? 'Move 1 project' : `Move ${ids.length} projects`;
  Object.assign(ghost.style, {
    position: 'fixed', top: '-100px', padding: '6px 10px', borderRadius: '6px',
    background: '#6D4AE8', color: '#fff', font: '500 12px Lexend, sans-serif',
  });
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 10, 10);
  setTimeout(() => ghost.remove(), 0);
}

export const readProjectIds = (e) => {
  try {
    return JSON.parse(e.dataTransfer.getData(PROJECT_MIME) || '[]');
  } catch {
    return [];
  }
};

export const hasType = (e, mime) => Array.from(e.dataTransfer?.types || []).includes(mime);
