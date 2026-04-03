// --------------------------------------------------------------
//  FILE SYSTEM ACCESS STORAGE (External file, survives browser clear)
// --------------------------------------------------------------
let fileHandle = null;          // current file handle (if any)
let useFileSystem = false;      // are we using file-based storage?

// The in-memory data (kept in sync with file)
let seizures = [];
let medications = [];
let appointments = [];
let notes = [];

// Keys for localStorage backup (optional)
const SEIZURE_KEY = 'seizure_log_v1';
const MED_KEY = 'medications_v1';
const APPT_KEY = 'appointments_v1';
const NOTES_KEY = 'seizure_notes_v1';
const DARK_KEY = 'seizure_dark_mode';

// Helper: load all data from a given object
function setAllData(data) {
    seizures = data.seizures || [];
    medications = data.medications || [];
    appointments = data.appointments || [];
    notes = data.notes || [];
    // also update localStorage as a cache (optional)
    localStorage.setItem(SEIZURE_KEY, JSON.stringify(seizures));
    localStorage.setItem(MED_KEY, JSON.stringify(medications));
    localStorage.setItem(APPT_KEY, JSON.stringify(appointments));
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// Get current full data object
function getAllData() {
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        seizures: seizures,
        medications: medications,
        appointments: appointments,
        notes: notes
    };
}

// Save current data to the selected file (if file system mode active)
async function saveToFile() {
    if (!useFileSystem || !fileHandle) return;
    try {
        const writable = await fileHandle.createWritable();
        const dataStr = JSON.stringify(getAllData(), null, 2);
        await writable.write(dataStr);
        await writable.close();
        // Update status bar
        document.getElementById('data-source-text').innerHTML = `📁 Using file: ${fileHandle.name || 'data file'} (auto-saved)`;
        toast('Data saved to file ✓', 'success');
    } catch (err) {
        console.error('File save error:', err);
        toast('Could not save to file. Permissions lost?', 'error');
        // fallback to localStorage only mode
        useFileSystem = false;
        fileHandle = null;
        updateDataSourceStatus();
    }
}

// Load data from a given file handle
async function loadFromFile(handle) {
    try {
        const file = await handle.getFile();
        const text = await file.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch(e) {
            // empty file or invalid JSON – treat as empty
            data = { seizures: [], medications: [], appointments: [], notes: [] };
        }
        // Migrate old array format
        if (Array.isArray(data)) {
            data = { seizures: data, medications: [], appointments: [], notes: [] };
        }
        setAllData(data);
        fileHandle = handle;
        useFileSystem = true;
        // store file id in localStorage so we can reacquire on next load (if permissions persist)
        try {
            const fileId = await fileHandle.getFile(); // we can't store handle directly, but we can store name hint
            localStorage.setItem('last_data_file_name', fileHandle.name);
        } catch(e) {}
        updateDataSourceStatus();
        renderAllUI();
        toast(`Loaded data from ${handle.name} ✓`, 'success');
    } catch(err) {
        console.error('Load file error:', err);
        toast('Failed to read file', 'error');
        useFileSystem = false;
        fileHandle = null;
        updateDataSourceStatus();
    }
}

// Create a new empty data file
async function createNewDataFile() {
    try {
        const newHandle = await window.showSaveFilePicker({
            suggestedName: 'SeizureDiaryData.json',
            types: [{
                description: 'JSON file',
                accept: { 'application/json': ['.json'] }
            }]
        });
        const emptyData = { seizures: [], medications: [], appointments: [], notes: [] };
        const writable = await newHandle.createWritable();
        await writable.write(JSON.stringify(emptyData, null, 2));
        await writable.close();
        // now load it
        await loadFromFile(newHandle);
        setAllData(emptyData);
        renderAllUI();
    } catch(err) {
        if (err.name !== 'AbortError') toast('Could not create file', 'error');
    }
}

