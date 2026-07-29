// api/apps-add.js
// Called by the browser right after a direct client-upload to Vercel Blob
// finishes successfully. Appends the new app's info to the apps index.

import { put, list } from '@vercel/blob';

const APPS_INDEX_KEY = "apps-index.json";
const UPLOAD_PIN = "Remon b";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { pin, appName, version, size, url } = req.body || {};

    if (pin !== UPLOAD_PIN) {
      res.status(401).json({ error: 'Wrong PIN' });
      return;
    }
    if (!appName || !url) {
      res.status(400).json({ error: 'Missing app info' });
      return;
    }

    let appsList = [];
    try {
      const { blobs } = await list({ prefix: APPS_INDEX_KEY });
      const existing = blobs.find(b => b.pathname === APPS_INDEX_KEY);
      if (existing) {
        const r = await fetch(existing.url);
        appsList = await r.json();
      }
    } catch (e) {
      appsList = [];
    }

    const newApp = {
      id: Date.now().toString(),
      name: appName,
      version: version || '1.0',
      size: size || 'Unknown',
      url,
      uploadedAt: new Date().toISOString(),
    };
    appsList.unshift(newApp);

    await put(APPS_INDEX_KEY, JSON.stringify(appsList, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    res.status(200).json({ success: true, app: newApp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save app', details: String(err) });
  }
}
