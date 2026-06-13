// App shell: login, navigation, and re-rendering after data changes.
import { api, whenAuthRequired } from './api.js';
import { state, refreshState, savedName, rememberName } from './state.js';
import { el, toast } from './ui.js';
import { renderJobList } from './views/jobs.js';
import { renderJobOverview, renderShop, renderField } from './views/job.js';
import { renderSlips } from './views/slips.js';
import { renderSettings } from './views/settings.js';
import './views/scan.js';
import './views/edit.js';

let pageStack = ['jobs'];

const PAGE_RENDER = {
  jobs: renderJobList,
  job: renderJobOverview,
  shop: renderShop,
  field: renderField,
  slips: renderSlips,
  settings: renderSettings,
};

function currentPage() { return pageStack[pageStack.length - 1]; }

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el('page-' + name)?.classList.add('active');
  el('contentArea').scrollTop = 0;
}

function refreshHeader() {
  const cur = currentPage();
  el('hdrBack').style.display = pageStack.length > 1 ? 'block' : 'none';
  const jobName = state.activeJob ? (state.jobs[state.activeJob]?.name || state.activeJob) : '—';
  const titles = {
    jobs: 'Material Tracker', slips: 'Packing Slips', settings: 'Settings',
    job: jobName,
    shop: 'Shop · ' + (state.activeJob || ''),
    field: 'Field · ' + (state.activeJob || ''),
  };
  el('hdrTitle').textContent = titles[cur] || cur;
}

function renderCurrent() {
  PAGE_RENDER[currentPage()]?.();
  refreshHeader();
}

window.goTab = (tab) => {
  pageStack = [tab];
  showPage(tab);
  const tabs = ['jobs', 'slips', 'settings'];
  document.querySelectorAll('.bnav-btn').forEach((b, i) => b.classList.toggle('active', tabs[i] === tab));
  renderCurrent();
};

window.goPage = (page) => {
  pageStack.push(page);
  showPage(page);
  renderCurrent();
};

window.goBack = () => {
  if (pageStack.length <= 1) return;
  pageStack.pop();
  showPage(currentPage());
  renderCurrent();
};

window.openJob = (j) => {
  state.activeJob = j;
  window.goPage('job');
};

// Any mutation re-renders whatever page is showing.
document.addEventListener('ssm:data-changed', renderCurrent);

// ── login ──
function showLogin() {
  el('loginScreen').classList.remove('hidden');
  el('loginName').value = savedName();
}
function hideLogin() { el('loginScreen').classList.add('hidden'); }

whenAuthRequired(showLogin);

window.submitLogin = async () => {
  const name = el('loginName').value.trim();
  const passcode = el('loginPass').value;
  const err = el('loginErr');
  err.textContent = '';
  if (!name) { err.textContent = 'Enter your name.'; return; }
  try {
    await api.post('/api/login', { passcode, name });
    rememberName(name);
    el('loginPass').value = '';
    await init();
  } catch (e) {
    err.textContent = e.message === 'Wrong passcode' ? 'Wrong passcode — try again.' : e.message;
  }
};

el('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') window.submitLogin(); });

async function init() {
  try {
    state.me = await api.get('/api/me');
  } catch {
    return; // 401 path already showed the login screen
  }
  hideLogin();
  try {
    await refreshState();
  } catch (e) {
    toast(e.message, true);
    return;
  }
  renderCurrent();
}

init();