// Pick an existing file
async function pickDataFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
            multiple: false
        });
        await loadFromFile(handle);
    } catch(err) {
        if (err.name !== 'AbortError') toast('File selection cancelled or failed', 'error');
    }
}

// Export current data to a separate file (backup)
async function exportCurrentToFile() {
    try {
        const handle = await window.showSaveFilePicker({
            suggestedName: `seizure-backup-${new Date().toISOString().slice(0,19)}.json`,
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(getAllData(), null, 2));
        await writable.close();
        toast('Backup saved to file ✓', 'success');
    } catch(err) {
        if (err.name !== 'AbortError') toast('Export failed', 'error');
    }
}

// Fallback: load from localStorage if no file selected (legacy mode)
function loadFromLocalStorage() {
    try {
        seizures = JSON.parse(localStorage.getItem(SEIZURE_KEY)) || [];
    } catch { seizures = []; }
    try {
        medications = JSON.parse(localStorage.getItem(MED_KEY)) || [];
    } catch { medications = []; }
    try {
        appointments = JSON.parse(localStorage.getItem(APPT_KEY)) || [];
    } catch { appointments = []; }
    try {
        notes = JSON.parse(localStorage.getItem(NOTES_KEY)) || [];
    } catch { notes = []; }
    useFileSystem = false;
    fileHandle = null;
    updateDataSourceStatus();
    renderAllUI();
}

// Persist data after any modification (save to file if active, else localStorage)
async function persistAll() {
    if (useFileSystem && fileHandle) {
        await saveToFile();
    } else {
        localStorage.setItem(SEIZURE_KEY, JSON.stringify(seizures));
        localStorage.setItem(MED_KEY, JSON.stringify(medications));
        localStorage.setItem(APPT_KEY, JSON.stringify(appointments));
        localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    }
    // also update cache
    localStorage.setItem(SEIZURE_KEY, JSON.stringify(seizures));
    localStorage.setItem(MED_KEY, JSON.stringify(medications));
    localStorage.setItem(APPT_KEY, JSON.stringify(appointments));
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

// Wrapper for all mutation functions to ensure save
async function mutateAndPersist(callback) {
    callback();
    await persistAll();
    renderAllUI();
}

// Helper: render all UI sections (maintains current tab)
function renderAllUI() {
    renderSeizureUI();
    renderMedicationsUI();
    renderAppointmentsUI();
    renderNotesUI();
    updateDataSourceStatus();
}

function updateDataSourceStatus() {
    const statusDiv = document.getElementById('data-source-status');
    const textSpan = document.getElementById('data-source-text');
    if (useFileSystem && fileHandle) {
        textSpan.innerHTML = `✅ Data saved to: ${fileHandle.name} (immune to browser clear)`;
    } else {
        textSpan.innerHTML = `⚠️ Using browser storage (data will be lost if you clear browser data). Click "Pick or create a data file" to make it permanent.`;
    }
}

// --------------------------------------------------------------
//  ORIGINAL APP LOGIC (converted to use global arrays & mutateAndPersist)
// --------------------------------------------------------------
function toast(msg, type = '') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast' + (type === 'error' ? ' error' : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 2800);
}

// Clock
function updateClock() {
    const n = new Date();
    document.getElementById('clock-time').textContent = n.toLocaleTimeString('en-GB');
    document.getElementById('live-clock-date').textContent = n.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

// Dark mode
function applyDark(on) {
    document.body.classList.toggle('dark-mode', on);
    localStorage.setItem(DARK_KEY, on ? '1' : '0');
}
(function() {
    const saved = localStorage.getItem(DARK_KEY);
    if (saved !== null) { applyDark(saved === '1'); return; }
})();

// Tab switching
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    if (tabId === 'seizure') renderSeizureUI();
    else if (tabId === 'medications') renderMedicationsUI();
    else if (tabId === 'appointments') renderAppointmentsUI();
    else if (tabId === 'notes') renderNotesUI();
}
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
document.getElementById('nav-seizure-btn').addEventListener('click', () => switchTab('seizure'));
document.getElementById('nav-meds-btn').addEventListener('click', () => switchTab('medications'));
document.getElementById('nav-appt-btn').addEventListener('click', () => switchTab('appointments'));
document.getElementById('nav-notes-btn').addEventListener('click', () => switchTab('notes'));
document.getElementById('dark-toggle-nav').addEventListener('click', () => applyDark(!document.body.classList.contains('dark-mode')));

// Seizure logic
function niceTime(t) { if (!t) return ''; const [h, m] = t.split(':'); let hour = parseInt(h,10); const ampm = hour>=12?'PM':'AM'; hour = hour%12||12; return hour+':'+m+' '+ampm; }
function niceDate(iso) { if (!iso) return ''; return new Date(iso+'T12:00:00').toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); }
function monthKey(iso) { return iso ? iso.slice(0,7) : ''; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function logNow() {
    const now = new Date();
    const date = now.toISOString().slice(0,10);
    const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    await mutateAndPersist(() => {
        seizures.unshift({ id, date, time, notes: '', createdAt: now.getTime() });
    });
    const btn = document.getElementById('log-now-btn');
    btn.classList.add('saved');
    btn.innerHTML = '✓ &nbsp;Saved';
    setTimeout(() => {
        btn.classList.remove('saved');
        btn.innerHTML = '<span class="log-btn-icon">⚡</span> Log Seizure';
    }, 1200);
    toast('✓ Logged at ' + niceTime(time));
    setTimeout(() => openNotesEditor(id), 300);
}

function renderSeizureUI() {
    renderStats(); populateMonthFilter(); renderList();
}
function renderStats() {
    const total = seizures.length;
    const mon = seizures.filter(s => monthKey(s.date) === new Date().toISOString().slice(0,7)).length;
    const yr = new Date().getFullYear().toString();
    const year = seizures.filter(s => s.date && s.date.startsWith(yr)).length;
    document.getElementById('stats-row').innerHTML = `<div class="stat-chip">Total: <span>${total}</span></div><div class="stat-chip">This month: <span>${mon}</span></div><div class="stat-chip">This year: <span>${year}</span></div>`;
}
function populateMonthFilter() {
    const sel = document.getElementById('filter-month');
    const cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    [...new Set(seizures.map(s => monthKey(s.date)).filter(Boolean))].sort().reverse().forEach(m => {
        const label = new Date(m + '-01T12:00:00').toLocaleDateString('en-GB', { month:'long', year:'numeric' });
        sel.appendChild(Object.assign(document.createElement('option'), { value: m, textContent: label }));
    });
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}
function renderList() {
    const list = document.getElementById('seizure-log-list');
    const filter = document.getElementById('filter-month').value;
    let shown = [...seizures].sort((a,b) => b.createdAt - a.createdAt);
    if (filter !== 'all') shown = shown.filter(s => monthKey(s.date) === filter);
    if (!shown.length) { list.innerHTML = '<div class="no-records">No records' + (filter !== 'all' ? ' for this month' : ' yet') + '.</div>'; return; }
    list.innerHTML = '';
    shown.forEach(s => {
        const card = document.createElement('div'); card.className = 'seizure-card'; card.dataset.id = s.id;
        card.innerHTML = `<div class="card-top"><div><div class="card-datetime">${esc(niceTime(s.time))}&ensp;·&ensp;${esc(s.date ? s.date.split('-').reverse().join('/') : '')}</div><div class="card-date-sub">${esc(niceDate(s.date))}</div></div><div><button class="icon-btn" data-del="${esc(s.id)}" title="Delete record">🗑️</button></div></div>
            <div class="card-notes-area"><div class="card-notes-text${s.notes ? '' : ' empty'}" id="nt-${esc(s.id)}">${s.notes ? esc(s.notes) : 'No notes yet.'}</div>
            <div class="notes-editor" id="ne-${esc(s.id)}"><textarea id="ta-${esc(s.id)}" placeholder="Add notes...">${esc(s.notes)}</textarea><div class="notes-editor-btns"><button class="save-notes-btn" data-save="${esc(s.id)}">Save notes</button><button class="cancel-notes-btn" data-cancel="${esc(s.id)}">Cancel</button></div></div>
            <button class="add-notes-btn" id="nb-${esc(s.id)}" data-toggle="${esc(s.id)}">${s.notes ? '✏️ Edit notes' : '+ Add notes'}</button></div>`;
        list.appendChild(card);
    });
    list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => confirmDelete(b.dataset.del, 'seizure')));
    
    list.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => openNotesEditor(b.dataset.toggle)));
    list.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => saveNotes(b.dataset.save)));
    list.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => closeNotesEditor(b.dataset.cancel)));
}
function openNotesEditor(id) { const ed = document.getElementById('ne-'+id); if(ed) ed.classList.add('open'); document.getElementById('nb-'+id).style.display = 'none'; const ta = document.getElementById('ta-'+id); if(ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
function closeNotesEditor(id) { const ed = document.getElementById('ne-'+id); if(ed) ed.classList.remove('open'); document.getElementById('nb-'+id).style.display = ''; }
async function saveNotes(id) { 
    const ta = document.getElementById('ta-'+id); 
    const text = ta ? ta.value.trim() : ''; 
    const idx = seizures.findIndex(s => s.id === id); 
    if(idx !== -1) { 
        await mutateAndPersist(() => { seizures[idx].notes = text; });
        closeNotesEditor(id); 
        const nt = document.getElementById('nt-'+id); 
        if(nt) { nt.textContent = text || 'No notes yet.'; nt.className = 'card-notes-text' + (text ? '' : ' empty'); } 
        document.getElementById('nb-'+id).textContent = text ? '✏️ Edit notes' : '+ Add notes'; 
        toast('Notes saved ✓'); 
    } 
}

let deleteTarget = null, deleteType = null;
function confirmDelete(id, type) { deleteTarget = id; deleteType = type; document.getElementById('confirm-modal').classList.add('open'); }
document.getElementById('confirm-delete-yes').addEventListener('click', async () => {
    if(deleteTarget && deleteType === 'seizure') { await mutateAndPersist(() => { seizures = seizures.filter(s => s.id !== deleteTarget); }); toast('Record deleted.'); }
    else if(deleteTarget && deleteType === 'medication') { await mutateAndPersist(() => { medications = medications.filter(m => m.id !== deleteTarget); }); toast('Medication deleted.'); }
    else if(deleteTarget && deleteType === 'appointment') { await mutateAndPersist(() => { appointments = appointments.filter(a => a.id !== deleteTarget); }); toast('Appointment deleted.'); }
    else if(deleteTarget && deleteType === 'note') { await mutateAndPersist(() => { notes = notes.filter(n => n.id !== deleteTarget); }); toast('Note deleted.'); }
    deleteTarget = deleteType = null; document.getElementById('confirm-modal').classList.remove('open');
});
document.getElementById('confirm-delete-no').addEventListener('click', () => { deleteTarget = deleteType = null; document.getElementById('confirm-modal').classList.remove('open'); });

function exportTxt() { if(!seizures.length) { toast('No records to export.', 'error'); return; } const sorted = [...seizures].sort((a,b)=>a.createdAt-b.createdAt); let txt = 'SEIZURE LOG\nGenerated: ' + new Date().toLocaleString() + '\nTotal: '+seizures.length+'\n'+'='.repeat(44)+'\n\n'; sorted.forEach((s,i)=>{ txt += `#${i+1}  ${niceDate(s.date)}  –  ${niceTime(s.time)}\n`; if(s.notes) txt += `Notes: ${s.notes}\n`; txt += '\n'; }); download('seizure-log.txt', txt, 'text/plain'); }
function download(name, content, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name; a.click(); toast('Download started ✓'); }

// Full backup/restore (JSON)
function exportJson() { const backup = getAllData(); const count = seizures.length + medications.length + appointments.length + notes.length; if (!count) { toast('Nothing to backup yet.', 'error'); return; } const dateStr = new Date().toISOString().slice(0,10); download('seizure-diary-backup-' + dateStr + '.json', JSON.stringify(backup, null, 2), 'application/json'); }
let pendingRestore = null;
document.getElementById('import-json-btn').addEventListener('click', () => { document.getElementById('import-file-input').value = ''; document.getElementById('import-file-input').click(); });
document.getElementById('import-file-input').addEventListener('change', function(e) {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(ev) {
        try {
            const data = JSON.parse(ev.target.result);
            if (Array.isArray(data)) pendingRestore = { seizures: data, medications: null, appointments: null, notes: null };
            else if (data.version === 1 && data.seizures !== undefined) pendingRestore = data;
            else { toast('Unrecognised backup file format.', 'error'); return; }
            document.getElementById('restore-modal-sub').innerHTML = 'This will replace all current data. Continue?';
            document.getElementById('restore-modal').classList.add('open');
        } catch { toast('Invalid JSON file', 'error'); }
    };
    reader.readAsText(file);
});
document.getElementById('restore-confirm-yes').addEventListener('click', async () => {
    if (!pendingRestore) return;
    await mutateAndPersist(() => {
        if (pendingRestore.seizures !== null) seizures = pendingRestore.seizures || [];
        if (pendingRestore.medications !== null) medications = pendingRestore.medications || [];
        if (pendingRestore.appointments !== null) appointments = pendingRestore.appointments || [];
        if (pendingRestore.notes !== null) notes = pendingRestore.notes || [];
    });
    pendingRestore = null;
    document.getElementById('restore-modal').classList.remove('open');
    toast('Backup restored successfully ✓');
});
document.getElementById('restore-confirm-no').addEventListener('click', () => { pendingRestore = null; document.getElementById('restore-modal').classList.remove('open'); });

// Medications
function renderMedicationsUI() { const container = document.getElementById('medications-list'); if(!medications.length) { container.innerHTML = '<div class="no-records">No medications added yet.<br>Tap "Add Medication" to start.</div>'; return; } container.innerHTML = ''; [...medications].sort((a,b)=>a.name.localeCompare(b.name)).forEach(med => { const card = document.createElement('div'); card.className = 'med-card'; card.innerHTML = `<div class="card-top"><div><strong>${esc(med.name)}</strong><div class="card-date-sub">${esc(med.dose)}</div></div><div><button class="icon-btn edit-med" data-id="${med.id}" title="Edit">✏️</button><button class="icon-btn delete-med" data-id="${med.id}" title="Delete">🗑️</button></div></div><div class="card-details"><p>💊 Frequency: ${esc(med.frequency || '—')}</p><p>📦 Quantity per dose: ${esc(med.quantityPerDose || '—')}</p></div>`; container.appendChild(card); }); document.querySelectorAll('.edit-med').forEach(btn => btn.addEventListener('click', () => openMedModal(btn.dataset.id))); document.querySelectorAll('.delete-med').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.id, 'medication'))); }
let currentMedId = null; function openMedModal(id=null) { currentMedId = id; const modal = document.getElementById('med-modal'); document.getElementById('med-modal-title').innerText = id ? 'Edit Medication' : 'Add Medication'; if(id) { const med = medications.find(m => m.id === id); if(med) { document.getElementById('med-name').value = med.name || ''; document.getElementById('med-dose').value = med.dose || ''; document.getElementById('med-frequency').value = med.frequency || ''; document.getElementById('med-quantity').value = med.quantityPerDose || ''; } } else { document.getElementById('med-name').value = ''; document.getElementById('med-dose').value = ''; document.getElementById('med-frequency').value = ''; document.getElementById('med-quantity').value = ''; } modal.classList.add('open'); }
document.getElementById('add-med-btn').addEventListener('click', () => openMedModal()); document.getElementById('med-save').addEventListener('click', async () => { const name = document.getElementById('med-name').value.trim(); if(!name) { toast('Medication name required', 'error'); return; } const dose = document.getElementById('med-dose').value.trim(); const frequency = document.getElementById('med-frequency').value.trim(); const quantity = document.getElementById('med-quantity').value.trim(); await mutateAndPersist(() => { if(currentMedId) { const idx = medications.findIndex(m => m.id === currentMedId); if(idx !== -1) medications[idx] = { ...medications[idx], name, dose, frequency, quantityPerDose: quantity }; } else { const newMed = { id: Date.now().toString(36)+Math.random().toString(36).slice(2), name, dose, frequency, quantityPerDose: quantity, createdAt: Date.now() }; medications.push(newMed); } }); document.getElementById('med-modal').classList.remove('open'); toast('Medication saved'); });
document.getElementById('med-cancel').addEventListener('click', () => document.getElementById('med-modal').classList.remove('open'));

