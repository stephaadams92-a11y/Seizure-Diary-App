// ═══════════════════════════════════════════════════════════════════
//  SEIZURRE — app.js
//  © 2026 Stephanie Adams. Personal use only. All rights reserved.
// ═══════════════════════════════════════════════════════════════════

'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────
const DB_NAME    = 'seizurreDB';
const DB_VERSION = 2;
const DARK_KEY   = 'seizurre_dark';
const ONBOARD_KEY = 'seizurre_onboarded';
const SETTINGS_KEY = 'seizurre_settings';

const PRESET_TRIGGERS = [
  'Missed sleep','Stress','Alcohol','Flashing lights','Fever/illness',
  'Missed medication','Hormonal','Dehydration','Overexertion','Screen fatigue',
  'Loud noise','Caffeine','Hunger','Heat','Anxiety'
];

// ─── STATE ────────────────────────────────────────────────────────
let db;
let seizures     = [];
let medications  = [];
let appointments = [];
let notes        = [];
let refills      = [];
let adherenceLogs = [];
let settings     = { emergencyContact: '', voiceEnabled: false, backupReminder: false };

// File System Access
let fileHandle    = null;
let useFileSystem = false;

// ─── IndexedDB INIT ───────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      ['seizures','medications','appointments','notes','refills','adherence'].forEach(store => {
        if (!d.objectStoreNames.contains(store)) {
          d.createObjectStore(store, { keyPath: 'id' });
        }
      });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbPut(store, item) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(item);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(store, id) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

function dbClear(store) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function loadAllFromDB() {
  seizures     = await dbGetAll('seizures');
  medications  = await dbGetAll('medications');
  appointments = await dbGetAll('appointments');
  notes        = await dbGetAll('notes');
  refills      = (await dbGetAll('refills')) || [];
  adherenceLogs = (await dbGetAll('adherence')) || [];
}

async function saveStoreToDB(store, arr) {
  await dbClear(store);
  for (const item of arr) await dbPut(store, item);
}

// ─── FILE SYSTEM ACCESS ───────────────────────────────────────────
async function saveToFile() {
  if (!useFileSystem || !fileHandle) return;
  try {
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(getAllData(), null, 2));
    await writable.close();
    document.getElementById('data-source-text').innerHTML =
      `✅ Saving to: ${fileHandle.name} (auto-saved)`;
  } catch (err) {
    console.error('File save error:', err);
    toast('Could not save to file — permissions lost?', 'error');
    useFileSystem = false; fileHandle = null;
    updateDataSourceStatus();
    recoverFileAccess();
  }
}

async function recoverFileAccess() {
  const lastName = localStorage.getItem('last_data_file_name');
  if (lastName) {
    toast(`File access lost for "${lastName}". Re-open it via "Change file" to restore permanent saving.`, 'error');
  }
}

function getAllData() {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    seizures, medications, appointments, notes, refills, adherenceLogs
  };
}

function setAllData(data) {
  seizures     = data.seizures     || [];
  medications  = data.medications  || [];
  appointments = data.appointments || [];
  notes        = data.notes        || [];
  refills      = data.refills      || [];
  adherenceLogs = data.adherenceLogs || [];
}

async function loadFromFile(handle) {
  try {
    const file = await handle.getFile();
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); }
    catch { data = { seizures:[], medications:[], appointments:[], notes:[], refills:[], adherenceLogs:[] }; }
    if (Array.isArray(data)) data = { seizures: data, medications:[], appointments:[], notes:[], refills:[], adherenceLogs:[] };
    setAllData(data);
    // sync to IndexedDB
    await saveStoreToDB('seizures', seizures);
    await saveStoreToDB('medications', medications);
    await saveStoreToDB('appointments', appointments);
    await saveStoreToDB('notes', notes);
    await saveStoreToDB('refills', refills);
    await saveStoreToDB('adherence', adherenceLogs);
    fileHandle = handle;
    useFileSystem = true;
    localStorage.setItem('last_data_file_name', handle.name);
    updateDataSourceStatus();
    renderAllUI();
    toast(`Loaded from ${handle.name} ✓`, 'success');
  } catch (err) {
    console.error('Load file error:', err);
    toast('Failed to read file', 'error');
    useFileSystem = false; fileHandle = null;
    updateDataSourceStatus();
  }
}

async function pickDataFile() {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    await loadFromFile(handle);
  } catch (err) { if (err.name !== 'AbortError') toast('File selection cancelled', 'error'); }
}

async function createNewDataFile() {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'SeizurreDiaryData.json',
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    const empty = { seizures:[], medications:[], appointments:[], notes:[], refills:[], adherenceLogs:[] };
    const w = await handle.createWritable();
    await w.write(JSON.stringify(empty, null, 2));
    await w.close();
    await loadFromFile(handle);
  } catch (err) { if (err.name !== 'AbortError') toast('Could not create file', 'error'); }
}

async function exportCurrentToFile() {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `seizurre-backup-${new Date().toISOString().slice(0,19)}.json`,
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
    });
    const w = await handle.createWritable();
    await w.write(JSON.stringify(getAllData(), null, 2));
    await w.close();
    toast('Backup saved to file ✓', 'success');
  } catch (err) { if (err.name !== 'AbortError') toast('Export failed', 'error'); }
}

function updateDataSourceStatus() {
  const t = document.getElementById('data-source-text');
  if (useFileSystem && fileHandle) {
    t.innerHTML = `✅ Saving to: <strong>${fileHandle.name}</strong> (immune to browser clear)`;
  } else {
    t.innerHTML = `⚠️ Using IndexedDB only — pick a data file above for permanent off-browser storage.`;
  }
}

// ─── PERSIST ──────────────────────────────────────────────────────
async function persistAll() {
  await saveStoreToDB('seizures', seizures);
  await saveStoreToDB('medications', medications);
  await saveStoreToDB('appointments', appointments);
  await saveStoreToDB('notes', notes);
  await saveStoreToDB('refills', refills);
  await saveStoreToDB('adherence', adherenceLogs);
  if (useFileSystem && fileHandle) await saveToFile();
}

async function mutateAndPersist(cb) {
  cb();
  await persistAll();
  renderAllUI();
}

// ─── UTILS ────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function uid()  { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function niceTime(t) { if(!t) return ''; const [h,m]=t.split(':'); let hr=parseInt(h,10); const ap=hr>=12?'PM':'AM'; hr=hr%12||12; return hr+':'+m+' '+ap; }
function niceDate(iso) { if(!iso) return ''; return new Date(iso+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); }
function monthKey(iso) { return iso?iso.slice(0,7):''; }

function toast(msg, type='') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (type==='error'?' error':type==='success'?' success':'');
  t.textContent = msg;
  t.setAttribute('role','alert');
  c.appendChild(t);
  setTimeout(() => t.remove(), 2900);
}

// ─── CLOCK ────────────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  document.getElementById('clock-time').textContent = n.toLocaleTimeString('en-GB');
  document.getElementById('live-clock-date').textContent =
    n.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

