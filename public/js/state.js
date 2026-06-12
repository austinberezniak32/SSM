// Client-side cache of server state plus shared helpers.
import { api } from './api.js';

export const state = {
  jobs: {},        // number -> { number, name, createdAt }
  receipts: [],    // newest first, each with lineItems[]
  pos: [],
  me: null,        // { name, scanConfigured, devDb }
  activeJob: null,
  scanPath: 'shop',
};

export async function refreshState() {
  const data = await api.get('/api/state');
  state.jobs = {};
  for (const j of data.jobs) state.jobs[j.number] = j;
  state.receipts = data.receipts;
  state.pos = data.pos;
}

export function extractJobNum(po) {
  if (!po) return null;
  const s = String(po).trim();
  if (!s) return null;
  const m = s.match(/^([A-Za-z0-9]+)-/);
  return (m ? m[1] : s).toUpperCase();
}

export const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const today = () => new Date().toISOString().slice(0, 10);

export const isAtShop = r => r.location === 'shop' && r.status !== 'sent';
export const isSent = r => r.location === 'shop' && r.status === 'sent';
export const shopRecs = j => state.receipts.filter(r => r.jobNumber === j && isAtShop(r));
export const sentRecs = j => state.receipts.filter(r => r.jobNumber === j && isSent(r));
export const fieldRecs = j => state.receipts.filter(r => r.jobNumber === j && (r.location === 'direct' || r.status === 'sent'));
export const jobRecs = j => state.receipts.filter(r => r.jobNumber === j);

export const savedName = () => localStorage.getItem('ssm_name') || '';
export const rememberName = n => { if (n) localStorage.setItem('ssm_name', n); };

// Fired after any mutation; app.js re-renders whatever page is showing.
export function dataChanged() {
  document.dispatchEvent(new Event('ssm:data-changed'));
}
