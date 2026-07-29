// api/apps.js
// Returns the current list of apps by scanning the apks/ folder in the
// GitHub repo directly. This picks up BOTH:
//  - apps uploaded through the website (small, <4MB, via api/upload.js)
//  - apps manually dropped into apks/ on GitHub (any size, e.g. big APKs)
// No separate "index" bookkeeping needed — the folder listing IS the list.

const GITHUB_OWNER = "anjalifredy-ai";
const GITHUB_REPO = "Releases";
const GITHUB_BRANCH = "main";
const APKS_FOLDER = "apks";

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "Unknown";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return (bytes / 1024).toFixed(0) + " KB";
  return mb.toFixed(2) + " MB";
}

// Turn "1753800000000-Telegram_X.apk" into a friendlier "Telegram X"
function prettyName(filename) {
  let name = filename.replace(/\.apk$/i, "");
  // strip a leading "<timestamp>-" if present (from website uploads)
  name = name.replace(/^\d{10,}-/, "");
  name = name.replace(/[_\-]+/g, " ").trim();
  return name || filename;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${APKS_FOLDER}?ref=${GITHUB_BRANCH}`;
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'RemonStore',
      },
      cache: 'no-store',
    });

    if (!r.ok) {
      res.status(200).json([]);
      return;
    }

    const items = await r.json();
    if (!Array.isArray(items)) {
      res.status(200).json([]);
      return;
    }

    const apkFiles = items.filter(
      item => item.type === 'file' && item.name.toLowerCase().endsWith('.apk')
    );

    // Newest first (by name's leading timestamp when present, else alphabetical)
    apkFiles.sort((a, b) => b.name.localeCompare(a.name));

    const appsList = apkFiles.map(f => ({
      id: f.sha,
      name: prettyName(f.name),
      version: '',
      size: humanSize(f.size),
      url: `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${APKS_FOLDER}/${f.name}`,
    }));

    res.status(200).json(appsList);
  } catch (err) {
    console.error(err);
    res.status(200).json([]);
  }
}