// ─── DARK MODE ────────────────────────────────────────────────────
function applyDark(on) {
  document.body.classList.toggle('dark-mode', on);
  localStorage.setItem(DARK_KEY, on?'1':'0');
  const btn = document.getElementById('dark-toggle-btn');
  if (btn) btn.textContent = on ? '☀️' : '🌙';
}
const savedDark = localStorage.getItem(DARK_KEY);
applyDark(savedDark === null ? true : savedDark === '1');

document.getElementById('dark-toggle-btn').addEventListener('click', () =>
  applyDark(!document.body.classList.contains('dark-mode')));

// ─── SETTINGS ─────────────────────────────────────────────────────
function loadSettings() {
  try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || settings; } catch {}
  document.getElementById('voice-toggle').checked = !!settings.voiceEnabled;
  document.getElementById('backup-remind-toggle').checked = !!settings.backupReminder;
  document.getElementById('emergency-contact-input').value = settings.emergencyContact || '';
  // Show voice btn if enabled
  const vBtn = document.getElementById('sd-voice-btn');
  if (vBtn) vBtn.hidden = !settings.voiceEnabled;
  // Set emergency contact link
  const cc = document.getElementById('call-contact-btn');
  if (cc && settings.emergencyContact) {
    cc.href = 'tel:' + settings.emergencyContact.replace(/\s/g,'');
    cc.hidden = false;
  }
}

document.getElementById('save-settings-btn').addEventListener('click', () => {
  settings.voiceEnabled       = document.getElementById('voice-toggle').checked;
  settings.backupReminder     = document.getElementById('backup-remind-toggle').checked;
  settings.emergencyContact   = document.getElementById('emergency-contact-input').value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  loadSettings();
  // Request notification permission if backup reminder enabled
  if (settings.backupReminder && 'Notification' in window) {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        scheduleBackupReminder();
        toast('Backup reminder enabled ✓', 'success');
      } else {
        toast('Notification permission denied — reminder not set.', 'error');
      }
    });
  }
  toast('Settings saved ✓', 'success');
});

function scheduleBackupReminder() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_BACKUP_REMINDER'
    });
  }
}

// ─── TABS ─────────────────────────────────────────────────────────
let currentTab = 'seizure';
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
  document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
  const tabEl = document.getElementById(tabId+'-tab');
  if (tabEl) tabEl.classList.add('active');
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (tabBtn) { tabBtn.classList.add('active'); tabBtn.setAttribute('aria-selected','true'); }
  const navBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (navBtn) { navBtn.classList.add('active'); navBtn.setAttribute('aria-current','page'); }
  currentTab = tabId;
  if (tabId === 'seizure')  renderSeizureUI();
  if (tabId === 'meds')     renderMedsUI();
  if (tabId === 'triggers') renderTriggersUI();
  if (tabId === 'charts')   renderChartsUI();
  if (tabId === 'more')     { renderAppointmentsUI(); renderNotesUI(); }
}

document.querySelectorAll('.tab-btn, .nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  btn.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); switchTab(btn.dataset.tab); } });
});

// ─── ONLINE/OFFLINE ───────────────────────────────────────────────
function updateOnlineStatus() {
  const chip = document.getElementById('offline-chip');
  chip.hidden = navigator.onLine;
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ─── SW UPDATE ────────────────────────────────────────────────────
document.getElementById('sw-reload-btn').addEventListener('click', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    });
  }
  window.location.reload();
});

// ─── ONBOARDING ───────────────────────────────────────────────────
function checkOnboarding() {
  const banner = document.getElementById('onboarding-banner');
  if (!localStorage.getItem(ONBOARD_KEY)) banner.hidden = false;
}
document.getElementById('close-onboarding').addEventListener('click', () => {
  document.getElementById('onboarding-banner').hidden = true;
  localStorage.setItem(ONBOARD_KEY, '1');
});

// ─── EMERGENCY ────────────────────────────────────────────────────
document.getElementById('emergency-btn').addEventListener('click', () => openModal('emergency-modal'));
document.getElementById('emergency-close').addEventListener('click', () => closeModal('emergency-modal'));

// ─── LOG SEIZURE ──────────────────────────────────────────────────
let pendingSeizureId = null;

async function logNow() {
  const now  = new Date();
  const date = now.toISOString().slice(0,10);
  const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const id   = uid();
  pendingSeizureId = id;
  await mutateAndPersist(() => {
    seizures.unshift({ id, date, time, notes:'', duration:null, type:'', triggers:[], aura:'', createdAt: now.getTime() });
  });
  const btn = document.getElementById('log-now-btn');
  btn.classList.add('saved');
  btn.innerHTML = '✓ &nbsp;Saved';
  setTimeout(() => {
    btn.classList.remove('saved');
    btn.innerHTML = '<span class="log-btn-icon" aria-hidden="true">⚡</span> Log Seizure';
  }, 1200);
  toast('✓ Logged at ' + niceTime(time));
  buildTriggerChips('sd-trigger-chips');
  document.getElementById('sd-duration').value = '';
  document.getElementById('sd-type').value = '';
  document.getElementById('sd-notes').value = '';
  openModal('seizure-detail-modal');
}
document.getElementById('log-now-btn').addEventListener('click', logNow);

document.getElementById('sd-save-btn').addEventListener('click', async () => {
  if (!pendingSeizureId) { closeModal('seizure-detail-modal'); return; }
  const dur     = parseInt(document.getElementById('sd-duration').value) || null;
  const type    = document.getElementById('sd-type').value;
  const notes_v = document.getElementById('sd-notes').value.trim();
  const chips   = [...document.querySelectorAll('#sd-trigger-chips .trigger-chip.selected')].map(c => c.dataset.trigger);
  await mutateAndPersist(() => {
    const idx = seizures.findIndex(s => s.id === pendingSeizureId);
    if (idx !== -1) Object.assign(seizures[idx], { duration: dur, type, notes: notes_v, triggers: chips });
  });
  pendingSeizureId = null;
  closeModal('seizure-detail-modal');
  toast('Details saved ✓', 'success');
});
document.getElementById('sd-skip-btn').addEventListener('click', () => {
  pendingSeizureId = null;
  closeModal('seizure-detail-modal');
});

// Voice-to-text for notes
document.getElementById('sd-voice-btn').addEventListener('click', () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    toast('Voice recognition not supported on this browser.', 'error'); return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'en-GB';
  rec.interimResults = false;
  rec.onresult = e => {
    const txt = e.results[0][0].transcript;
    const ta  = document.getElementById('sd-notes');
    ta.value += (ta.value ? ' ' : '') + txt;
    toast('Voice note added ✓', 'success');
  };
  rec.onerror = () => toast('Voice recognition failed.', 'error');
  rec.start();
  toast('Listening… speak now');
});

