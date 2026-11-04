/**
 * sb3Parser.js — reads a .sb3 (a ZIP archive) and extracts what the library
 * needs: a display title, some project statistics, and a thumbnail.
 *
 * About thumbnails: a .sb3 file does not contain the screenshot Scratch shows
 * on its website. Instead we *re-create the first frame of the stage* from the
 * assets inside the archive: the current backdrop, then every visible sprite's
 * current costume drawn at its saved position, size and direction, in layer
 * order. The result is downscaled to a small PNG data URL so thousands of
 * thumbnails stay cheap to store and render.
 */
import JSZip from 'jszip';

const THUMB_W = 240; // half of the 480×360 stage
const THUMB_H = 180;
const MAX_SPRITES_IN_THUMB = 40; // keeps huge projects from stalling imports

/**
 * Parse an .sb3 Blob/File.
 * @returns {Promise<{title:string|null, info:object, thumbnail:string|null}>}
 * @throws if the archive or project.json is unreadable.
 */
export async function parseSb3(blob, { makeThumbnail = true } = {}) {
  const zip = await JSZip.loadAsync(blob);
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('No project.json inside — this is not a Scratch 3 project.');

  const project = JSON.parse(await projectFile.async('string'));
  if (!Array.isArray(project.targets)) throw new Error('project.json has no targets — the file may be from Scratch 2.');

  const info = collectInfo(project);
  const title = findTitle(project);

  let thumbnail = null;
  if (makeThumbnail) {
    try {
      thumbnail = await renderStageThumbnail(project, zip);
    } catch (err) {
      // A broken costume should never block the import — fall back to a placeholder.
      console.warn('Thumbnail generation failed:', err);
    }
  }
  return { title, info, thumbnail };
}

/** Count sprites, blocks, assets and list the extensions a project uses. */
function collectInfo(project) {
  let blocks = 0, costumes = 0, sounds = 0, sprites = 0, variables = 0;
  for (const t of project.targets) {
    if (!t.isStage) sprites++;
    blocks += Object.values(t.blocks || {}).filter((b) => b && typeof b === 'object' && !Array.isArray(b)).length;
    costumes += (t.costumes || []).length;
    sounds += (t.sounds || []).length;
    variables += Object.keys(t.variables || {}).length;
  }
  return {
    sprites,
    blocks,
    costumes,
    sounds,
    variables,
    extensions: project.extensions || [],
    vm: project.meta?.vm || null,
    agent: project.meta?.agent || null,
  };
}

/**
 * Projects rarely carry a title. Some tools write one into `meta`; otherwise
 * we return null and the UI falls back to the file name.
 */
function findTitle(project) {
  const m = project.meta || {};
  const t = m.title || m.name || m.projectTitle;
  return typeof t === 'string' && t.trim() ? t.trim() : null;
}

/* ------------------------------------------------------------------ */
/* Stage thumbnail rendering                                           */
/* ------------------------------------------------------------------ */

async function renderStageThumbnail(project, zip) {
  const stage = project.targets.find((t) => t.isStage);
  const sprites = project.targets
    .filter((t) => !t.isStage && t.visible !== false)
    .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0))
    .slice(0, MAX_SPRITES_IN_THUMB);

  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  // Work in stage coordinates (480×360, origin at the centre, y up → we flip below).
  ctx.scale(THUMB_W / 480, THUMB_H / 360);

  let drewSomething = false;
  for (const target of [stage, ...sprites]) {
    if (!target) continue;
    const costume = (target.costumes || [])[target.currentCostume ?? 0];
    if (!costume) continue;
    const img = await loadCostumeImage(zip, costume);
    if (!img) continue;

    const res = costume.bitmapResolution || 1;
    const scale = target.isStage ? 1 : (target.size ?? 100) / 100;
    const w = (img.naturalWidth / res) * scale;
    const h = (img.naturalHeight / res) * scale;
    const cx = (costume.rotationCenterX ?? 0) / res * scale;
    const cy = (costume.rotationCenterY ?? 0) / res * scale;

    ctx.save();
    // Stage (x, y) → canvas pixels: centre is (240, 180), y axis points up.
    ctx.translate(240 + (target.isStage ? 0 : target.x || 0), 180 - (target.isStage ? 0 : target.y || 0));
    if (!target.isStage) {
      const dir = target.direction ?? 90;
      if (target.rotationStyle === 'left-right' && dir < 0) ctx.scale(-1, 1);
      else if (target.rotationStyle !== "don't rotate" && target.rotationStyle !== 'left-right') {
        ctx.rotate(((dir - 90) * Math.PI) / 180);
      }
    }
    ctx.drawImage(img, -cx, -cy, w, h);
    ctx.restore();
    drewSomething = true;
  }

  if (!drewSomething) return null;
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null; // canvas tainted (very old browsers with SVG) → placeholder
  }
}

/** Decode one costume asset from the archive into an HTMLImageElement. */
async function loadCostumeImage(zip, costume) {
  const fileName = costume.md5ext || `${costume.assetId}.${costume.dataFormat}`;
  const entry = zip.file(fileName);
  if (!entry) return null;

  let src;
  if (costume.dataFormat === 'svg') {
    let svg = await entry.async('string');
    svg = normaliseSvg(svg);
    src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } else {
    const b64 = await entry.async('base64');
    const mime = costume.dataFormat === 'jpg' || costume.dataFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    src = `data:${mime};base64,${b64}`;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Browsers need explicit width/height on an SVG to give it an intrinsic size.
 * Scratch SVGs normally have them, but hand-made or generated ones may only
 * have a viewBox — derive the size from it in that case.
 */
function normaliseSvg(svg) {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) return svg;
  const tag = open[0];
  if (/\swidth=/.test(tag) && /\sheight=/.test(tag)) return svg;
  const vb = tag.match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const w = vb ? vb[1] : 100;
  const h = vb ? vb[2] : 100;
  const fixed = tag.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`);
  return svg.replace(tag, fixed);
}
