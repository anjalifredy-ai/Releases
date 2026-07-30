// api/apps.js
// Returns the current list of apps by combining TWO sources:
//  1. apks/ folder in the repo — small apps uploaded via the website form
//     (via api/upload.js), any size up to Vercel's ~4MB function limit.
//  2. GitHub Release assets under tag "Remo" — big apps (Telegram X,
//     Mirarr, NetMirror, etc.) that get dropped in manually since
//     GitHub Releases allow up to 2GB per file.
// No separate "index" bookkeeping needed — these two listings ARE the list.

const GITHUB_OWNER = "anjalifredy-ai";
const GITHUB_REPO = "Releases";
const GITHUB_BRANCH = "main";
const APKS_FOLDER = "apks";
const RELEASE_TAG = "Remo";

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return (bytes / 1024).toFixed(0) + " KB";
  return mb.toFixed(2) + " MB";
}

// Turn "1753800000000-Telegram_X.apk" or "NetMirror.apk" into a
// friendlier "Telegram X" / "NetMirror"
function prettyName(filename) {
  let name = filename.replace(/\.apk$/i, "");
  name = name.replace(/^\d{10,}-/, ""); // strip leading timestamp (website uploads)
  name = name.replace(/[_\-]+/g, " ").trim();
  return name || filename;
}

async function getFolderApps() {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${APKS_FOLDER}?ref=${GITHUB_BRANCH}`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'RemonStore' },
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const items = await r.json();
    if (!Array.isArray(items)) return [];

    return items
      .filter(item => item.type === 'file' && item.name.toLowerCase().endsWith('.apk'))
      .map(f => ({
        id: f.sha,
        name: prettyName(f.name),
        size: humanSize(f.size),
        url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${APKS_FOLDER}/${f.name}`,
        source: 'folder',
      }));
  } catch (e) {
    console.error('getFolderApps error:', e);
    return [];
  }
}

async function getReleaseApps() {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'RemonStore' },
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const release = await r.json();
    const assets = Array.isArray(release.assets) ? release.assets : [];

    return assets
      .filter(a => a.name.toLowerCase().endsWith('.apk'))
      .map(a => ({
        id: 'release-' + a.id,
        name: prettyName(a.name),
        size: humanSize(a.size),
        url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/${a.name}`,
        source: 'release',
      }));
  } catch (e) {
    console.error('getReleaseApps error:', e);
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  try {
    const [folderApps, releaseApps] = await Promise.all([
      getFolderApps(),
      getReleaseApps(),
    ]);

    // De-duplicate by name (in case the same app exists in both places),
    // preferring the release version (usually the "real"/bigger one).
    const seen = new Set();
    const combined = [];
    for (const app of [...releaseApps, ...folderApps]) {
      const key = app.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      combined.push(app);
    }

    res.status(200).json(combined);
  } catch (err) {
    console.error(err);
    res.status(200).json([]);
  }
}