// ─── SEIZURE UI ───────────────────────────────────────────────────
function renderSeizureUI() {
  renderStats();
  populateMonthFilter();
  renderList();
  renderHeatmap();
  populateTriggerSeizureSelect();
}

function renderStats() {
  const total = seizures.length;
  const monKey = new Date().toISOString().slice(0,7);
  const mon  = seizures.filter(s => monthKey(s.date) === monKey).length;
  const yr   = new Date().getFullYear().toString();
  const year = seizures.filter(s => s.date && s.date.startsWith(yr)).length;
  // Average per month (last 3)
  const months = [...new Set(seizures.map(s => monthKey(s.date)).filter(Boolean))].sort().slice(-3);
  const avg3 = months.length ? (months.reduce((a,m) => a + seizures.filter(s=>monthKey(s.date)===m).length, 0) / months.length).toFixed(1) : '—';
  document.getElementById('stats-row').innerHTML = `
    <div class="stat-chip">Total: <span>${total}</span></div>
    <div class="stat-chip">This month: <span>${mon}</span></div>
    <div class="stat-chip">This year: <span>${year}</span></div>
    <div class="stat-chip">Avg/month (3mo): <span>${avg3}</span></div>`;
}

function populateMonthFilter() {
  const sel = document.getElementById('filter-month');
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  [...new Set(seizures.map(s => monthKey(s.date)).filter(Boolean))].sort().reverse().forEach(m => {
    const label = new Date(m+'-01T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
    sel.appendChild(Object.assign(document.createElement('option'), { value:m, textContent:label }));
  });
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}
document.getElementById('filter-month').addEventListener('change', renderList);

function renderList() {
  const list = document.getElementById('seizure-log-list');
  const filter = document.getElementById('filter-month').value;
  let shown = [...seizures].sort((a,b) => b.createdAt - a.createdAt);
  if (filter !== 'all') shown = shown.filter(s => monthKey(s.date) === filter);
  if (!shown.length) {
    list.innerHTML = `<div class="no-records">No records${filter!=='all'?' for this month':' yet'}.</div>`;
    return;
  }
  list.innerHTML = '';
  shown.forEach(s => {
    const card = document.createElement('div');
    card.className = 'seizure-card';
    card.setAttribute('role','article');
    card.dataset.id = s.id;
    const durStr  = s.duration ? `<span class="detail-tag">⏱ ${s.duration}s</span>` : '';
    const typeStr = s.type     ? `<span class="detail-tag">🧠 ${esc(s.type)}</span>` : '';
    const trigStr = (s.triggers||[]).length ? `<span class="detail-tag">🎯 ${s.triggers.map(esc).join(', ')}</span>` : '';
    const auraStr = s.aura     ? `<span class="detail-tag">✨ ${esc(s.aura)}</span>` : '';
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-datetime">${esc(niceTime(s.time))}&ensp;·&ensp;${esc(s.date?s.date.split('-').reverse().join('/'):'')}</div>
          <div class="card-date-sub">${esc(niceDate(s.date))}</div>
          <div class="detail-tags">${durStr}${typeStr}${trigStr}${auraStr}</div>
        </div>
        <button class="icon-btn" data-del="${esc(s.id)}" aria-label="Delete seizure record" title="Delete">🗑️</button>
      </div>
      <div class="card-notes-area">
        <div class="card-notes-text${s.notes?'':' empty'}" id="nt-${esc(s.id)}">${s.notes?esc(s.notes):'No notes yet.'}</div>
        <div class="notes-editor" id="ne-${esc(s.id)}">
          <textarea id="ta-${esc(s.id)}" aria-label="Edit seizure notes">${esc(s.notes)}</textarea>
          <div class="notes-editor-btns">
            <button class="save-notes-btn" data-save="${esc(s.id)}">Save notes</button>
            <button class="cancel-notes-btn" data-cancel="${esc(s.id)}">Cancel</button>
          </div>
        </div>
        <button class="add-notes-btn" id="nb-${esc(s.id)}" data-toggle="${esc(s.id)}" aria-expanded="false">${s.notes?'✏️ Edit notes':'+ Add notes'}</button>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.del,'seizure')));
  list.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => openNotesEditor(b.dataset.toggle)));
  list.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => saveNotes(b.dataset.save)));
  list.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => closeNotesEditor(b.dataset.cancel)));
}

function openNotesEditor(id) {
  document.getElementById('ne-'+id)?.classList.add('open');
  const nb = document.getElementById('nb-'+id);
  if (nb) { nb.style.display='none'; nb.setAttribute('aria-expanded','true'); }
  const ta = document.getElementById('ta-'+id);
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
function closeNotesEditor(id) {
  document.getElementById('ne-'+id)?.classList.remove('open');
  const nb = document.getElementById('nb-'+id);
  if (nb) { nb.style.display=''; nb.setAttribute('aria-expanded','false'); }
}
async function saveNotes(id) {
  const ta  = document.getElementById('ta-'+id);
  const txt = ta ? ta.value.trim() : '';
  const idx = seizures.findIndex(s => s.id === id);
  if (idx !== -1) {
    await mutateAndPersist(() => { seizures[idx].notes = txt; });
    closeNotesEditor(id);
    const nt = document.getElementById('nt-'+id);
    if (nt) { nt.textContent = txt||'No notes yet.'; nt.className='card-notes-text'+(txt?'':' empty'); }
    document.getElementById('nb-'+id).textContent = txt?'✏️ Edit notes':'+ Add notes';
    toast('Notes saved ✓');
  }
}

// ─── HEATMAP ──────────────────────────────────────────────────────
function renderHeatmap() {
  const grid = document.getElementById('heatmap-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const today = new Date();
  // Build 84-day (12 weeks) map
  const map = {};
  seizures.forEach(s => { map[s.date] = (map[s.date]||0) + 1; });
  const maxVal = Math.max(1, ...Object.values(map));
  // Start from 83 days ago (Mon-aligned)
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 83);
  // Pad to Monday
  const dayOfWeek = startDate.getDay(); // 0=Sun
  const padDays = (dayOfWeek === 0) ? 0 : dayOfWeek; // keep Sun as first col
  for (let i = 0; i < 84; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0,10);
    const count = map[key] || 0;
    const intensity = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxVal) * 4));
    const cell = document.createElement('div');
    cell.className = `heatmap-cell h${intensity}`;
    cell.title = `${key}: ${count} seizure${count!==1?'s':''}`;
    cell.setAttribute('aria-label', `${key}: ${count} seizure${count!==1?'s':''}`);
    grid.appendChild(cell);
  }
}

