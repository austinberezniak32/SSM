// Edit-receipt modal: fix the PO/job (moves UNSORTED receipts to the right
// job), vendor, received-by, condition, and notes.
import { api } from '../api.js';
import { state, refreshState, dataChanged, extractJobNum } from '../state.js';
import { el, toast, openModal, closeModal } from '../ui.js';

let editingId = null;

window.openEditReceipt = (id) => {
  const r = state.receipts.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  el('er-po').value = r.po || '';
  el('er-job').value = r.jobNumber === 'UNSORTED' ? '' : (r.jobNumber || '');
  el('er-vendor').value = r.vendor || '';
  el('er-by').value = r.receivedBy || '';
  el('er-cond').value = r.condition || 'Good';
  el('er-notes').value = r.notes || '';
  openModal('editReceipt');
};

window.saveReceiptEdit = async () => {
  if (editingId == null) return;
  const po = el('er-po').value.trim();
  const jobNumber = el('er-job').value.trim().toUpperCase() || extractJobNum(po) || '';
  try {
    await api.put(`/api/receipts/${editingId}`, {
      po,
      jobNumber,
      vendor: el('er-vendor').value.trim(),
      receivedBy: el('er-by').value.trim(),
      condition: el('er-cond').value,
      notes: el('er-notes').value.trim(),
    });
    editingId = null;
    closeModal('editReceipt');
    await refreshState();
    dataChanged();
    toast('Receipt updated');
  } catch (err) {
    toast(err.message, true);
  }
};
