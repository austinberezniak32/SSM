// All-slips tab with job filter and CSV export.
import { state } from '../state.js';
import { esc, el } from '../ui.js';
import { renderReceiptList } from './cards.js';

export function renderSlips() {
  const sel = el('slipJobFilter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">All Jobs</option>' + Object.keys(state.jobs).sort()
    .map(j => `<option value="${esc(j)}">${esc(state.jobs[j].name)}</option>`).join('');
  sel.value = cur;

  const list = sel.value ? state.receipts.filter(r => r.jobNumber === sel.value) : state.receipts;
  el('slipsEmpty').style.display = list.length ? 'none' : 'block';
  el('slipsList').innerHTML = renderReceiptList(list, { prefix: 'sl', showJob: true });
}

window.renderSlips = renderSlips;
window.exportSlipsCSV = () => { window.location.href = '/api/export.csv'; };
