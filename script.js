// Load the Vercel Blob client-upload helper (used only if you later
// wire up large-file uploads; safe to keep even if unused right now).
import('https://esm.sh/@vercel/blob@0.27.0/client?bundle')
  .then(mod => { window.__blobUpload = mod.upload; })
  .catch(() => { /* not critical for small-file uploads via GitHub */ });

// ---- Pre-seeded apps (from GitHub Releases, tag "Remo") ----
const RELEASE_BASE = "https://github.com/anjalifredy-ai/Releases/releases/download/Remo/";

const staticApps = [
  { name: "NetMirror", version: "3.0", size: "51.71 MB", group: "uninstalled", color: "#c0272d", letter: "N", url: RELEASE_BASE + "NetMirror.apk", description: "", screenshots: [] },
  { name: "ShowCase", version: "4.7", size: "5.53 MB", group: "uninstalled", color: "#1f3a5f", letter: "S", url: RELEASE_BASE + "showcase-v4.7.apk", description: "", screenshots: [] },
  { name: "Vencord", version: "1.0.6", size: "1.24 MB", group: "uninstalled", color: "#e6b8b0", letter: "V", url: RELEASE_BASE + "Vencord-v1.0.6.apk", description: "", screenshots: [] },
  { name: "SlimSocial for Instagram", version: "1.0", size: "1.08 MB", group: "uninstalled", color: "#c2185b", letter: "S", url: RELEASE_BASE + "app-release.1.apk", description: "", screenshots: [] },
  { name: "Materialbook", version: "1.0.0", size: "1.70 MB", group: "uninstalled", color: "#7d9bd4", letter: "n", url: RELEASE_BASE + "Materialbook_v1.0.0.apk", description: "", screenshots: [] },
  { name: "Mirarr", version: "3.3.2", size: "69.91 MB", group: "installed", color: "#e0d4b0", letter: "M", url: RELEASE_BASE + "app-release.apk", description: "", screenshots: [] },
  { name: "YouTube Pro", version: "3.98", size: "122 KB", group: "installed", color: "#d32f2f", letter: "Y", url: RELEASE_BASE + "YTPRO.apk", description: "", screenshots: [] },
  { name: "Telegram X", version: "0.28.1.1771", size: "52.65 MB", group: "installed", color: "#2f4a5e", letter: "T", url: RELEASE_BASE + "Telegram-X-0.28.1.1771.apk", description: "", screenshots: [] },
  { name: "RiMusic", version: "0.6.72.1", size: "18.58 MB", group: "installed", color: "#2e8b57", letter: "R", url: RELEASE_BASE + "app-foss-release.apk", description: "", screenshots: [] },
  { name: "LitePipe", version: "1.2.1", size: "6.20 MB", group: "installed", color: "#8b1a1a", letter: "L", url: RELEASE_BASE + "LitePipev1.2.1-arm64-v8a.apk", description: "", screenshots: [] }
];

const palette = ["#c0272d","#1f3a5f","#e6b8b0","#c2185b","#7d9bd4","#e0d4b0","#d32f2f","#2f4a5e","#2e8b57","#8b1a1a","#5e35b1","#00838f"];
function colorFor(name){
  let hash = 0;
  for(let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash<<5)-hash);
  return palette[Math.abs(hash) % palette.length];
}

let allAppsCache = [];

async function loadUploadedApps(){
  try{
    const r = await fetch('/api/apps');
    if(!r.ok) return [];
    const data = await r.json();
    return data.map(a => ({
      name: a.name,
      version: a.version || '',
      size: a.size,
      group: 'community',
      color: colorFor(a.name),
      letter: a.name.trim()[0]?.toUpperCase() || 'A',
      url: a.url,
      description: a.description || '',
      screenshots: a.screenshots || [],
      source: a.source || 'community'
    }));
  }catch(e){
    return [];
  }
}

function render(allApps){
  allAppsCache = allApps;
  const app = document.getElementById('app');
  app.innerHTML = '';

  const groups = [
    { key: 'installed', label: 'Installed' },
    { key: 'uninstalled', label: 'Uninstalled' },
    { key: 'community', label: 'Community Uploads' }
  ];

  let installedCount = 0, uninstalledCount = 0, uploadedCount = 0;

  groups.forEach(g => {
    const items = allApps.filter(a => a.group === g.key);
    if(items.length === 0) return;

    const label = document.createElement('div');
    label.className = 'group-label';
    label.textContent = g.label + ' (' + items.length + ')';
    app.appendChild(label);

    items.forEach(a => {
      if(g.key === 'installed') installedCount++;
      else if(g.key === 'uninstalled') uninstalledCount++;
      else uploadedCount++;

      const row = document.createElement('div');
      row.className = 'app-row';
      row.innerHTML = `
        <div class="icon" style="background:${a.color}">${a.letter}</div>
        <div class="meta">
          <div class="app-name">${a.name}</div>
          <div class="app-sub">
            <span>${a.size}</span>
            ${a.version ? `<span class="dot"></span><span>v${a.version}</span>` : ''}
          </div>
        </div>
        <a class="dl-btn" href="${a.url}" download onclick="event.stopPropagation()">Get</a>
      `;
      row.addEventListener('click', () => openDetail(a));
      app.appendChild(row);
    });
  });

  document.getElementById('countInstalled').textContent = installedCount;
  document.getElementById('countUninstalled').textContent = uninstalledCount;
  document.getElementById('countUploaded').textContent = uploadedCount;

  if(allApps.length === 0){
    app.innerHTML = '<div class="empty-note">No apps yet. Be the first to publish one.</div>';
  }
}

