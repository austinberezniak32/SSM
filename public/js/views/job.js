// Single-job pages: overview tiles, shop list, field list.
import { api } from '../api.js';
import { state, shopRecs, sentRecs, fieldRecs, jobRecs, refreshState, dataChanged } from '../state.js';
import { el, toast, icon } from '../ui.js';
import { rcCard } from './cards.js';

const sectionHdr = (title, count) =>
  `<div class="section-hdr"><span class="section-hdr-title">${title}</span><span class="count">${count}</span></div>`;

const emptyBlock = (ic, title) => `
  <div class="empty-state" style="padding:36px 20px">
    <div class="empty-icon">${icon(ic, 'icon icon-xl')}</div>
    <div class="empty-title">${title}</div>
  </div>`;

export function renderJobOverview() {
  if (!state.activeJob) return;
  el('shopCount').textContent = shopRecs(state.activeJob).length;
  el('fieldCount').textContent = fieldRecs(state.activeJob).length;
  const recent = jobRecs(state.activeJob).slice(0, 3);
  el('jobRecentSection').innerHTML = recent.length
    ? sectionHdr('Recent activity', recent.length) + recent.map(r => rcCard(r, { prefix: 'jo' })).join('')
    : `<div class="empty-state">
        <div class="empty-icon">${icon('package', 'icon icon-xl')}</div>
        <div class="empty-title">No receipts yet</div>
        <p>Scan a packing slip to get started.</p>
      </div>`;
}

export function renderShop() {
  if (!state.activeJob) return;
  const at = shopRecs(state.activeJob);
  const sent = sentRecs(state.activeJob);
  el('shopAtShop').innerHTML = at.length
    ? sectionHdr('At shop', at.length) + at.map(r => rcCard(r, { showSend: true, prefix: 'sh' })).join('')
    : emptyBlock('package', 'Nothing at shop');
  el('sentLabel').textContent = `Sent to Field (${sent.length})`;
  el('sentList').innerHTML = sent.map(r => rcCard(r, { prefix: 'se' })).join('');
}

export function renderField() {
  if (!state.activeJob) return;
  const fi = fieldRecs(state.activeJob);
  el('fieldOnSite').innerHTML = fi.length
    ? sectionHdr('On site', fi.length) + fi.map(r => rcCard(r, { prefix: 'fi' })).join('')
    : emptyBlock('truck', 'Nothing on site');
}

window.sendToField = async (id) => {
  try {
    await api.post(`/api/receipts/${id}/send`);
    await refreshState();
    dataChanged();
    toast('Sent to field');
  } catch (err) {
    toast(err.message, true);
  }
};

window.toggleSent = () => {
  const list = el('sentList');
  const open = list.style.display === 'none';
  list.style.display = open ? 'block' : 'none';
  el('sentArrow').classList.toggle('open', open);
};