// ─── DELETE / CONFIRM ─────────────────────────────────────────────
let deleteTarget = null, deleteType = null;
function confirmDelete(id, type) {
  deleteTarget = id; deleteType = type;
  openModal('confirm-modal');
}
document.getElementById('confirm-delete-yes').addEventListener('click', async () => {
  if (deleteTarget) {
    if (deleteType === 'seizure')     await mutateAndPersist(() => { seizures     = seizures.filter(s=>s.id!==deleteTarget); });
    if (deleteType === 'medication')  await mutateAndPersist(() => { medications  = medications.filter(m=>m.id!==deleteTarget); });
    if (deleteType === 'appointment') await mutateAndPersist(() => { appointments = appointments.filter(a=>a.id!==deleteTarget); });
    if (deleteType === 'note')        await mutateAndPersist(() => { notes        = notes.filter(n=>n.id!==deleteTarget); });
    if (deleteType === 'refill')      await mutateAndPersist(() => { refills      = refills.filter(r=>r.id!==deleteTarget); });
    toast('Deleted.');
  }
  deleteTarget = deleteType = null;
  closeModal('confirm-modal');
});
document.getElementById('confirm-delete-no').addEventListener('click', () => {
  deleteTarget = deleteType = null; closeModal('confirm-modal');
});

// ─── CLEAR ALL ────────────────────────────────────────────────────
document.getElementById('clear-all-btn').addEventListener('click', () => openModal('clear-all-modal'));
document.getElementById('clear-all-cancel1').addEventListener('click', () => closeModal('clear-all-modal'));
document.getElementById('clear-all-confirm1').addEventListener('click', () => {
  closeModal('clear-all-modal');
  openModal('clear-all-modal2');
});
document.getElementById('clear-all-cancel2').addEventListener('click', () => closeModal('clear-all-modal2'));
document.getElementById('clear-all-confirm2').addEventListener('click', async () => {
  await mutateAndPersist(() => {
    seizures=[]; medications=[]; appointments=[]; notes=[]; refills=[]; adherenceLogs=[];
  });
  closeModal('clear-all-modal2');
  toast('All data cleared.', 'success');
});

// ─── MEDICATIONS ──────────────────────────────────────────────────
function renderMedsUI() {
  renderMedicationsUI();
  renderDoseHistory();
  renderRefillList();
  renderAdheranceSummary();
}

function renderDoseHistory() {
  const sel  = document.getElementById('dose-history-med-select');
  const list = document.getElementById('dose-history-list');
  if (!sel || !list) return;

  // Populate selector
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Select medication —</option>';
  medications.forEach(med => {
    const opt = document.createElement('option');
    opt.value = med.id;
    opt.textContent = med.name;
    sel.appendChild(opt);
  });
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;

  const medId = sel.value;
  if (!medId || !medications.length) {
    list.innerHTML = '<div class="no-records">Select a medication above to view its dose history.</div>';
    return;
  }

  const med = medications.find(m => m.id === medId);
  if (!med) { list.innerHTML = ''; return; }

  const times = (med.times || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!times.length) {
    list.innerHTML = '<div class="no-records">No dose times set for this medication.</div>';
    return;
  }

  // Build last 30 days
  const rows = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const logsForDay = adherenceLogs.filter(l => l.medId === medId && l.date === dateKey);
    const takenTimes = logsForDay.map(l => l.time);
    const allTaken   = times.every(t => takenTimes.includes(t));
    const noneTaken  = times.every(t => !takenTimes.includes(t));
    const isToday    = i === 0;
    rows.push({ dateKey, dayLabel, times, takenTimes, allTaken, noneTaken, isToday });
  }

  list.innerHTML = '';
  const table = document.createElement('div');
  table.className = 'dose-history-table';
  rows.forEach(r => {
    const row = document.createElement('div');
    row.className = 'dose-history-row' + (r.isToday ? ' today' : '') +
                    (r.allTaken ? ' all-taken' : r.noneTaken && !r.isToday ? ' none-taken' : '');
    const doseDots = r.times.map(t => {
      const taken = r.takenTimes.includes(t);
      return `<span class="dose-dot ${taken ? 'taken' : 'missed'}" title="${t}: ${taken ? 'taken' : 'missed'}" aria-label="${t} ${taken ? 'taken' : 'missed'}"></span>`;
    }).join('');
    const statusIcon = r.allTaken ? '✅' : r.noneTaken ? (r.isToday ? '⏳' : '❌') : '⚠️';
    row.innerHTML = `
      <div class="dh-date">${r.isToday ? '<strong>Today</strong>' : r.dayLabel}</div>
      <div class="dh-dots">${doseDots}</div>
      <div class="dh-status" aria-label="${r.allTaken ? 'All taken' : r.noneTaken ? 'None taken' : 'Partially taken'}">${statusIcon}</div>`;
    table.appendChild(row);
  });
  list.appendChild(table);

  const legend = document.createElement('div');
  legend.className = 'dh-legend';
  legend.innerHTML = `<span class="dose-dot taken"></span> Taken &ensp; <span class="dose-dot missed"></span> Missed/not logged`;
  list.appendChild(legend);
}

// Wire the selector change
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('dose-history-med-select');
  if (sel) sel.addEventListener('change', renderDoseHistory);
});

function renderMedicationsUI() {
  const c = document.getElementById('medications-list');
  if (!medications.length) {
    c.innerHTML = '<div class="no-records">No medications added yet.<br>Tap "+ Add" to start.</div>'; return;
  }
  c.innerHTML = '';
  [...medications].sort((a,b)=>a.name.localeCompare(b.name)).forEach(med => {
    const card = document.createElement('div');
    card.className = 'med-card';
    card.setAttribute('role','article');
    const todayKey = new Date().toISOString().slice(0,10);
    const logs = adherenceLogs.filter(l => l.medId === med.id && l.date === todayKey);
    const times = (med.times||'').split(',').map(t=>t.trim()).filter(Boolean);
    const timesHtml = times.map(t => {
      const taken = logs.some(l => l.time === t);
      return `<button class="dose-chip ${taken?'taken':''}" data-med="${esc(med.id)}" data-time="${esc(t)}" 
        aria-label="${taken?'Taken':'Mark as taken'} at ${esc(t)}" aria-pressed="${taken}">${esc(t)} ${taken?'✓':''}</button>`;
    }).join('');
    card.innerHTML = `
      <div class="card-top">
        <div>
          <strong>${esc(med.name)}</strong>
          <div class="card-date-sub">${esc(med.dose)} · ${esc(med.frequency||'')}</div>
          ${med.quantityPerDose?`<div class="card-date-sub">Qty/dose: ${esc(med.quantityPerDose)}</div>`:''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="icon-btn edit-med" data-id="${esc(med.id)}" aria-label="Edit ${esc(med.name)}">✏️</button>
          <button class="icon-btn delete-med" data-id="${esc(med.id)}" aria-label="Delete ${esc(med.name)}">🗑️</button>
        </div>
      </div>
      ${times.length?`<div class="dose-times" aria-label="Dose times for today">${timesHtml}</div>`:''}`;
    c.appendChild(card);
  });
  c.querySelectorAll('.edit-med').forEach(b => b.addEventListener('click', () => openMedModal(b.dataset.id)));
  c.querySelectorAll('.delete-med').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.id,'medication')));
  c.querySelectorAll('.dose-chip').forEach(b => b.addEventListener('click', () => toggleDose(b.dataset.med, b.dataset.time)));
}

