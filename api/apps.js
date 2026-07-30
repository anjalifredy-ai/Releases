// api/apps.js
// Returns the current list of apps by combining TWO sources:
//  1. apks/<folder>/ subfolders in the repo — each app uploaded via the
//     website form (via api/upload.js) lives in its own folder with the
//     APK, an optional metadata.json (description + screenshots), and a
//     screenshots/ folder.
//  2. GitHub Release assets under tag "Remo" — big apps (Telegram X,
//     Mirarr, NetMirror, etc.) dropped in manually since GitHub Releases
//     allow up to 2GB per file.

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

function prettyName(filename) {
  let name = filename.replace(/\.apk$/i, "");
  name = name.replace(/^\d{10,}-/, "");
  name = name.replace(/[_\-]+/g, " ").trim();
  return name || filename;
}

async function ghFetch(path) {
  const url = `https://api.github.com${path}`;
  const r = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'RemonStore' },
    cache: 'no-store',
  });
  return r;
}

// New per-app-folder structure: apks/<folder>/<name>.apk, metadata.json, screenshots/
async function getFolderApps() {
  try {
    const r = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${APKS_FOLDER}?ref=${GITHUB_BRANCH}`);
    if (!r.ok) return [];
    const items = await r.json();
    if (!Array.isArray(items)) return [];

    const results = [];

    for (const item of items) {
      // Legacy: a bare .apk file directly in apks/ (from the older flat scheme)
      if (item.type === 'file' && item.name.toLowerCase().endsWith('.apk')) {
        results.push({
          id: item.sha,
          name: prettyName(item.name),
          size: humanSize(item.size),
          url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${APKS_FOLDER}/${item.name}`,
          description: '',
          screenshots: [],
          source: 'folder',
        });
        continue;
      }

      // New: a per-app subfolder
      if (item.type === 'dir') {
        const subR = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${item.path}?ref=${GITHUB_BRANCH}`);
        if (!subR.ok) continue;
        const subItems = await subR.json();
        if (!Array.isArray(subItems)) continue;

        const apkEntry = subItems.find(f => f.type === 'file' && f.name.toLowerCase().endsWith('.apk'));
        if (!apkEntry) continue;

        let metadata = {};
        const metaEntry = subItems.find(f => f.name === 'metadata.json');
        if (metaEntry) {
          try {
            const metaR = await fetch(`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${item.path}/metadata.json`, { cache: 'no-store' });
            if (metaR.ok) metadata = await metaR.json();
          } catch (e) { /* ignore, fall back to defaults */ }
        }

        results.push({
          id: apkEntry.sha,
          name: metadata.name || prettyName(apkEntry.name),
          size: metadata.size || humanSize(apkEntry.size),
          url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${item.path}/${apkEntry.name}`,
          description: metadata.description || '',
          screenshots: Array.isArray(metadata.screenshots) ? metadata.screenshots : [],
          source: 'folder',
        });
      }
    }

    return results;
  } catch (e) {
    console.error('getFolderApps error:', e);
    return [];
  }
}

async function getReleaseApps() {
  try {
    const r = await ghFetch(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${RELEASE_TAG}`);
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
        description: '',
        screenshots: [],
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