// Appointments
function renderAppointmentsUI() { const container = document.getElementById('appointments-list'); const sorted = [...appointments].sort((a,b)=>new Date(a.datetime) - new Date(b.datetime)); if(!sorted.length) { container.innerHTML = '<div class="no-records">No appointments scheduled.<br>Tap "Add Appointment" to start.</div>'; return; } container.innerHTML = ''; sorted.forEach(appt => { const card = document.createElement('div'); card.className = 'appt-card'; const dt = new Date(appt.datetime); const dateStr = dt.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); const timeStr = dt.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }); card.innerHTML = `<div class="card-top"><div><strong>${esc(appt.title)}</strong><div class="card-date-sub">${dateStr} at ${timeStr}</div></div><div><button class="icon-btn edit-appt" data-id="${appt.id}" title="Edit">✏️</button><button class="icon-btn delete-appt" data-id="${appt.id}" title="Delete">🗑️</button></div></div><div class="card-details"><p>📍 ${esc(appt.location || 'No location')}</p><p>👤 ${esc(appt.withWhom || 'No contact')}</p></div>`; container.appendChild(card); }); document.querySelectorAll('.edit-appt').forEach(btn => btn.addEventListener('click', () => openApptModal(btn.dataset.id))); document.querySelectorAll('.delete-appt').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.id, 'appointment'))); }
let currentApptId = null; function openApptModal(id=null) { currentApptId = id; const modal = document.getElementById('appt-modal'); document.getElementById('appt-modal-title').innerText = id ? 'Edit Appointment' : 'Add Appointment'; if(id) { const appt = appointments.find(a => a.id === id); if(appt) { document.getElementById('appt-title').value = appt.title || ''; document.getElementById('appt-location').value = appt.location || ''; document.getElementById('appt-datetime').value = appt.datetime || ''; document.getElementById('appt-with').value = appt.withWhom || ''; } } else { document.getElementById('appt-title').value = ''; document.getElementById('appt-location').value = ''; document.getElementById('appt-datetime').value = ''; document.getElementById('appt-with').value = ''; } modal.classList.add('open'); }
document.getElementById('add-appt-btn').addEventListener('click', () => openApptModal()); document.getElementById('appt-save').addEventListener('click', async () => { const title = document.getElementById('appt-title').value.trim(); if(!title) { toast('Title required', 'error'); return; } const location = document.getElementById('appt-location').value.trim(); const datetime = document.getElementById('appt-datetime').value; if(!datetime) { toast('Date & time required', 'error'); return; } const withWhom = document.getElementById('appt-with').value.trim(); await mutateAndPersist(() => { if(currentApptId) { const idx = appointments.findIndex(a => a.id === currentApptId); if(idx !== -1) appointments[idx] = { ...appointments[idx], title, location, datetime, withWhom }; } else { const newAppt = { id: Date.now().toString(36)+Math.random().toString(36).slice(2), title, location, datetime, withWhom, createdAt: Date.now() }; appointments.push(newAppt); } }); document.getElementById('appt-modal').classList.remove('open'); toast('Appointment saved'); });
document.getElementById('appt-cancel').addEventListener('click', () => document.getElementById('appt-modal').classList.remove('open'));