async function toggleDose(medId, time) {
  const todayKey = new Date().toISOString().slice(0,10);
  const existing = adherenceLogs.findIndex(l => l.medId===medId && l.date===todayKey && l.time===time);
  if (existing !== -1) {
    await mutateAndPersist(() => { adherenceLogs.splice(existing,1); });
    toast('Dose unmarked.');
  } else {
    await mutateAndPersist(() => { adherenceLogs.push({ id:uid(), medId, date:todayKey, time, takenAt: Date.now() }); });
    toast('Dose marked as taken ✓', 'success');
  }
}

function renderAdheranceSummary() {
  const box   = document.getElementById('adherence-summary');
  const pills = document.getElementById('adherence-pills');
  if (!medications.length) { box.hidden = true; return; }
  box.hidden = false;
  const todayKey = new Date().toISOString().slice(0,10);
  pills.innerHTML = medications.map(med => {
    const times = (med.times||'').split(',').map(t=>t.trim()).filter(Boolean);
    if (!times.length) return '';
    const taken = times.filter(t => adherenceLogs.some(l=>l.medId===med.id&&l.date===todayKey&&l.time===t)).length;
    const pct = Math.round((taken/times.length)*100);
    return `<div class="adh-pill">
      <div class="adh-name">${esc(med.name)}</div>
      <div class="adh-bar"><div class="adh-fill" style="width:${pct}%"></div></div>
      <div class="adh-label">${taken}/${times.length}</div>
    </div>`;
  }).join('');
}

function renderRefillList() {
  const c = document.getElementById('refill-list');
  if (!refills.length) { c.innerHTML = '<div class="no-records">No refill reminders set.</div>'; return; }
  c.innerHTML = '';
  const today = new Date().toISOString().slice(0,10);
  [...refills].sort((a,b)=>a.date.localeCompare(b.date)).forEach(r => {
    const urgent = r.date <= today;
    const card = document.createElement('div');
    card.className = `refill-card${urgent?' urgent':''}`;
    card.setAttribute('role','article');
    card.innerHTML = `
      <div class="card-top">
        <div>
          <strong>${esc(r.med)}</strong>
          <div class="card-date-sub">Refill by: ${esc(r.date)}${r.qty?` · ${esc(r.qty)} units left`:''}</div>
        </div>
        <button class="icon-btn" data-del="${esc(r.id)}" aria-label="Delete refill reminder">🗑️</button>
      </div>`;
    c.appendChild(card);
  });
  c.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.del,'refill')));
}

let currentMedId = null;
function openMedModal(id=null) {
  currentMedId = id;
  document.getElementById('med-modal-title').textContent = id ? 'Edit Medication' : 'Add Medication';
  const med = id ? medications.find(m=>m.id===id) : null;
  document.getElementById('med-name').value     = med?.name || '';
  document.getElementById('med-dose').value     = med?.dose || '';
  document.getElementById('med-frequency').value = med?.frequency || '';
  document.getElementById('med-times').value    = med?.times || '';
  document.getElementById('med-quantity').value = med?.quantityPerDose || '';
  openModal('med-modal');
  document.getElementById('med-name').focus();
}
document.getElementById('add-med-btn').addEventListener('click', () => openMedModal());
document.getElementById('med-cancel').addEventListener('click', () => closeModal('med-modal'));
document.getElementById('med-save').addEventListener('click', async () => {
  const name = document.getElementById('med-name').value.trim();
  if (!name) { toast('Medication name required', 'error'); return; }
  const dose = document.getElementById('med-dose').value.trim();
  const freq = document.getElementById('med-frequency').value.trim();
  const times = document.getElementById('med-times').value.trim();
  const qty  = document.getElementById('med-quantity').value.trim();
  await mutateAndPersist(() => {
    if (currentMedId) {
      const idx = medications.findIndex(m=>m.id===currentMedId);
      if (idx!==-1) medications[idx] = {...medications[idx], name, dose, frequency:freq, times, quantityPerDose:qty};
    } else {
      medications.push({ id:uid(), name, dose, frequency:freq, times, quantityPerDose:qty, createdAt:Date.now() });
    }
  });
  closeModal('med-modal');
  toast('Medication saved ✓', 'success');
});

// Refill modal
document.getElementById('add-refill-btn').addEventListener('click', () => {
  document.getElementById('refill-med').value = '';
  document.getElementById('refill-date').value = '';
  document.getElementById('refill-qty').value = '';
  openModal('refill-modal');
  document.getElementById('refill-med').focus();
});
document.getElementById('refill-cancel').addEventListener('click', () => closeModal('refill-modal'));
document.getElementById('refill-save').addEventListener('click', async () => {
  const med  = document.getElementById('refill-med').value.trim();
  const date = document.getElementById('refill-date').value;
  const qty  = document.getElementById('refill-qty').value;
  if (!med || !date) { toast('Medication name and date required', 'error'); return; }
  await mutateAndPersist(() => { refills.push({ id:uid(), med, date, qty, createdAt:Date.now() }); });
  closeModal('refill-modal');
  toast('Refill reminder saved ✓', 'success');
});

// ─── TRIGGERS ─────────────────────────────────────────────────────
function buildTriggerChips(containerId, selectedTriggers=[]) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  PRESET_TRIGGERS.forEach(t => {
    const chip = document.createElement('button');
    chip.className = 'trigger-chip' + (selectedTriggers.includes(t)?' selected':'');
    chip.dataset.trigger = t;
    chip.textContent = t;
    chip.setAttribute('aria-pressed', selectedTriggers.includes(t));
    chip.setAttribute('type','button');
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      chip.setAttribute('aria-pressed', chip.classList.contains('selected'));
    });
    container.appendChild(chip);
  });
}

