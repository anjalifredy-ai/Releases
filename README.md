# RemonStore setup

## How it works now
Everything lives in the `apks/` folder of this GitHub repo. The website
just lists whatever `.apk` files are in that folder — no separate index
file to keep in sync.

- **Small files (roughly under 4MB):** upload them through the website's
  "+ Upload App" form. It commits the file into `apks/` via the GitHub API.
- **Big files (Telegram X, Mirarr, NetMirror, etc. — 50MB+):** these are
  too big to pass through a Vercel serverless function (Vercel's request
  body limit is 4.5MB on the free plan). For these, just drop the APK
  file into the `apks/` folder yourself directly on GitHub (using the
  GitHub app or website's "Add file" button). It'll show up on the site
  automatically — no extra steps, no manual entry needed.

## Files
- `index.html` — the website
- `api/upload.js` — handles the small-file upload form (PIN-protected),
  commits the file into `apks/` via the GitHub API
- `api/apps.js` — lists every `.apk` currently in `apks/`, used to render
  the "Community Uploads" section
- `package.json` — no external dependencies needed

## One-time setup (already done)
1. GitHub Personal Access Token (classic, `repo` scope) created.
2. Added to Vercel → Settings → Environment Variables as `GITHUB_TOKEN`.
3. Repo/branch used: `anjalifredy-ai/Releases`, branch `main`
   (change the constants at the top of `api/upload.js` / `api/apps.js`
   if these ever differ).

## Changing the PIN
Open `api/upload.js` and edit this line near the top:
```js
const UPLOAD_PIN = "Remon b";
```

## Notes
- Filenames get prettified for display (underscores/dashes become spaces,
  a leading timestamp prefix from website uploads is stripped).
- GitHub's own file size limit is 100MB per file via normal commits —
  covers everything in the current 65+ app library comfortably.
  
