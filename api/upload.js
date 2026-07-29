// api/upload.js
// Handles APK upload: checks PIN, then commits the file directly into
// the GitHub repo (under apks/) using the GitHub Contents API.
// The GitHub token is read from a server-side environment variable
// (GITHUB_TOKEN) — it is never present in any file the browser can see.

export const config = {
  api: {
    bodyParser: false, // we stream and parse the multipart body ourselves
  },
};

const UPLOAD_PIN = "Remon b";

// These identify where files get committed. Update if your repo/owner differ.
const GITHUB_OWNER = "anjalifredy-ai";
const GITHUB_REPO = "Releases";
const GITHUB_BRANCH = "main";
const APPS_INDEX_PATH = "apks/apps-index.json";

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
    const body = rest.join('\r\n\r\n').slice(0, -2);

    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : null;

    if (filenameMatch) {
      const fileBuffer = Buffer.from(body, 'latin1');
      file = { fieldName: name, filename: filenameMatch[1], buffer: fileBuffer };
    } else if (name) {
      fields[name] = body;
    }
  }

  return { fields, file };
}

async function githubRequest(path, options = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'RemonStore',
      ...(options.headers || {}),
    },
  });
  return res;
}

async function getFileSha(path) {
  const res = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`
  );
  if (res.status === 200) {
    const data = await res.json();
    return data.sha;
  }
  return null; // file doesn't exist yet
}

async function putFile(path, base64Content, message, sha) {
  const res = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${errText}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.GITHUB_TOKEN) {
    res.status(500).json({ error: 'Server misconfigured: GITHUB_TOKEN is missing in Vercel env vars.' });
    return;
  }

  try {
    const { fields, file } = await parseMultipart(req);

    if (!fields.pin || fields.pin !== UPLOAD_PIN) {
      res.status(401).json({ error: 'Wrong PIN' });
      return;
    }
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    if (!file.filename.toLowerCase().endsWith('.apk')) {
      res.status(400).json({ error: 'Only .apk files are allowed' });
      return;
    }

    const appName = (fields.appName || file.filename.replace(/\.apk$/i, '')).trim();
    const version = (fields.version || '1.0').trim();

    // Commit the APK file into apks/ in the repo
    const safeName = `${Date.now()}-${file.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const apkPath = `apks/${safeName}`;
    const base64Content = file.buffer.toString('base64');

    await putFile(apkPath, base64Content, `Add ${appName} via RemonStore upload`);

    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${apkPath}`;

    // Update the apps index (read existing -> append -> write back)
    let appsList = [];
    const existingSha = await getFileSha(APPS_INDEX_PATH);
    if (existingSha) {
      const getRes = await githubRequest(
        `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${APPS_INDEX_PATH}?ref=${GITHUB_BRANCH}`
      );
      const data = await getRes.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      try { appsList = JSON.parse(content); } catch (e) { appsList = []; }
    }

    const sizeMB = (file.buffer.length / (1024 * 1024)).toFixed(2) + ' MB';
    const newApp = {
      id: safeName,
      name: appName,
      version,
      size: sizeMB,
      url: rawUrl,
      uploadedAt: new Date().toISOString(),
    };
    appsList.unshift(newApp);

    const newIndexBase64 = Buffer.from(JSON.stringify(appsList, null, 2)).toString('base64');
    await putFile(APPS_INDEX_PATH, newIndexBase64, `Update apps index: add ${appName}`, existingSha);

    res.status(200).json({ success: true, app: newApp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
