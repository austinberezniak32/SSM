// Jobs list (home page).
import { state, shopRecs, fieldRecs, jobRecs } from '../state.js';
import { esc, el } from '../ui.js';

export function renderJobList() {
  const nums = Object.keys(state.jobs).sort();
  el('jobsEmpty').style.display = nums.length ? 'none' : 'block';
  el('jobList').innerHTML = nums.map(j => {
    const jb = state.jobs[j];
    const sh = shopRecs(j).length, fi = fieldRecs(j).length, tot = jobRecs(j).length;
    const shortName = jb.name !== jb.num && jb.name !== jb.number
      ? (jb.name.replace(jb.number, '').trim() || jb.name)
      : jb.number;
    return `<div class="job-card" onclick="openJob('${esc(j)}')">
      <div class="job-num">${esc(jb.number)}</div>
      <div class="job-info">
        <div class="job-name">${esc(shortName)}</div>
        <div class="job-meta">${tot} slip${tot !== 1 ? 's' : ''}
          ${sh ? ' &middot; <span style="color:var(--shop-color)">' + sh + ' at shop</span>' : ''}
          ${fi ? ' &middot; <span style="color:var(--field-color)">' + fi + ' on site</span>' : ''}
        </div>
      </div>
      <div>
        ${sh ? '<span class="jp b-shop">' + sh + '</span>' : ''}
        ${fi ? '<span class="jp b-field">' + fi + '</span>' : ''}
      </div>
      <span style="color:var(--gray-mid);font-size:20px">›</span>
    </div>`;
  }).join('');
}
