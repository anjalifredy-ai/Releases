RemonStore setup
How it works now
Uploaded APKs are committed directly into this GitHub repo, inside an
apks/ folder — no third-party storage service involved. The list of
uploaded apps is also tracked as a JSON file in that same folder
(apks/apps-index.json).
Files
index.html — the website
api/upload.js — checks the PIN, then uses the GitHub API to commit the
APK file into apks/ and update the apps index
api/apps.js — reads the current apps list from GitHub (public raw file,
no auth needed for this part)
package.json — no external dependencies needed
One-time setup (do this once)
Push these files to your GitHub repo (anjalifredy-ai/Releases, branch main).
If your repo/owner/branch differ from that, update the constants at the
top of api/upload.js and api/apps.js.
Create a GitHub Personal Access Token (classic) with the repo scope:
GitHub → Settings → Developer settings → Personal access tokens →
Tokens (classic) → Generate new token.
In your Vercel project → Settings → Environment Variables, add:
Name: GITHUB_TOKEN
Value: (paste the token here — never put it in any file or chat)
Redeploy the project so the new environment variable takes effect.
That's it. After this, anyone who visits your site can tap "+ Upload App",
fill the form, enter the PIN (Remon b), and publish an app. The APK gets
committed straight into your GitHub repo, and it appears under
Community Uploads for everyone, with a working direct-download Get button.
Changing the PIN
Open api/upload.js and edit this line near the top:
Js
Note on file size
GitHub's normal file size limit is 100MB per file, which covers all the
current APKs (largest is ~70MB). If you ever need to upload something
bigger than 100MB, this approach would need to switch to Git LFS.
