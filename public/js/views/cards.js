// Shared receipt card markup (job pages + slips tab).
import { money, isAtShop, isSent } from '../state.js';
import { esc, el } from '../ui.js';

export function itemRows(r) {
  return (r.lineItems || []).map(it => `
    <div class="rc-item-row">
      <div class="rc-item-pn">${esc(it.partNumber) || '—'}</div>
      <div class="rc-item-desc">${esc(it.description) || '—'}</div>
      <div class="rc-item-qty">${Number(it.qty) || 0} <span style="font-size:10px;font-weight:400">${esc(it.unit) || 'EA'}</span></div>
      <div class="rc-item-cost">${it.lineTotal > 0 ? money(it.lineTotal) : ''}</div>
    </div>`).join('');
}

export function rcCard(r, { showSend = false, prefix = 'rc', showJob = false } = {}) {
  const atShop = isAtShop(r);
  const sent = isSent(r);
  const cardCls = sent ? 'sent-card' : atShop ? 'shop-card' : 'field-card';
  const locBadge = sent
    ? '<span class="badge b-sent">✓ Sent to Field</span>'
    : atShop ? '<span class="badge b-shop">🏭 At Shop</span>'
    : '<span class="badge b-field">🚛 On Site</span>';
  const photoUrl = r.photoId ? `/api/photos/${r.photoId}` : null;
  const thumbHtml = photoUrl
    ? `<div class="rc-thumb"><img src="${photoUrl}" alt="slip" onclick="openLb(event,'${photoUrl}')"></div>`
    : '';
  const sendBtn = showSend && atShop
    ? `<div class="rc-actions"><button class="btn btn-orange btn-sm" onclick="sendToField(${r.id})">📦 Send to Field →</button></div>`
    : '';
  const count = (r.lineItems || []).length;
  return `
  <div class="receipt-card ${cardCls}">
    <div class="rc-header" onclick="toggleCard('${prefix}',${r.id})">
      ${thumbHtml}
      <div class="rc-body">
        <div class="rc-vendor">${esc(r.vendor) || 'Unknown'}</div>
        <div class="rc-po">PO: ${esc(r.po) || '—'} · Job: ${showJob ? '<strong>' : ''}${esc(r.jobNumber) || '—'}${showJob ? '</strong>' : ''}</div>
        <div class="rc-meta">
          <span>📅 ${esc(String(r.createdAt || '').slice(0, 10))}</span>
          <span>👤 ${esc(r.receivedBy) || '—'}</span>
          ${r.condition && r.condition !== 'Good' ? '<span style="color:var(--red)">⚠ ' + esc(r.condition) + '</span>' : ''}
        </div>
        <div style="margin-top:5px">${locBadge}</div>
      </div>
      <div class="rc-right">
        <div class="rc-total">${r.total > 0 ? money(r.total) : ''}</div>
        <div class="rc-count">${count} item${count !== 1 ? 's' : ''}</div>
        <div class="rc-chevron" id="${prefix}chev${r.id}">▶</div>
      </div>
    </div>
    <div id="${prefix}items${r.id}" style="display:none;border-top:2px solid var(--gray-light)">${itemRows(r)}</div>
    ${sendBtn}
  </div>`;
}

window.toggleCard = (prefix, id) => {
  const body = el(prefix + 'items' + id);
  const chev = el(prefix + 'chev' + id);
  if (!body) return;
  const opening = body.style.display === 'none' || body.style.display === '';
  body.style.display = opening ? 'block' : 'none';
  if (chev) chev.textContent = opening ? '▼' : '▶';
};