// Notes
function renderNotesUI() { const container = document.getElementById('notes-list'); if (!notes.length) { container.innerHTML = '<div class="no-records">No notes yet.<br>Tap "+ New Note" to start writing.</div>'; return; } container.innerHTML = ''; [...notes].sort((a,b) => b.updatedAt - a.updatedAt).forEach(n => { const card = document.createElement('div'); card.className = 'note-card'; const updStr = new Date(n.updatedAt).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); card.innerHTML = `<div class="note-card-header"><input class="note-title-input" data-nid="${esc(n.id)}" type="text" value="${esc(n.title)}" placeholder="Note title…" maxlength="80"><button class="note-delete-btn" data-ndel="${esc(n.id)}" title="Delete note">🗑️</button></div><div class="note-meta">Last edited: ${updStr}</div><textarea class="note-body-textarea" data-nid="${esc(n.id)}" rows="5" placeholder="Type your note here…">${esc(n.body)}</textarea><div class="note-save-row"><span class="note-saved-label" id="nsl-${esc(n.id)}">Saved ✓</span><button class="note-save-btn" data-nsave="${esc(n.id)}">Save</button></div>`; container.appendChild(card); }); container.querySelectorAll('[data-nsave]').forEach(btn => btn.addEventListener('click', () => saveNote(btn.dataset.nsave))); container.querySelectorAll('[data-ndel]').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.ndel, 'note'))); container.querySelectorAll('.note-body-textarea[data-nid], .note-title-input[data-nid]').forEach(el => { el.addEventListener('blur', () => saveNote(el.dataset.nid, true)); }); }
async function saveNote(id, silent = false) { const idx = notes.findIndex(n => n.id === id); if (idx === -1) return; const titleEl = document.querySelector(`.note-title-input[data-nid="${id}"]`); const bodyEl = document.querySelector(`.note-body-textarea[data-nid="${id}"]`); await mutateAndPersist(() => { notes[idx].title = titleEl ? titleEl.value.trim() : notes[idx].title; notes[idx].body = bodyEl ? bodyEl.value : notes[idx].body; notes[idx].updatedAt = Date.now(); }); const lbl = document.getElementById('nsl-' + id); if (lbl) { lbl.classList.add('show'); setTimeout(() => lbl.classList.remove('show'), 2000); } if (!silent) toast('Note saved ✓'); }
document.getElementById('add-note-btn').addEventListener('click', async () => { await mutateAndPersist(() => { notes.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2), title: '', body: '', updatedAt: Date.now() }); }); renderNotesUI(); setTimeout(() => { const first = document.querySelector('.note-title-input'); if (first) first.focus(); }, 100); });

// Event listeners for file system buttons
document.getElementById('pick-data-file-btn').addEventListener('click', pickDataFile);
document.getElementById('create-new-data-file-btn').addEventListener('click', createNewDataFile);
document.getElementById('export-current-to-file-btn').addEventListener('click', exportCurrentToFile);
document.getElementById('change-data-file-btn').addEventListener('click', pickDataFile);
document.getElementById('log-now-btn').addEventListener('click', logNow);
document.getElementById('export-txt-btn').addEventListener('click', exportTxt);
document.getElementById('export-json-btn').addEventListener('click', exportJson);
document.getElementById('filter-month').addEventListener('change', renderList);

// Initial load: try to use localStorage first, then offer file picker only if user selects
// But we want to check if there's an existing file handle hint? For simplicity, start with localStorage.
// Also, if File System Access API is not supported, show a warning.
if (!('showOpenFilePicker' in window)) {
    document.getElementById('data-source-status').innerHTML = '<span>⚠️ Your browser does not support permanent file storage. Data may be lost if you clear browser data.</span>';
    toast('Your browser does not support File System Access. Please use Chrome, Edge, or Opera for permanent storage.', 'error');
}

loadFromLocalStorage();
renderAllUI();