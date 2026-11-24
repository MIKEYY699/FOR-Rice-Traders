/* FOR Rice Traders – where invoices are kept, storage warnings, backup export/import.
 *
 * Invoices are stored in the browser (localStorage) under the key below.
 * The browser allows roughly 5 million characters per site; one invoice is ~0.6–1 KB.
 */
const KEY = "forRiceInvoices";
const LAST_BACKUP_KEY = "forRiceLastBackup";
const STORAGE_LIMIT = 5000000;   // approx. characters the browser allows
const WARN_AT = 80;              // % full at which we start warning

function store(){
  try{ return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch(e){ return {}; }
}

/* Writes all invoices. Returns false (and warns loudly) if the browser refuses because it is full. */
function setStore(s){
  try{
    localStorage.setItem(KEY, JSON.stringify(s));
    updateStorageInfo();
    return true;
  }catch(e){
    updateStorageInfo(true);
    alert(
      "⚠ STORAGE IS FULL – this invoice was NOT saved.\n\n" +
      "To fix it:\n" +
      "1. Click \"Export Backup\" to save all your invoices to a file.\n" +
      "2. Delete some old invoices (open each one, then \"Delete Saved\").\n" +
      "3. Save this invoice again.\n\n" +
      "Old invoices can be brought back any time with \"Import Backup\"."
    );
    return false;
  }
}

function storagePercent(){
  const used = (localStorage.getItem(KEY) || '').length + KEY.length;
  return Math.min(100, Math.round(used / STORAGE_LIMIT * 100));
}

function updateStorageInfo(full){
  const el = document.getElementById('storageInfo'); if(!el) return;
  const count = Object.keys(store()).length;
  const pct = full ? 100 : storagePercent();
  const last = localStorage.getItem(LAST_BACKUP_KEY);
  el.textContent = `${count} invoices · storage ${pct}% used`;
  el.className = 'storage' + (pct >= 95 || full ? ' full' : pct >= WARN_AT ? ' warn' : '');
  el.title = 'Last backup: ' + (last ? new Date(last).toLocaleString() : 'never');
}

/* ---------- Export: all invoices -> one .json file in your Downloads folder ---------- */
function exportBackup(){
  const s = store(); const n = Object.keys(s).length;
  if(!n) return toast('No saved invoices to back up yet');
  const data = {
    app: 'FOR Rice Traders Invoice',
    version: 1,
    exported: new Date().toISOString(),
    count: n,
    invoices: s
  };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `FOR-Invoices-Backup-${today()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  try{ localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString()); }catch(e){}
  updateStorageInfo();
  toast(`Backup saved to Downloads: ${n} invoices`, 3000);
}

/* ---------- Import: merge invoices from a backup file ---------- */
function importBackup(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try{ data = JSON.parse(reader.result); }
    catch(e){ return alert('This file is not a valid invoice backup.'); }

    const incoming = (data && typeof data.invoices === 'object') ? data.invoices : data;
    const ids = incoming && typeof incoming === 'object'
      ? Object.keys(incoming).filter(k => incoming[k] && incoming[k].no !== undefined && Array.isArray(incoming[k].rows))
      : [];
    if(!ids.length) return alert('No invoices were found in this file.');

    const s = store();
    const clashes = ids.filter(k => s[k]);
    let replace = false;
    if(clashes.length){
      replace = confirm(
        `This backup has ${ids.length} invoices.\n` +
        `${clashes.length} of them already exist here (e.g. #${clashes[0]}).\n\n` +
        `OK = replace those with the copy from the backup\n` +
        `Cancel = keep the ones already here (only add the missing ones)`
      );
    }

    let added = 0, replaced = 0;
    ids.forEach(k => {
      if(!s[k]){ s[k] = incoming[k]; added++; }
      else if(replace){ s[k] = incoming[k]; replaced++; }
    });
    if(!setStore(s)) return;

    // If the invoice currently on screen was a fresh unsaved one whose number now exists, move to a new number.
    const cur = $('invNo').textContent;
    if(s[cur] && ids.includes(cur) && !clashes.includes(cur)) newInvoice();
    else refreshHistory(cur);

    alert(`Import finished.\n\nAdded: ${added}\nReplaced: ${replaced}\nSkipped: ${ids.length - added - replaced}`);
  };
  reader.readAsText(file);
}