function populateTriggerSeizureSelect() {
  const sel = document.getElementById('trigger-seizure-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Pick a seizure —</option>';
  [...seizures].sort((a,b)=>b.createdAt-a.createdAt).slice(0,20).forEach(s => {
    const label = `${s.date?s.date.split('-').reverse().join('/'):''}  ${niceTime(s.time)}`;
    sel.appendChild(Object.assign(document.createElement('option'), { value:s.id, textContent:label }));
  });
  if ([...sel.options].some(o=>o.value===cur)) sel.value = cur;
}

function renderTriggersUI() {
  buildTriggerChips('trigger-preset-grid');
  populateTriggerSeizureSelect();
  renderTriggerFreq();
}

function renderTriggerFreq() {
  const container = document.getElementById('trigger-freq-list');
  if (!container) return;
  const freq = {};
  seizures.forEach(s => (s.triggers||[]).forEach(t => { freq[t]=(freq[t]||0)+1; }));
  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  if (!sorted.length) { container.innerHTML = '<div class="no-records">No triggers logged yet.</div>'; return; }
  const max = sorted[0][1];
  container.innerHTML = sorted.map(([t,n]) => `
    <div class="freq-row">
      <span class="freq-label">${esc(t)}</span>
      <div class="freq-bar-wrap"><div class="freq-bar" style="width:${Math.round((n/max)*100)}%"></div></div>
      <span class="freq-count">${n}</span>
    </div>`).join('');
}

document.getElementById('save-triggers-btn').addEventListener('click', async () => {
  const sid = document.getElementById('trigger-seizure-select').value;
  if (!sid) { toast('Please select a seizure first', 'error'); return; }
  const chips  = [...document.querySelectorAll('#trigger-preset-grid .trigger-chip.selected')].map(c=>c.dataset.trigger);
  const custom = document.getElementById('trigger-custom-input').value.trim();
  const aura   = document.getElementById('aura-select').value;
  if (custom) chips.push(custom);
  await mutateAndPersist(() => {
    const idx = seizures.findIndex(s=>s.id===sid);
    if (idx!==-1) { seizures[idx].triggers = chips; seizures[idx].aura = aura; }
  });
  document.getElementById('trigger-custom-input').value = '';
  document.getElementById('aura-select').value = '';
  document.querySelectorAll('#trigger-preset-grid .trigger-chip').forEach(c=>{ c.classList.remove('selected'); c.setAttribute('aria-pressed','false'); });
  toast('Triggers saved ✓', 'success');
});

// ─── CHARTS ───────────────────────────────────────────────────────
function renderChartsUI() {
  drawTrendChart();
  drawTodChart();
  renderCorrelation();
  renderSummaryStats();
}

function drawTrendChart() {
  const canvas = document.getElementById('trend-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Last 12 months
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0,7));
  }
  const counts = months.map(m => seizures.filter(s=>monthKey(s.date)===m).length);
  const labels = months.map(m => {
    const d = new Date(m+'-01T12:00:00');
    return d.toLocaleDateString('en-GB',{month:'short'});
  });
  drawBarChart(ctx, canvas, labels, counts, '#f44336', 'Seizures');
}

function drawTodChart() {
  const canvas = document.getElementById('tod-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const slots = ['00-04','04-08','08-12','12-16','16-20','20-24'];
  const counts = slots.map((_,i) => seizures.filter(s => {
    if (!s.time) return false;
    const h = parseInt(s.time.split(':')[0], 10);
    return h >= i*4 && h < (i+1)*4;
  }).length);
  drawBarChart(ctx, canvas, slots, counts, '#7e57c2', 'Seizures');
}

function drawBarChart(ctx, canvas, labels, data, color, label) {
  const W = canvas.parentElement.clientWidth || 300;
  canvas.width  = W;
  canvas.height = parseInt(canvas.getAttribute('height')) || 180;
  const H       = canvas.height;
  const pad     = { top:20, right:10, bottom:36, left:36 };
  const chartW  = W - pad.left - pad.right;
  const chartH  = H - pad.top  - pad.bottom;
  const maxVal  = Math.max(1, ...data);
  const isDark  = document.body.classList.contains('dark-mode');
  const textCol = isDark ? '#b0bec5' : '#555';
  const gridCol = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = 'transparent';

  // Gridlines
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  for (let i=0; i<=4; i++) {
    const y = pad.top + chartH - (i/4)*chartH;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+chartW,y); ctx.stroke();
    ctx.fillStyle = textCol;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i/4)*maxVal), pad.left-4, y+3);
  }

  // Bars
  const barW = (chartW / data.length) * 0.6;
  const gap  = (chartW / data.length);
  data.forEach((v,i) => {
    const x = pad.left + i*gap + gap*0.2;
    const bh = (v/maxVal)*chartH;
    const y  = pad.top + chartH - bh;
    ctx.fillStyle = color + (document.body.classList.contains('dark-mode')?'cc':'bb');
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x,y,barW,bh,4) : ctx.rect(x,y,barW,bh);
    ctx.fill();
    // label
    ctx.fillStyle = textCol;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x+barW/2, H-pad.bottom+14);
    if (v>0) ctx.fillText(v, x+barW/2, y-3);
  });
}

