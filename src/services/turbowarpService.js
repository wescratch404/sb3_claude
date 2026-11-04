/**
 * turbowarpService.js — lazily loads the TurboWarp project player.
 *
 * We use TurboWarp "Scaffolding", the same embeddable player the TurboWarp
 * Packager produces. It runs projects from an ArrayBuffer, so .sb3 files go
 * straight from IndexedDB into the player: nothing is uploaded anywhere.
 *
 * The ~1.8 MB script is only fetched the first time a project is run, then
 * cached by the browser. The version is pinned exactly because Scaffolding's
 * API is not guaranteed to be stable between releases.
 */

export const SCAFFOLDING_VERSION = '3.13.0';
export const SCAFFOLDING_URL =
  `https://cdn.jsdelivr.net/npm/@turbowarp/packager@${SCAFFOLDING_VERSION}/dist/scaffolding/scaffolding-min.js`;

let loadPromise = null;

/** Load window.Scaffolding once. */
export function loadScaffolding() {
  if (window.Scaffolding) return Promise.resolve(window.Scaffolding);
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCAFFOLDING_URL;
    script.async = true;
    script.onload = () =>
      window.Scaffolding ? resolve(window.Scaffolding) : reject(new Error('The TurboWarp player loaded but did not start.'));
    script.onerror = () => {
      loadPromise = null; // allow a retry
      reject(new Error('The TurboWarp player could not be downloaded. Check your internet connection and try again.'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

/** Whether this page may compile JavaScript at runtime (TurboWarp's compiler needs it). */
function canEval() {
  try {
    // eslint-disable-next-line no-new-func
    return new Function('return 1')() === 1;
  } catch {
    return false;
  }
}

/**
 * Create a player inside `container`.
 * @returns the Scaffolding instance (call .loadProject, .greenFlag, .stopAll…)
 */
export async function createPlayer(container, { width = 480, height = 360, cloudKey = 'default' } = {}) {
  const Scaffolding = await loadScaffolding();
  const player = new Scaffolding.Scaffolding();
  player.width = width;
  player.height = height;
  player.resizeMode = 'preserve-ratio';
  player.editableLists = false;
  player.setup();
  player.appendTo(container);

  // Sensible TurboWarp defaults for previewing.
  player.setAccentColor('#7A5AF8');
  if (!canEval() && player.vm.setCompilerOptions) {
    // Strict Content-Security-Policy: fall back to the (slower) interpreter.
    player.vm.setCompilerOptions({ enabled: false });
  }
  // Cloud variables stay local to this browser, separately for each project.
  try {
    player.addCloudProvider(new Scaffolding.Cloud.LocalStorageProvider(`sb3-library-cloud:${cloudKey}`));
  } catch {
    /* storage unavailable — cloud variables behave like normal ones */
  }
  return player;
}
