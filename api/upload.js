// api/upload.js
// Handles APK upload: checks PIN, stores the file in Vercel Blob,
// and appends an entry to the apps list (also stored in Blob as JSON).
//
// Requires the Vercel Blob integration to be enabled on the project
// (Storage -> Blob in the Vercel dashboard) so that BLOB_READ_WRITE_TOKEN
// is available automatically as an env var.

import { put, list } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // we stream the multipart body ourselves
  },
};

const UPLOAD_PIN = "Remon b";
const APPS_INDEX_KEY = "apps-index.json";

// --- tiny multipart/form-data parser (no external deps) ---
async function parseMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) throw new Error('No multipart boundary found');
  const boundary = '--' + boundaryMatch[1];

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const parts = buffer.toString('latin1').split(boundary).slice(1, -1);
  const fields = {};
  let file = null;

  for (const part of parts) {
    const [rawHeaders, ...rest] = part.split('\r\n\r\n');
    if (!rawHeaders) continue;
    const body = rest.join('\r\n\r\n').slice(0, -2); // strip trailing \r\n

    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : null;

    if (filenameMatch) {
      const fileBuffer = Buffer.from(body, 'latin1');
      file = {
        fieldName: name,
        filename: filenameMatch[1],
        buffer: fileBuffer,
      };
    } else if (name) {
      fields[name] = body;
    }
  }

  return { fields, file };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { fields, file } = await parseMultipart(req);

    // --- PIN check ---
    if (!fields.pin || fields.pin !== UPLOAD_PIN) {
      res.status(401).json({ error: 'Wrong PIN' });
      return;
    }

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const appName = (fields.appName || file.filename.replace(/\.apk$/i, '')).trim();
    const version = (fields.version || '1.0').trim();

    if (!file.filename.toLowerCase().endsWith('.apk')) {
      res.status(400).json({ error: 'Only .apk files are allowed' });
      return;
    }

    // --- Upload the APK to Vercel Blob ---
    const safeName = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const blob = await put(`apks/${safeName}`, file.buffer, {
      access: 'public',
      contentType: 'application/vnd.android.package-archive',
    });

    // --- Update the apps index (read existing, append, write back) ---
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

    const sizeMB = (file.buffer.length / (1024 * 1024)).toFixed(2);
    appsList.unshift({
      id: safeName,
      name: appName,
      version: version,
      size: `${sizeMB} MB`,
      url: blob.url,
      uploadedAt: new Date().toISOString(),
    });

    await put(APPS_INDEX_KEY, JSON.stringify(appsList, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    res.status(200).json({ success: true, app: appsList[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed', details: String(err) });
  }
}