function renderCorrelation() {
  const c = document.getElementById('correlation-list');
  if (!c) return;
  const freq = {};
  seizures.forEach(s => (s.triggers||[]).forEach(t => { freq[t]=(freq[t]||0)+1; }));
  const total = seizures.length || 1;
  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if (!sorted.length) { c.innerHTML = '<div class="no-records">Log triggers to see correlations.</div>'; return; }
  c.innerHTML = sorted.map(([t,n]) => {
    const pct = Math.round((n/total)*100);
    return `<div class="corr-row">
      <span class="corr-label">${esc(t)}</span>
      <div class="corr-bar-wrap"><div class="corr-bar" style="width:${pct}%"></div></div>
      <span class="corr-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function renderSummaryStats() {
  const c = document.getElementById('summary-stats');
  if (!c || !seizures.length) {
    if (c) c.innerHTML = '<div class="no-records">No data yet.</div>';
    return;
  }
  const durations = seizures.map(s=>s.duration).filter(Boolean);
  const avgDur = durations.length ? (durations.reduce((a,b)=>a+b,0)/durations.length).toFixed(0) : '—';
  const maxDur = durations.length ? Math.max(...durations) : '—';
  const longestGap = (() => {
    if (seizures.length < 2) return '—';
    const sorted = [...seizures].sort((a,b)=>a.createdAt-b.createdAt);
    let max = 0;
    for (let i=1; i<sorted.length; i++) {
      max = Math.max(max, sorted[i].createdAt - sorted[i-1].createdAt);
    }
    return Math.round(max / 86400000) + ' days';
  })();
  const mostCommonType = (() => {
    const types = seizures.map(s=>s.type).filter(Boolean);
    if (!types.length) return '—';
    const freq = {}; types.forEach(t=>{ freq[t]=(freq[t]||0)+1; });
    return Object.entries(freq).sort((a,b)=>b[1]-a[1])[0][0];
  })();
  c.innerHTML = `
    <div class="stat-grid">
      <div class="stat-item"><div class="stat-val">${seizures.length}</div><div class="stat-lbl">Total Seizures</div></div>
      <div class="stat-item"><div class="stat-val">${avgDur}s</div><div class="stat-lbl">Avg Duration</div></div>
      <div class="stat-item"><div class="stat-val">${maxDur}${maxDur!=='—'?'s':''}</div><div class="stat-lbl">Longest</div></div>
      <div class="stat-item"><div class="stat-val">${longestGap}</div><div class="stat-lbl">Longest gap</div></div>
      <div class="stat-item" style="grid-column:1/-1"><div class="stat-val" style="font-size:1rem">${esc(mostCommonType)}</div><div class="stat-lbl">Most common type</div></div>
    </div>`;
}

// ─── APPOINTMENTS ─────────────────────────────────────────────────
function renderAppointmentsUI() {
  const c = document.getElementById('appointments-list');
  const sorted = [...appointments].sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
  if (!sorted.length) { c.innerHTML = '<div class="no-records">No appointments yet.<br>Tap "+ Add" to start.</div>'; return; }
  c.innerHTML = '';
  sorted.forEach(a => {
    const dt = new Date(a.datetime);
    const isPast = dt < new Date();
    const card = document.createElement('div');
    card.className = 'appt-card' + (isPast?' past':'');
    card.setAttribute('role','article');
    card.innerHTML = `
      <div class="card-top">
        <div>
          <strong>${esc(a.title)}</strong>
          <div class="card-date-sub">${dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'})} at ${dt.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
          <div class="card-date-sub">📍 ${esc(a.location||'—')} · 👤 ${esc(a.withWhom||'—')}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="icon-btn edit-appt" data-id="${esc(a.id)}" aria-label="Edit ${esc(a.title)}">✏️</button>
          <button class="icon-btn delete-appt" data-id="${esc(a.id)}" aria-label="Delete ${esc(a.title)}">🗑️</button>
        </div>
      </div>`;
    c.appendChild(card);
  });
  c.querySelectorAll('.edit-appt').forEach(b => b.addEventListener('click', () => openApptModal(b.dataset.id)));
  c.querySelectorAll('.delete-appt').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.id,'appointment')));
}

let currentApptId = null;
function openApptModal(id=null) {
  currentApptId = id;
  document.getElementById('appt-modal-title').textContent = id ? 'Edit Appointment' : 'Add Appointment';
  const a = id ? appointments.find(x=>x.id===id) : null;
  document.getElementById('appt-title').value    = a?.title    || '';
  document.getElementById('appt-location').value = a?.location || '';
  document.getElementById('appt-datetime').value = a?.datetime || '';
  document.getElementById('appt-with').value     = a?.withWhom || '';
  openModal('appt-modal');
  document.getElementById('appt-title').focus();
}
document.getElementById('add-appt-btn').addEventListener('click', () => openApptModal());
document.getElementById('appt-cancel').addEventListener('click', () => closeModal('appt-modal'));
document.getElementById('appt-save').addEventListener('click', async () => {
  const title    = document.getElementById('appt-title').value.trim();
  const datetime = document.getElementById('appt-datetime').value;
  if (!title || !datetime) { toast('Title and date required', 'error'); return; }
  const location = document.getElementById('appt-location').value.trim();
  const withWhom = document.getElementById('appt-with').value.trim();
  await mutateAndPersist(() => {
    if (currentApptId) {
      const idx = appointments.findIndex(a=>a.id===currentApptId);
      if (idx!==-1) appointments[idx] = {...appointments[idx], title, location, datetime, withWhom};
    } else {
      appointments.push({ id:uid(), title, location, datetime, withWhom, createdAt:Date.now() });
    }
  });
  closeModal('appt-modal');
  toast('Appointment saved ✓', 'success');
});

// ─── NOTES ────────────────────────────────────────────────────────
function renderNotesUI() {
  const c = document.getElementById('notes-list');
  if (!notes.length) { c.innerHTML = '<div class="no-records">No notes yet.<br>Tap "+ New" to start.</div>'; return; }
  c.innerHTML = '';
  [...notes].sort((a,b)=>b.updatedAt-a.updatedAt).forEach(n => {
    const updStr = new Date(n.updatedAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const card = document.createElement('div');
    card.className = 'note-card';
    card.setAttribute('role','article');
    card.innerHTML = `
      <div class="note-card-header">
        <input class="note-title-input" data-nid="${esc(n.id)}" type="text" value="${esc(n.title)}" 
          placeholder="Note title…" maxlength="80" aria-label="Note title">
        <button class="note-delete-btn" data-ndel="${esc(n.id)}" aria-label="Delete note">🗑️</button>
      </div>
      <div class="note-meta">Last edited: ${updStr}</div>
      <textarea class="note-body-textarea" data-nid="${esc(n.id)}" rows="5" 
        placeholder="Type your note here…" aria-label="Note body">${esc(n.body)}</textarea>
      <div class="note-save-row">
        <span class="note-saved-label" id="nsl-${esc(n.id)}">Saved ✓</span>
        <button class="note-save-btn" data-nsave="${esc(n.id)}">Save</button>
      </div>`;
    c.appendChild(card);
  });
  c.querySelectorAll('[data-nsave]').forEach(b => b.addEventListener('click', () => saveNote(b.dataset.nsave)));
  c.querySelectorAll('[data-ndel]').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.ndel,'note')));
  c.querySelectorAll('.note-body-textarea, .note-title-input').forEach(el => {
    el.addEventListener('blur', () => saveNote(el.dataset.nid, true));
  });
}

async function saveNote(id, silent=false) {
  const idx = notes.findIndex(n=>n.id===id);
  if (idx===-1) return;
  const titleEl = document.querySelector(`.note-title-input[data-nid="${id}"]`);
  const bodyEl  = document.querySelector(`.note-body-textarea[data-nid="${id}"]`);
  await mutateAndPersist(() => {
    if (titleEl) notes[idx].title = titleEl.value.trim();
    if (bodyEl)  notes[idx].body  = bodyEl.value;
    notes[idx].updatedAt = Date.now();
  });
  const lbl = document.getElementById('nsl-'+id);
  if (lbl) { lbl.classList.add('show'); setTimeout(()=>lbl.classList.remove('show'),2000); }
  if (!silent) toast('Note saved ✓');
}

document.getElementById('add-note-btn').addEventListener('click', async () => {
  await mutateAndPersist(() => {
    notes.unshift({ id:uid(), title:'', body:'', updatedAt:Date.now() });
  });
  renderNotesUI();
  setTimeout(() => { document.querySelector('.note-title-input')?.focus(); }, 100);
});

// ─── EXPORT ───────────────────────────────────────────────────────
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type}));
  a.download = name;
  a.click();
  toast('Download started ✓', 'success');
}

function exportTxt() {
  if (!seizures.length) { toast('No records to export.', 'error'); return; }
  const sorted = [...seizures].sort((a,b)=>a.createdAt-b.createdAt);
  let txt = `SEIZURRE — SEIZURE LOG\nGenerated: ${new Date().toLocaleString()}\nTotal: ${seizures.length}\n${'═'.repeat(44)}\n\n`;
  sorted.forEach((s,i) => {
    txt += `#${i+1}  ${niceDate(s.date)}  –  ${niceTime(s.time)}\n`;
    if (s.duration) txt += `Duration: ${s.duration}s\n`;
    if (s.type)     txt += `Type: ${s.type}\n`;
    if ((s.triggers||[]).length) txt += `Triggers: ${s.triggers.join(', ')}\n`;
    if (s.aura)     txt += `Aura: ${s.aura}\n`;
    if (s.notes)    txt += `Notes: ${s.notes}\n`;
    txt += '\n';
  });
  download('seizurre-log.txt', txt, 'text/plain');
}

function exportCSV() {
  if (!seizures.length) { toast('No records to export.', 'error'); return; }
  const header = ['Date','Time','Day','Duration (s)','Type','Triggers','Aura','Notes'];
  const rows = [...seizures].sort((a,b)=>a.createdAt-b.createdAt).map(s => [
    s.date || '',
    s.time || '',
    s.date ? new Date(s.date+'T12:00:00').toLocaleDateString('en-GB',{weekday:'long'}) : '',
    s.duration || '',
    s.type || '',
    (s.triggers||[]).join('; '),
    s.aura || '',
    (s.notes||'').replace(/"/g,'""')
  ]);
  const csv = [header, ...rows].map(r => r.map(v=>`"${v}"`).join(',')).join('\r\n');
  download(`seizurre-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv;charset=utf-8;');
}

function exportPDF() {
  if (!seizures.length) { toast('No records to export.', 'error'); return; }
  const sorted = [...seizures].sort((a,b)=>a.createdAt-b.createdAt);
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;font-size:12pt;margin:20mm}
    h1{color:#6a1b9a}h2{color:#444;font-size:11pt;margin:16px 0 4px}
    .row{border-bottom:1px solid #eee;padding:8px 0}
    .label{font-weight:bold;color:#555}
    .tag{background:#f3e5f5;color:#6a1b9a;padding:2px 7px;border-radius:10px;font-size:10pt;margin:2px}
    @media print{body{margin:10mm}}</style>
    </head><body>
    <h1>Seizurre – Seizure Log</h1>
    <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; Total seizures: ${seizures.length}</p><hr>`;
  sorted.forEach((s,i) => {
    html += `<div class="row"><h2>#${i+1} — ${niceDate(s.date)} at ${niceTime(s.time)}</h2>`;
    if (s.duration) html += `<span class="label">Duration:</span> ${s.duration}s<br>`;
    if (s.type)     html += `<span class="label">Type:</span> ${s.type}<br>`;
    if ((s.triggers||[]).length) html += `<span class="label">Triggers:</span> ${s.triggers.map(t=>`<span class="tag">${t}</span>`).join('')}<br>`;
    if (s.aura)     html += `<span class="label">Aura:</span> ${s.aura}<br>`;
    if (s.notes)    html += `<span class="label">Notes:</span> ${s.notes.replace(/\n/g,'<br>')}`;
    html += '</div>';
  });
  html += '</body></html>';
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
  else toast('Pop-up blocked — please allow pop-ups for PDF export.', 'error');
}

function exportJson() {
  const count = seizures.length+medications.length+appointments.length+notes.length;
  if (!count) { toast('Nothing to back up yet.', 'error'); return; }
  download(`seizurre-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(getAllData(),null,2), 'application/json');
}

document.getElementById('export-txt-btn').addEventListener('click', exportTxt);
document.getElementById('export-csv-btn').addEventListener('click', exportCSV);
document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);
document.getElementById('export-json-btn').addEventListener('click', exportJson);

// ─── RESTORE ──────────────────────────────────────────────────────
let pendingRestore = null;
document.getElementById('import-json-btn').addEventListener('click', () => {
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-file-input').click();
});
document.getElementById('import-file-input').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      pendingRestore = Array.isArray(data) ? { seizures:data, medications:[], appointments:[], notes:[], refills:[], adherenceLogs:[] } : data;
      document.getElementById('restore-modal-sub').textContent =
        `Found ${(pendingRestore.seizures||[]).length} seizures, ${(pendingRestore.medications||[]).length} medications. Replace all current data?`;
      openModal('restore-modal');
    } catch { toast('Invalid JSON file', 'error'); }
  };
  reader.readAsText(file);
});
document.getElementById('restore-confirm-yes').addEventListener('click', async () => {
  if (!pendingRestore) return;
  await mutateAndPersist(() => setAllData(pendingRestore));
  pendingRestore = null;
  closeModal('restore-modal');
  toast('Backup restored ✓', 'success');
});
document.getElementById('restore-confirm-no').addEventListener('click', () => {
  pendingRestore = null; closeModal('restore-modal');
});

// ─── FILE SYSTEM BUTTONS ──────────────────────────────────────────
document.getElementById('pick-data-file-btn').addEventListener('click', pickDataFile);
document.getElementById('create-new-data-file-btn').addEventListener('click', createNewDataFile);
document.getElementById('export-current-to-file-btn').addEventListener('click', exportCurrentToFile);
document.getElementById('change-data-file-btn').addEventListener('click', pickDataFile);

// ─── MODAL HELPERS ────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  // Focus first focusable element
  setTimeout(() => {
    const f = m.querySelector('button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    if (f) f.focus();
  }, 50);
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.style.display = 'none';
}

// Close modals on backdrop click
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});
// Keyboard: Escape closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(m => {
      if (m.style.display === 'flex') closeModal(m.id);
    });
  }
});

// ─── RENDER ALL ───────────────────────────────────────────────────
function renderAllUI() {
  renderSeizureUI();
  if (currentTab === 'meds')     renderMedsUI();
  if (currentTab === 'triggers') renderTriggersUI();
  if (currentTab === 'charts')   renderChartsUI();
  if (currentTab === 'more')     { renderAppointmentsUI(); renderNotesUI(); }
  updateDataSourceStatus();
}

// ─── INIT ─────────────────────────────────────────────────────────
async function init() {
  // IndexedDB
  try {
    db = await openDB();
    document.getElementById('db-chip').textContent = '✓ IndexedDB ready';
    document.getElementById('db-chip').classList.add('chip-ok');
    await loadAllFromDB();
  } catch (err) {
    console.error('IndexedDB failed:', err);
    document.getElementById('db-chip').textContent = '⚠️ Storage error';
    document.getElementById('db-chip').classList.add('chip-err');
  }

  // File System API check
  if (!('showOpenFilePicker' in window)) {
    document.getElementById('data-source-status').innerHTML =
      '<span>⚠️ Your browser does not support File System Access. Data is stored in IndexedDB only. Use Chrome/Edge for permanent file storage.</span>';
  }

  loadSettings();
  checkOnboarding();
  buildTriggerChips('trigger-preset-grid');

  // Show voice button if speech recognition is supported and enabled
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const vBtn = document.getElementById('sd-voice-btn');
    if (vBtn) vBtn.hidden = !settings.voiceEnabled;
  }

  renderAllUI();

  // Weekly backup nag (simple client-side check)
  const lastBackup = localStorage.getItem('last_backup_prompt');
  const daysSince = lastBackup ? (Date.now() - parseInt(lastBackup)) / 86400000 : 999;
  if (daysSince >= 7 && seizures.length > 0) {
    setTimeout(() => {
      toast('💾 It\'s been a while — remember to export a backup!');
      localStorage.setItem('last_backup_prompt', Date.now().toString());
    }, 3000);
  }
}

init();
