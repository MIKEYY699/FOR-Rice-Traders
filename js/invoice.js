/* FOR Rice Traders – invoice logic: rows, totals, save/load, print & PDF */
/* ================= settings ================= */
const VARIETIES = [
  "1121 STEAM","1121 SELA","1121 SHORT GRAIN","B1+B2","OLD SUPER BASMATI",
  "1509+1857 STEAM","1509+1847 NEW SELA","1509+1847 SHORT GRAIN"
];
const PACKING = "25 KG";
const START_NO = 1000;
const MIN_PRINT_ROWS = 8;       // table rows shown on paper (blank rows fill the rest)

/* ================= small ornaments (inline SVG) ================= */
const SVG = {
  leaf: `<svg viewBox="0 0 36 20" width="26" height="14">
      <ellipse cx="10" cy="11" rx="8" ry="3.4" transform="rotate(-25 10 11)" fill="#c9a03c"/>
      <ellipse cx="26" cy="11" rx="8" ry="3.4" transform="rotate(25 26 11)" fill="#c9a03c"/>
      <ellipse cx="18" cy="7" rx="2.6" ry="6" fill="#b8902f"/></svg>`,
  orn: `<svg viewBox="0 0 60 24" width="48" height="20">
      <path d="M2,12 H58" stroke="#c9a03c" stroke-width="1.5"/>
      ${[10,20,30,40].map(x=>`<ellipse cx="${x}" cy="8" rx="4" ry="2" transform="rotate(-30 ${x} 8)" fill="#c9a03c"/><ellipse cx="${x}" cy="16" rx="4" ry="2" transform="rotate(30 ${x} 16)" fill="#c9a03c"/>`).join('')}
      <ellipse cx="50" cy="12" rx="5" ry="2.4" fill="#c9a03c"/></svg>`,
};
function drawArt(root){
  root.querySelectorAll('[data-svg]').forEach(el=> el.innerHTML = SVG[el.dataset.svg]);
}

/* ================= helpers ================= */
const $ = id => document.getElementById(id);
const num = v => { const n = parseFloat(String(v).replace(/,/g,'')); return isNaN(n) ? 0 : n; };
const fmt = n => Math.round(n).toLocaleString('en-US');
function today(){ const d = new Date(); return d.toISOString().slice(0,10); }
function dmy(iso){ if(!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; }
let toastTimer;
function toast(t, ms = 1800){
  const m = $('msg'); m.textContent = t; m.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>m.classList.remove('show'), ms);
}

function nextNo(){
  const nums = Object.keys(store()).map(Number);
  return nums.length ? Math.max(START_NO-1, ...nums) + 1 : START_NO;
}

