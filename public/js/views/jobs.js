// Jobs list (home page).
import { state, shopRecs, fieldRecs, jobRecs } from '../state.js';
import { esc, el, icon } from '../ui.js';

export function renderJobList() {
  const nums = Object.keys(state.jobs).sort();
  el('jobsEmpty').style.display = nums.length ? 'none' : 'block';
  el('jobList').innerHTML = nums.map(j => {
    const jb = state.jobs[j];
    const sh = shopRecs(j).length, fi = fieldRecs(j).length, tot = jobRecs(j).length;
    const sub = jb.name !== jb.number ? (jb.name.replace(jb.number, '').trim() || jb.name) : '';
    return `<button class="job-card" onclick="openJob('${esc(j)}')">
      <div class="job-avatar">${icon('building')}</div>
      <div class="job-info">
        <div class="job-num">${esc(jb.number)}</div>
        ${sub ? `<div class="job-name">${esc(sub)}</div>` : ''}
        <div class="job-meta">${tot} slip${tot !== 1 ? 's' : ''}</div>
      </div>
      <div class="job-pills">
        ${sh ? '<span class="jp b-shop" title="At shop">' + sh + '</span>' : ''}
        ${fi ? '<span class="jp b-field" title="On site">' + fi + '</span>' : ''}
      </div>
      ${icon('chevron-right')}
    </button>`;
  }).join('');
}
