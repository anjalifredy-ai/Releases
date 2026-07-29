RemonStore setup
Files
index.html — the website
api/upload.js — issues a signed upload token after PIN check (file itself goes straight from browser to Blob storage, not through this function)
api/apps-add.js — saves the new app's info to the list, right after upload finishes
api/apps.js — returns the current list of uploaded apps
package.json — dependency for Vercel Blob
One-time setup on Vercel (already done)
Push these files to your GitHub repo connected to Vercel.
Storage tab → Blob store created and connected (done ✅) with Public access.
Vercel auto-added BLOB_READ_WRITE_TOKEN — no manual copying needed.
Why the upload changed
Large files (Telegram X, Mirarr, etc. — 50MB+) were failing with
"Unexpected response from server" because Vercel serverless functions have
a small request body limit and a short execution timeout — too small for
big APKs sent the old way (through the function itself).
Now the browser uploads the APK directly to Vercel Blob using a
short-lived signed token that api/upload.js generates (after checking
the PIN). The file bytes never pass through the function, so there's no
size limit or timeout issue — works the same for a 100KB file or a 100MB
one, and shows a real, accurate progress bar the whole way.
Changing the PIN
Open api/upload.js AND api/apps-add.js — both have this line near the top:
Js
Change it to the same new value in both files.