/* ================= rows ================= */
function addRow(data = {}){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="sno"></td>
    <td class="l"><select class="variety editable">
        <option value=""></option>
        ${VARIETIES.map(v=>`<option ${v===data.variety?'selected':''}>${v}</option>`).join('')}
    </select></td>
    <td>${PACKING}</td>
    <td><span class="qtywrap"><input class="qty editable" inputmode="numeric" value="${data.qty ?? ''}"><span class="bags no-print">BAGS</span></span></td>
    <td><input class="rate editable" inputmode="numeric" value="${data.rate ?? ''}"></td>
    <td><span class="amt"></span></td>`;
  const del = document.createElement('button');
  del.className = 'del no-print'; del.textContent = '✕'; del.title = 'Remove row';
  del.onclick = () => { tr.remove(); calc(); };
  tr.lastElementChild.appendChild(del);
  $('rows').appendChild(tr);
  calc();
}

function calc(){
  let sub = 0;
  [...$('rows').children].forEach((tr,i)=>{
    tr.querySelector('.sno').textContent = i+1;
    const q = num(tr.querySelector('.qty').value), r = num(tr.querySelector('.rate').value);
    const a = q * r; sub += a;
    tr.querySelector('.amt').textContent = a ? fmt(a) : '';
  });
  const grand = sub - num($('discount').value) + num($('freight').value);
  $('subTotal').textContent = fmt(sub);
  $('grandTotal').textContent = fmt(grand);
  const paidVal = $('paid').value.trim();
  // Balance Due: auto-calculated unless the user typed their own value
  if(!$('balance').dataset.manual) $('balance').value = paidVal === '' ? '' : fmt(grand - num(paidVal));
}
document.addEventListener('input', e=>{
  if(e.target.classList.contains('qty')) e.target.value = e.target.value.replace(/[^\d.]/g,'');
  if(e.target.id === 'balance'){
    if(e.target.value.trim()) e.target.dataset.manual = '1'; else delete e.target.dataset.manual;
  }
  calc();
});

/* ================= save / load ================= */
function collect(){
  return {
    no: $('invNo').textContent, date: $('invDate').value,
    custName: $('custName').value, custPhone: $('custPhone').value, custAddr: $('custAddr').value,
    discount: $('discount').value, freight: $('freight').value, paid: $('paid').value,
    balance: $('balance').value, balanceManual: !!$('balance').dataset.manual,
    payMethod: $('payMethod').value, notes: $('notes').value,
    rows: [...$('rows').children].map(tr=>({
      variety: tr.querySelector('.variety').value, qty: tr.querySelector('.qty').value, rate: tr.querySelector('.rate').value
    })),
    grand: $('grandTotal').textContent
  };
}
function fill(d){
  $('invNo').textContent = d.no; $('invDate').value = d.date || today();
  ['custName','custPhone','custAddr','discount','freight','paid','payMethod','notes'].forEach(k=>{ if(d[k]!==undefined) $(k).value = d[k]; });
  if(d.balanceManual){ $('balance').dataset.manual = '1'; $('balance').value = d.balance; }
  else delete $('balance').dataset.manual;
  $('rows').innerHTML = '';
  (d.rows && d.rows.length ? d.rows : [{},{},{},{}]).forEach(r=>addRow(r));
  calc();
}
function saveInvoice(silent){
  const d = collect(); const s = store(); s[d.no] = d;
  if(!setStore(s)) return false;                 // storage full – setStore already warned
  refreshHistory(d.no);
  if(storagePercent() >= WARN_AT) toast(`Saved – but storage is ${storagePercent()}% full. Please Export Backup.`, 4000);
  else if(!silent) toast(`Invoice ${d.no} saved`);
  return true;
}
function newInvoice(){
  fill({ no: nextNo(), date: today(), custName:'', custPhone:'', custAddr:'', discount:'0', freight:'0', paid:'',
         payMethod:'Cash / Bank Transfer', notes:'Thank you for your business.' });
  refreshHistory('');
}
function loadInvoice(no){ if(!no) return; const d = store()[no]; if(d){ fill(d); toast(`Loaded invoice ${no}`); } }
function deleteInvoice(){
  const no = $('invNo').textContent; const s = store();
  if(!s[no]) return toast('This invoice is not saved');
  if(!confirm(`Delete saved invoice ${no}?`)) return;
  delete s[no]; setStore(s); newInvoice(); toast(`Invoice ${no} deleted`);
}
function refreshHistory(sel){
  const s = store(); const h = $('history');
  h.innerHTML = `<option value="">— Saved invoices (${Object.keys(s).length}) —</option>` +
    Object.values(s).sort((a,b)=>b.no-a.no)
      .map(d=>`<option value="${d.no}" ${d.no==sel?'selected':''}>#${d.no} · ${d.custName||'—'} · ${d.grand}</option>`).join('');
}

