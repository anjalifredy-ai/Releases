// api/apps.js
// Returns the current list of uploaded apps (stored as a JSON blob).

import { list } from '@vercel/blob';

const APPS_INDEX_KEY = "apps-index.json";

export default async function handler(req, res) {
  try {
    const { blobs } = await list({ prefix: APPS_INDEX_KEY });
    const existing = blobs.find(b => b.pathname === APPS_INDEX_KEY);

    if (!existing) {
      res.status(200).json([]);
      return;
    }

    const r = await fetch(existing.url);
    const appsList = await r.json();
    res.status(200).json(appsList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load apps', details: String(err) });
  }
}
