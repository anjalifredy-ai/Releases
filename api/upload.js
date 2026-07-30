// api/upload.js
// Handles APK upload: checks PIN, then commits the APK (and optional
// screenshots + a small metadata.json) directly into the GitHub repo
// under apks/<app-folder>/ using the GitHub Contents API.
// The GitHub token is read from a server-side environment variable
// (GITHUB_TOKEN) — it is never present in any file the browser can see.

export const config = {
  api: {
    bodyParser: false, // we stream and parse the multipart body ourselves
  },
};

const UPLOAD_PIN = "Remon b";

const GITHUB_OWNER = "anjalifredy-ai";
const GITHUB_REPO = "Releases";
const GITHUB_BRANCH = "main";

// --- tiny multipart/form-data parser (no external deps), supports
// multiple files under different or repeated field names ---
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
  const files = []; // { fieldName, filename, buffer }

  for (const part of parts) {
    const [rawHeaders, ...rest] = part.split('\r\n\r\n');
    if (!rawHeaders) continue;
    const body = rest.join('\r\n\r\n').slice(0, -2);

    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const filenameMatch = rawHeaders.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : null;

    if (filenameMatch && filenameMatch[1]) {
      const fileBuffer = Buffer.from(body, 'latin1');
      files.push({ fieldName: name, filename: filenameMatch[1], buffer: fileBuffer });
    } else if (name) {
      fields[name] = body;
    }
  }

  return { fields, files };
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

async function putFile(path, base64Content, message) {
  const res = await githubRequest(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: GITHUB_BRANCH,
      }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub error saving ${path}: ${errText}`);
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
    const { fields, files } = await parseMultipart(req);

    if (!fields.pin || fields.pin !== UPLOAD_PIN) {
      res.status(401).json({ error: 'Wrong PIN' });
      return;
    }

    const apkFile = files.find(f => f.fieldName === 'file');
    const screenshotFiles = files.filter(f => f.fieldName === 'screenshots');

    if (!apkFile) {
      res.status(400).json({ error: 'No APK file uploaded' });
      return;
    }
    if (!apkFile.filename.toLowerCase().endsWith('.apk')) {
      res.status(400).json({ error: 'Only .apk files are allowed' });
      return;
    }
    if (screenshotFiles.length > 6) {
      res.status(400).json({ error: 'Max 6 screenshots allowed' });
      return;
    }

    const appName = (fields.appName || apkFile.filename.replace(/\.apk$/i, '')).trim();
    const description = (fields.description || '').trim();
    const folderSlug = `${Date.now()}-${appName.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const baseDir = `apks/${folderSlug}`;

    // 1. Commit the APK
    const apkPath = `${baseDir}/${apkFile.filename.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    await putFile(apkPath, apkFile.buffer.toString('base64'), `Add ${appName} via RemonStore upload`);
    const rawApkUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${apkPath}`;

    // 2. Commit screenshots (if any), sequentially to keep GitHub API happy
    const screenshotUrls = [];
    for (let i = 0; i < screenshotFiles.length; i++) {
      const shot = screenshotFiles[i];
      const ext = (shot.filename.match(/\.(jpg|jpeg|png|webp)$/i) || ['.jpg'])[0];
      const shotPath = `${baseDir}/screenshots/${i + 1}${ext}`;
      await putFile(shotPath, shot.buffer.toString('base64'), `Add screenshot ${i + 1} for ${appName}`);
      screenshotUrls.push(`https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${shotPath}`);
    }

    // 3. Commit a small metadata.json alongside the APK (description, screenshots)
    const sizeMB = (apkFile.buffer.length / (1024 * 1024)).toFixed(2) + ' MB';
    const metadata = {
      name: appName,
      description,
      size: sizeMB,
      screenshots: screenshotUrls,
      uploadedAt: new Date().toISOString(),
    };
    const metaPath = `${baseDir}/metadata.json`;
    await putFile(metaPath, Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64'), `Add metadata for ${appName}`);

    res.status(200).json({
      success: true,
      app: { name: appName, size: sizeMB, url: rawApkUrl, description, screenshots: screenshotUrls },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
}
