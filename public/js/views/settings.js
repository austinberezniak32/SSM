// Settings: scanner status, display name, exports, sign out.
import { api } from '../api.js';
import { state, savedName, rememberName, today } from '../state.js';
import { esc, el, toast, icon } from '../ui.js';

export function renderSettings() {
  const me = state.me || {};
  el('scanStatus').innerHTML = me.scanConfigured
    ? `<div class="status-pill ok">${icon('check')}Scanner active — slip photos are read automatically.</div>`
    : `<div class="status-pill bad">${icon('alert')}Scanner offline — ANTHROPIC_API_KEY is not set on the server.</div>`;
  el('purchStatus').innerHTML = me.purchasingConfigured
    ? `<div class="status-pill ok">${icon('check')}Every logged receipt is emailed to ${esc(me.purchasingEmail)} with the slip photo attached.</div>`
    : `<div class="settings-note" style="margin-bottom:0">Not set up yet. When the server has <code>PURCHASING_EMAIL</code> and <code>SMTP_*</code> variables configured, every scanned slip is automatically emailed to purchasing as proof of receipt for PO payment.</div>`;
  el('myNameInput').value = savedName();
  el('accountInfo').innerHTML = `Signed in as <strong>${esc(me.name || '—')}</strong> on this device.`;
  el('devDbWarn').innerHTML = me.devDb
    ? `<div class="info-box warn"><strong>Dev mode:</strong> no DATABASE_URL set — data is in memory and will be lost when the server restarts.</div>`
    : '';
}

window.saveMyName = () => {
  const n = el('myNameInput').value.trim();
  if (!n) { toast('Enter a name first', true); return; }
  rememberName(n);
  toast('Name saved');
};

window.exportBackup = () => {
  const blob = new Blob(
    [JSON.stringify({ jobs: state.jobs, receipts: state.receipts, pos: state.pos, exported: new Date().toISOString() }, null, 2)],
    { type: 'application/json' }
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ssm-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Backup exported');
};

window.logoutNow = async () => {
  try { await api.post('/api/logout'); } catch { /* session is gone either way */ }
  window.location.reload();
};
