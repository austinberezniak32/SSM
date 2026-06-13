// Scan modal: AI slip scanning, PO lookup, Add PO, and manual receipt entry.
import { api } from '../api.js';
import { state, refreshState, dataChanged, extractJobNum, money, savedName, rememberName } from '../state.js';
import { esc, el, toast, openModal, closeModal, icon } from '../ui.js';

let lastParsed = null;
let lastImage = null; // compressed JPEG data URL

// Downscale on the phone before upload — keeps scans fast and DB small.
function compressImage(file, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image')); };
    img.src = url;
  });
}

window.openScanWith = (path) => { window.selectPath(path); openModal('scan'); };

window.selectPath = (p) => {
  state.scanPath = p;
  el('path-shop').className = 'path-btn' + (p === 'shop' ? ' sel-shop' : '');
  el('path-direct').className = 'path-btn' + (p === 'direct' ? ' sel-direct' : '');
};

window.handleScan = async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const res = el('scanResult');
  if (state.me && !state.me.scanConfigured) {
    res.innerHTML = `<div class="info-box bad"><strong>Scanner not set up.</strong> The server is missing its ANTHROPIC_API_KEY — see Settings.</div>`;
    return;
  }
  res.innerHTML = `<div class="ai-processing"><div class="ai-spinner"></div><div class="ai-status">Reading packing slip…</div></div>`;
  try {
    lastImage = await compressImage(file);
    lastParsed = await api.post('/api/scan', { image: lastImage.split(',')[1], mediaType: 'image/jpeg' });
    showParsed(lastParsed);
  } catch (err) {
    res.innerHTML = `<div class="info-box warn">Couldn't read: ${esc(err.message)}</div>`
      + (lastImage ? `<img src="${lastImage}" style="width:100%;margin-top:10px;border-radius:12px;border:1px solid var(--border)" alt="slip">` : '');
  }
};

function showParsed(inv) {
  const job = extractJobNum(inv.customerPO);
  const nameHint = job ? job + (inv.project ? ' ' + inv.project.trim() : '') : '';
  const rows = (inv.lineItems || []).map((it, i) => `
    <div class="pl-row">
      <input type="checkbox" class="pl-check" id="pchk${i}" checked>
      <div class="pl-desc"><div>${esc(it.description) || 'Unknown'}</div><div class="pl-pn">${esc(it.partNumber)}</div></div>
      <div class="pl-right"><div class="pl-qty">${Number(it.qty) || 0} <span class="unit">${esc(it.unit) || 'EA'}</span></div><div class="pl-cost">${it.lineTotal > 0 ? money(it.lineTotal) : ''}</div></div>
    </div>`).join('');
  const thumb = lastImage
    ? `<img src="${lastImage}" style="width:62px;height:62px;object-fit:cover;border-radius:12px;border:1px solid var(--border);cursor:pointer;flex-shrink:0" onclick="openLb(event,'${lastImage}')" alt="slip">`
    : '';
  el('scanResult').innerHTML = `
    <div class="parsed-invoice">
      <div class="parsed-hdr"><span>${(inv.lineItems || []).length} items found</span><span class="amt">${money(inv.total)}</span></div>
      <div style="display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-bottom:1px solid var(--border)">
        ${thumb}
        <div class="pm-grid" style="flex:1">
          <div><div class="pm-label">Vendor</div><div class="pm-val">${esc(inv.vendor) || '—'}</div></div>
          <div><div class="pm-label">Invoice #</div><div class="pm-val">${esc(inv.invoiceNumber) || '—'}</div></div>
          <div><div class="pm-label">Customer PO</div><div class="pm-val" style="font-family:var(--mono);font-size:12px">${esc(inv.customerPO) || '—'}</div></div>
          <div><div class="pm-label">Job</div><div class="pm-val" style="color:var(--primary)">${esc(nameHint) || '—'}</div></div>
        </div>
      </div>
      <div class="parsed-note">Uncheck anything not in this shipment:</div>
      ${rows}
      <div class="parsed-actions">
        <input class="form-input" id="scanBy" placeholder="Received by (your name)" value="${esc(savedName())}">
        <select class="form-select" id="scanCond"><option>Good</option><option>Damaged</option><option>Partial</option></select>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="cancelScan()">Cancel</button>
          <button class="btn btn-primary" style="flex:2" onclick="logScan()">${icon('check')}Log Receipt</button>
        </div>
      </div>
    </div>`;
}

window.cancelScan = () => {
  lastParsed = null;
  lastImage = null;
  el('scanResult').innerHTML = '';
};

