// api/apps.js
// Returns the current list of uploaded apps, read from apks/apps-index.json
// in the GitHub repo (no token needed for reading — public repo raw file).

const GITHUB_OWNER = "anjalifredy-ai";
const GITHUB_REPO = "Releases";
const GITHUB_BRANCH = "main";
const APPS_INDEX_PATH = "apks/apps-index.json";

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${APPS_INDEX_PATH}?t=${Date.now()}`;
    const r = await fetch(url, { cache: 'no-store' });

    if (!r.ok) {
      // Index file doesn't exist yet (no uploads so far) — that's fine.
      res.status(200).json([]);
      return;
    }

    const appsList = await r.json();
    res.status(200).json(appsList);
  } catch (err) {
    console.error(err);
    res.status(200).json([]); // fail soft — show static apps at least
  }
}
