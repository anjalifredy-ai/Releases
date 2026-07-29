// api/upload.js
// Generates a signed client-upload token after checking the PIN.
// The actual file bytes never pass through this function — the browser
// uploads directly to Vercel Blob using this token, so there's no
// function body-size limit or timeout issue for large APKs.

import { handleUpload } from '@vercel/blob/client';

const UPLOAD_PIN = "Remon b";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try { payload = JSON.parse(clientPayload || '{}'); } catch (e) {}

        if (payload.pin !== UPLOAD_PIN) {
          throw new Error('Wrong PIN');
        }

        if (!pathname.toLowerCase().endsWith('.apk')) {
          throw new Error('Only .apk files are allowed');
        }

        return {
          allowedContentTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            appName: payload.appName,
            version: payload.version,
          }),
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do here — the client calls /api/apps-add
        // right after the upload finishes to update the index.
      },
    });

    res.status(200).json(jsonResponse);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
}