/* ================= print / pdf ================= */
function buildStatic(){
  const src = $('invoice');
  const clone = src.cloneNode(true);
  clone.id = ''; clone.classList.add('static');
  const a = src.querySelectorAll('input,select'), b = clone.querySelectorAll('input,select');
  a.forEach((el,i)=>{
    const span = document.createElement('span');
    let v = el.value;
    if(el.type === 'date') v = dmy(v);
    if(el.classList.contains('qty') && v.trim()) v = (v.replace(/bags?/i,'').trim()) + ' BAGS';
    if(el.classList.contains('num') && v.trim() && !isNaN(num(v))) v = fmt(num(v));
    span.textContent = v;
    span.style.cssText = getComputedStyle(el).textTransform === 'uppercase' ? 'text-transform:uppercase' : '';
    b[i].replaceWith(span);
  });
  clone.querySelectorAll('.no-print').forEach(e=>e.remove());
  // drop empty rows, pad with blank rows
  const body = clone.querySelector('#rows'); body.removeAttribute('id');
  [...body.children].forEach(tr=>{ if(!tr.children[1].textContent.trim() && !tr.children[5].textContent.trim()) tr.remove(); });
  [...body.children].forEach((tr,i)=> tr.children[0].textContent = i+1);
  const filled = body.children.length;
  for(let i=filled;i<MIN_PRINT_ROWS;i++){
    const tr = document.createElement('tr'); tr.className = 'blank';
    tr.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td></td>'; body.appendChild(tr);
  }
  clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
  return clone;
}
function printInvoice(){
  saveInvoice(true);
  window.print();
}
async function downloadPDF(){
  saveInvoice(true);
  if(typeof html2pdf === 'undefined'){
    toast('No internet: use Print → "Save as PDF"'); return printInvoice();
  }
  toast('Generating PDF…');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:absolute;left:-10000px;top:0;width:210mm';
  const page = buildStatic(); page.style.boxShadow = 'none';
  holder.appendChild(page); document.body.appendChild(holder);
  await document.fonts.ready; await imagesReady;
  const no = $('invNo').textContent, name = ($('custName').value || '').trim().replace(/[^\w\- ]/g,'');
  const sx = window.scrollX, sy = window.scrollY;
  window.scrollTo(0,0);
  try{
    const worker = html2pdf().set({
      margin: 0,
      html2canvas: { scale: 3, useCORS:true, backgroundColor:'#fbf8ef', scrollX:0, scrollY:0 },
      jsPDF: { unit:'mm', format:'a4', orientation:'portrait' }
    }).from(page);
    const pdf = await worker.toPdf().get('pdf');
    const canvas = await worker.get('canvas');
    // Force exactly ONE A4 page: draw the whole invoice on a new page, drop all others
    pdf.addPage('a4', 'portrait');
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
    while(pdf.internal.getNumberOfPages() > 1) pdf.deletePage(1);
    pdf.save(`Invoice-${no}${name?'-'+name:''}.pdf`);
  } catch(err){
    console.error(err); toast('PDF failed – use Print → "Save as PDF"');
  } finally { holder.remove(); window.scrollTo(sx, sy); }
}

/* ================= images (background removed at load) ================= */
function clearBackground(src){
  return new Promise(res=>{
    const img = new Image();
    img.onload = ()=>{
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(img,0,0);
      const d = x.getImageData(0,0,c.width,c.height), p = d.data;
      const W = c.width, H = c.height;
      // background colour = brightest of the 4 corners (inset a few px to skip edge artefacts)
      const px = (X,Y)=>{ const i=(Y*W+X)*4; return [p[i],p[i+1],p[i+2]]; };
      const bg = [px(4,4),px(W-5,4),px(4,H-5),px(W-5,H-5)]
        .sort((u,v)=>(v[0]+v[1]+v[2])-(u[0]+u[1]+u[2]))[0];
      for(let i=0;i<p.length;i+=4){
        const X = (i/4)%W, Y = Math.floor(i/4/W);
        if(X<3 || Y<3 || X>W-4 || Y>H-4){ p[i+3] = 0; continue; }   // trim border
        let a = 0;
        for(let k=0;k<3;k++){
          const v = p[i+k], b = bg[k];
          if(v < b) a = Math.max(a, (b-v)/b);      // only "darker than background" counts as ink
        }
        a = Math.min(1, a*1.15);
        if(a < 0.04){ p[i+3] = 0; continue; }
        for(let k=0;k<3;k++) p[i+k] = Math.max(0, Math.min(255, (Math.min(p[i+k],bg[k])-bg[k])/a + bg[k]));
        p[i+3] = Math.round(a*255);
      }
      x.putImageData(d,0,0); res(c.toDataURL('image/png'));
    };
    img.src = src;
  });
}
const imagesReady = Promise.all([clearBackground(LOGO_SRC), clearBackground(ART_SRC)]).then(([l,a])=>{
  $('logoImg').src = l; $('artImg').src = a;
});

/* ================= init ================= */
window.addEventListener('beforeprint', ()=>{ const pa=$('printArea'); pa.innerHTML=''; pa.appendChild(buildStatic()); });
drawArt(document);
refreshHistory('');
updateStorageInfo();
newInvoice();
