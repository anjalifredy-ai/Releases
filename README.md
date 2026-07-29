RemonStore setup
Files
index.html — the website
api/upload.js — handles APK upload (PIN: Remon b)
api/apps.js — returns list of uploaded apps
package.json — dependency for Vercel Blob
One-time setup on Vercel (do this once)
Push these files to your GitHub repo that's connected to Vercel.
In the Vercel dashboard, open your project → Storage tab → Create Database → choose Blob.
Connect it to this project. Vercel will automatically add the
BLOB_READ_WRITE_TOKEN environment variable — you don't need to
copy/paste anything.
Redeploy (Vercel usually redeploys automatically after connecting storage,
otherwise trigger a redeploy from the dashboard).
That's it. After this, anyone who visits your site can tap "+ Upload App",
fill the form, enter the PIN (Remon b), and publish an app. It'll appear
under Community Uploads immediately for everyone, and the Get button
downloads the APK directly from Vercel Blob's public URL.
Changing the PIN
Open api/upload.js and edit this line near the top:
Js
