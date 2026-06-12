// Single-job pages: overview tiles, shop list, field list.
import { api } from '../api.js';
import { state, shopRecs, sentRecs, fieldRecs, jobRecs, refreshState, dataChanged } from '../state.js';
import { el, toast } from '../ui.js';
import { rcCard } from './cards.js';

export function renderJobOverview() {
  if (!state.activeJob) return;
  el('shopCount').textContent = shopRecs(state.activeJob).length;
  el('fieldCount').textContent = fieldRecs(state.activeJob).length;
  const recent = jobRecs(state.activeJob).slice(0, 3);
  el('jobRecentSection').innerHTML = recent.length
    ? `<div class="section-hdr"><div class="blue-bar"></div><div class="section-hdr-title">Recent</div></div>${recent.map(r => rcCard(r)).join('')}`
    : `<div class="empty-state"><div class="empty-icon">📦</div><p>No receipts yet.<br>Scan a packing slip to get started.</p></div>`;
}

export function renderShop() {
  if (!state.activeJob) return;
  const at = shopRecs(state.activeJob);
  const sent = sentRecs(state.activeJob);
  el('shopAtShop').innerHTML = at.length
    ? `<div class="section-hdr"><div class="blue-bar"></div><div class="section-hdr-title" style="color:var(--shop-color)">At Shop (${at.length})</div></div>${at.map(r => rcCard(r, { showSend: true })).join('')}`
    : `<div class="empty-state" style="padding:30px 20px"><div class="empty-icon">📦</div><p>Nothing at shop.</p></div>`;
  el('sentLabel').textContent = `Sent to Field (${sent.length})`;
  el('sentList').innerHTML = sent.map(r => rcCard(r)).join('');
}

export function renderField() {
  if (!state.activeJob) return;
  const fi = fieldRecs(state.activeJob);
  el('fieldOnSite').innerHTML = fi.length
    ? `<div class="section-hdr"><div class="blue-bar"></div><div class="section-hdr-title" style="color:var(--field-color)">On Site (${fi.length})</div></div>${fi.map(r => rcCard(r)).join('')}`
    : `<div class="empty-state" style="padding:30px 20px"><div class="empty-icon">🚛</div><p>Nothing on site.</p></div>`;
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
  el('sentArrow').textContent = open ? '▼' : '▶';
};
