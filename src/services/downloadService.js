/**
 * downloadService.js — hands a generated file to the user.
 *
 * Works in two environments:
 *  1. A normal browser tab (e.g. served by the Node server): uses an <a download>.
 *  2. Embedded hosts that provide a `downloads` capability through
 *     `window.claude.use('downloads')` (such as a published claude.ai
 *     artifact), where plain download links are inert. Those hosts only accept
 *     certain extensions, so .sb3 files are delivered wrapped in a .zip.
 */
import JSZip from 'jszip';

let hostDownloads; // undefined = not checked yet, null = not available

async function getHostDownloads() {
  if (hostDownloads !== undefined) return hostDownloads;
  hostDownloads = null;
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      hostDownloads = await window.claude.use('downloads');
    } catch {
      hostDownloads = null;
    }
  }
  return hostDownloads;
}

/** True when running inside a host that restricts downloads. */
export async function isRestrictedHost() {
  return !!(await getHostDownloads()) || (window.self !== window.top);
}

/**
 * Save a Blob/string as a file. Resolves to true when handed off, false if the
 * user declined. Throws on real errors with a message suitable for a toast.
 */
export async function saveFile(filename, data) {
  const host = await getHostDownloads();
  if (host) {
    let name = filename;
    let payload = data;
    // .sb3 is not on embedded hosts' extension allowlist → wrap in a zip.
    if (/\.sb3$/i.test(name)) {
      const zip = new JSZip();
      zip.file(name, data);
      payload = await zip.generateAsync({ type: 'blob' });
      name = name.replace(/\.sb3$/i, '.zip');
    }
    try {
      await host.save({ filename: name, data: payload });
      return true;
    } catch (err) {
      if (err?.code === 'declined') return false;
      throw new Error(err?.message || 'The file could not be saved.');
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