// ---- Detail page ----
function openDetail(a){
  document.getElementById('detailTopbarTitle').textContent = a.name;
  document.getElementById('detailIcon').textContent = a.letter;
  document.getElementById('detailIcon').style.background = a.color;
  document.getElementById('detailName').textContent = a.name;

  const subParts = [a.size];
  if(a.version) subParts.push('v' + a.version);
  document.getElementById('detailSub').textContent = subParts.join(' • ');

  document.getElementById('detailGetBtn').href = a.url;

  document.getElementById('detailStatSize').textContent = a.size || '-';
  document.getElementById('detailStatVersion').textContent = a.version || '-';
  document.getElementById('detailStatType').textContent =
    a.group === 'community' ? 'Community' : (a.group === 'installed' ? 'Installed set' : 'Uninstalled set');

  const shotsRow = document.getElementById('screenshotsRow');
  shotsRow.innerHTML = '';
  if(a.screenshots && a.screenshots.length){
    a.screenshots.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'screenshot-thumb';
      img.loading = 'lazy';
      shotsRow.appendChild(img);
    });
    shotsRow.style.display = 'flex';
  } else {
    shotsRow.style.display = 'none';
  }

  const descEl = document.getElementById('detailDesc');
  if(a.description && a.description.trim()){
    descEl.textContent = a.description;
    descEl.classList.remove('empty');
  } else {
    descEl.textContent = 'No description provided for this app yet.';
    descEl.classList.add('empty');
  }

  document.getElementById('detailView').classList.add('open');
  window.scrollTo(0,0);
  document.getElementById('detailView').scrollTop = 0;
}

document.getElementById('detailBack').addEventListener('click', () => {
  document.getElementById('detailView').classList.remove('open');
});

async function refreshAll(){
  const uploadedApps = await loadUploadedApps();
  render([...staticApps, ...uploadedApps]);
}

// ---- Upload panel toggle ----
document.getElementById('uploadToggle').addEventListener('click', () => {
  document.getElementById('uploadPanel').classList.toggle('open');
});

// ---- Upload form submit ----
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('appName').value.trim();
  const description = document.getElementById('appDescription').value.trim();
  const pin = document.getElementById('uploadPin').value;
  const fileInput = document.getElementById('apkFile');
  const file = fileInput.files[0];
  const screenshotInput = document.getElementById('screenshotFiles');
  const screenshotList = Array.from(screenshotInput.files || []);
  const msg = document.getElementById('uploadMsg');
  const submitBtn = document.getElementById('submitBtn');
  const progressWrap = document.getElementById('progressWrap');
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const progressStage = document.getElementById('progressStage');

  msg.textContent = '';
  msg.className = 'upload-msg';

  if(!file){
    msg.textContent = 'Please choose an APK file.';
    msg.classList.add('err');
    return;
  }
  if(!file.name.toLowerCase().endsWith('.apk')){
    msg.textContent = 'Only .apk files are allowed.';
    msg.classList.add('err');
    return;
  }
  if(screenshotList.length > 6){
    msg.textContent = 'Max 6 screenshots allowed.';
    msg.classList.add('err');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Uploading...';
  progressWrap.classList.add('show');
  progressFill.style.width = '0%';
  progressPercent.textContent = '0';
  progressStage.textContent = 'Uploading...';

  const formData = new FormData();
  formData.append('appName', name);
  formData.append('description', description);
  formData.append('pin', pin);
  formData.append('file', file);
  screenshotList.forEach(shot => formData.append('screenshots', shot));

  try {
    const data = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');

      xhr.upload.addEventListener('progress', (evt) => {
        if(evt.lengthComputable){
          const pct = Math.round((evt.loaded / evt.total) * 100);
          progressFill.style.width = pct + '%';
          progressPercent.textContent = pct;
          if(pct >= 100){
            progressStage.textContent = 'Publishing to GitHub...';
          } else if(pct >= 90){
            progressStage.textContent = 'Almost there...';
          }
        }
      });

      xhr.onload = () => {
        let parsed;
        try { parsed = JSON.parse(xhr.responseText); }
        catch(e){ parsed = { error: 'Unexpected response from server.' }; }

        if(xhr.status >= 200 && xhr.status < 300){
          resolve(parsed);
        } else {
          reject(new Error(parsed.error || 'Upload failed.'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(formData);
    });

    progressFill.style.width = '100%';
    progressPercent.textContent = '100';
    progressStage.textContent = 'Done';
    msg.textContent = 'Published! It now shows in the list below.';
    msg.classList.add('ok');
    document.getElementById('uploadForm').reset();
    await refreshAll();
  } catch(err){
    msg.textContent = err.message || 'Something went wrong. Try again.';
    msg.classList.add('err');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish';
    setTimeout(() => {
      progressWrap.classList.remove('show');
      progressFill.style.width = '0%';
      progressPercent.textContent = '0';
    }, 1200);
  }
});

refreshAll();
