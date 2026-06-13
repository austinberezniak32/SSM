// Small DOM helpers shared by every view.
export const el = id => document.getElementById(id);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Inline SVG from the sprite in index.html.
export const icon = (name, cls = 'icon') =>
  `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export function toast(msg, err) {
  const wrap = el('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.innerHTML = icon(err ? 'alert' : 'check') + `<span>${esc(msg)}</span>`;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

export function openModal(n) { el('modal-' + n).classList.add('open'); }
export function closeModal(n) { el('modal-' + n).classList.remove('open'); }

export function openLightbox(src) {
  el('lightboxImg').src = src;
  el('lightbox').classList.add('open');
}
export function closeLightbox() { el('lightbox').classList.remove('open'); }

window.openModal = openModal;
window.closeModal = closeModal;
window.closeLightbox = closeLightbox;
window.openLb = (e, src) => { e.stopPropagation(); openLightbox(src); };