window.logScan = async () => {
  if (!lastParsed) { toast('No data', true); return; }
  const by = el('scanBy').value.trim() || 'Unknown';
  const cond = el('scanCond').value;
  const items = (lastParsed.lineItems || []).filter((_, i) => el('pchk' + i)?.checked);
  if (!items.length) { toast('No items selected', true); return; }
  const job = extractJobNum(lastParsed.customerPO);
  const jobName = job ? job + (lastParsed.project && lastParsed.project.trim() ? ' ' + lastParsed.project.trim() : '') : '';
  rememberName(by !== 'Unknown' ? by : '');
  try {
    await api.post('/api/receipts', {
      po: lastParsed.customerPO || '',
      jobName,
      vendor: lastParsed.vendor || 'Unknown',
      invoiceNumber: lastParsed.invoiceNumber || '',
      total: lastParsed.total || 0,
      receivedBy: by,
      condition: cond,
      location: state.scanPath,
      photo: lastImage ? { mime: 'image/jpeg', data: lastImage.split(',')[1] } : null,
      lineItems: items,
    });
    const n = items.length;
    window.cancelScan();
    closeModal('scan');
    await refreshState();
    dataChanged();
    toast(n + ' items logged');
  } catch (err) {
    toast(err.message, true);
  }
};

// ── PO lookup (no photo needed) ──
window.lookupPO = () => {
  const po = el('scanPO').value.trim();
  const match = state.pos.find(p => p.po.toUpperCase() === po.toUpperCase());
  const res = el('scanResult');
  if (!match) {
    res.innerHTML = `<div class="info-box warn">PO <strong>${esc(po)}</strong> not found.</div>`;
    return;
  }
  res.innerHTML = `
    <div class="parsed-invoice" style="padding:16px">
      <div style="font-size:14.5px;font-weight:700;margin-bottom:12px">${esc(match.po)} — ${esc(match.description)}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:10px">
          <input class="form-input" id="luQty" type="number" value="1" style="flex:1" inputmode="numeric">
          <select class="form-select" id="luCond" style="flex:1"><option>Good</option><option>Damaged</option><option>Partial</option></select>
        </div>
        <input class="form-input" id="luBy" placeholder="Your name" value="${esc(savedName())}">
        <button class="btn btn-primary btn-full" onclick="confirmLu(${match.id})">${icon('check')}Confirm Receipt</button>
      </div>
    </div>`;
};

window.confirmLu = async (poId) => {
  const po = state.pos.find(p => p.id === poId);
  if (!po) return;
  const qty = parseInt(el('luQty').value, 10) || 1;
  const by = el('luBy').value.trim() || 'Field';
  rememberName(by !== 'Field' ? by : '');
  try {
    await api.post('/api/receipts', {
      po: po.po,
      vendor: po.vendor || '',
      invoiceNumber: po.po,
      total: 0,
      receivedBy: by,
      condition: el('luCond').value,
      location: state.scanPath,
      lineItems: [{ partNumber: '', description: po.description, unit: 'EA', qty, unitPrice: 0, lineTotal: 0 }],
    });
    el('scanResult').innerHTML = `<div class="info-box good">${qty} × ${esc(po.description)} logged.</div>`;
    await refreshState();
    dataChanged();
    toast('Receipt logged');
  } catch (err) {
    toast(err.message, true);
  }
};

// ── Add PO ──
window.savePO = async () => {
  const po = el('po-num').value.trim();
  const description = el('po-desc').value.trim();
  if (!po || !description) { toast('PO and description required', true); return; }
  try {
    await api.post('/api/pos', {
      po, description,
      vendor: el('po-vendor').value.trim(),
      category: el('po-cat').value,
      qtyOrdered: parseInt(el('po-qty').value, 10) || 1,
      status: el('po-status').value,
      notes: el('po-notes').value.trim(),
    });
    ['po-num', 'po-desc', 'po-vendor', 'po-notes'].forEach(id => el(id).value = '');
    el('po-qty').value = '1';
    closeModal('addPO');
    await refreshState();
    dataChanged();
    toast('PO added');
  } catch (err) {
    toast(err.message, true);
  }
};

// ── Manual receipt ──
window.saveManual = async () => {
  const po = el('mr-po').value.trim();
  const desc = el('mr-desc').value.trim();
  const by = el('mr-by').value.trim() || 'Unknown';
  rememberName(by !== 'Unknown' ? by : '');
  try {
    await api.post('/api/receipts', {
      po,
      jobNumber: extractJobNum(po) || state.activeJob || '',
      vendor: el('mr-vendor').value.trim(),
      invoiceNumber: po,
      total: 0,
      receivedBy: by,
      condition: el('mr-cond').value,
      location: el('mr-loc').value,
      lineItems: [{ partNumber: '', description: desc || po || 'Material', unit: 'EA', qty: parseInt(el('mr-qty').value, 10) || 1, unitPrice: 0, lineTotal: 0 }],
    });
    ['mr-po', 'mr-vendor', 'mr-desc', 'mr-by'].forEach(id => el(id).value = '');
    el('mr-qty').value = '1';
    closeModal('addManual');
    await refreshState();
    dataChanged();
    toast('Receipt logged');
  } catch (err) {
    toast(err.message, true);
  }
};

// Pre-fill "received by" fields with the saved name when the manual modal opens.
document.addEventListener('ssm:data-changed', () => {
  const mrBy = el('mr-by');
  if (mrBy && !mrBy.value) mrBy.value = savedName();
});
