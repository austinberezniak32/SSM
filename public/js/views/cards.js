// Shared receipt card markup (job pages + slips tab).
import { money, isAtShop, isSent } from '../state.js';
import { esc, el, icon } from '../ui.js';

export function itemRows(r) {
  return (r.lineItems || []).map(it => `
    <div class="rc-item-row">
      <span class="rc-item-pn">${esc(it.partNumber) || '—'}</span>
      <div class="rc-item-desc">${esc(it.description) || '—'}</div>
      <div class="rc-item-qty">${Number(it.qty) || 0} <span class="unit">${esc(it.unit) || 'EA'}</span></div>
      <div class="rc-item-cost">${it.lineTotal > 0 ? money(it.lineTotal) : ''}</div>
    </div>`).join('');
}

export function rcCard(r, { showSend = false, prefix = 'rc', showJob = false } = {}) {
  const atShop = isAtShop(r);
  const sent = isSent(r);
  const locBadge = sent
    ? `<span class="badge b-sent">${icon('check')}Sent to Field</span>`
    : atShop
      ? `<span class="badge b-shop">${icon('factory')}At Shop</span>`
      : `<span class="badge b-field">${icon('truck')}On Site</span>`;
  const photoUrl = r.photoId ? `/api/photos/${r.photoId}` : null;
  const thumb = photoUrl
    ? `<div class="rc-thumb"><img src="${photoUrl}" alt="slip" loading="lazy" onclick="openLb(event,'${photoUrl}')"></div>`
    : `<div class="rc-thumb">${icon('package')}</div>`;
  const sendBtn = showSend && atShop
    ? `<div class="rc-actions"><button class="btn btn-field btn-sm" onclick="sendToField(${r.id})">${icon('send')}Send to Field</button></div>`
    : '';
  const count = (r.lineItems || []).length;
  return `
  <div class="receipt-card${sent ? ' sent-card' : ''}">
    <button class="rc-header" onclick="toggleCard('${prefix}',${r.id})">
      ${thumb}
      <div class="rc-body">
        <div class="rc-vendor">${esc(r.vendor) || 'Unknown vendor'}</div>
        <div class="rc-po">PO ${esc(r.po) || '—'}${showJob ? ' · ' + (esc(r.jobNumber) || '—') : ''}</div>
        <div class="rc-meta">
          <span>${esc(String(r.createdAt || '').slice(0, 10))}</span>
          <span>${esc(r.receivedBy) || '—'}</span>
          ${r.condition && r.condition !== 'Good' ? `<span class="warn">${esc(r.condition)}</span>` : ''}
        </div>
        <div class="rc-badges">${locBadge}</div>
      </div>
      <div class="rc-right">
        <div class="rc-total">${r.total > 0 ? money(r.total) : ''}</div>
        <div class="rc-count">${count} item${count !== 1 ? 's' : ''}</div>
        <svg class="icon rc-chevron" id="${prefix}chev${r.id}"><use href="#i-chevron-down"/></svg>
      </div>
    </button>
    <div class="rc-items" id="${prefix}items${r.id}" style="display:none">${itemRows(r)}</div>
    ${sendBtn}
  </div>`;
}

window.toggleCard = (prefix, id) => {
  const body = el(prefix + 'items' + id);
  const chev = el(prefix + 'chev' + id);
  if (!body) return;
  const opening = body.style.display === 'none' || body.style.display === '';
  body.style.display = opening ? 'block' : 'none';
  if (chev) chev.classList.toggle('open', opening);
};
