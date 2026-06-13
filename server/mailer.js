// Purchasing-department forwarding. When configured, every logged receipt is
// emailed with its line items and the slip photo attached as proof of receipt.
// Activates when SMTP_* and PURCHASING_EMAIL env vars are set; silent otherwise.
import nodemailer from 'nodemailer';

export function purchasingConfigured() {
  return !!(process.env.PURCHASING_EMAIL && process.env.SMTP_HOST
    && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transport = null;
function getTransport() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));
const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * @param {object} r  { jobNumber, po, vendor, invoiceNumber, total, receivedBy,
 *                      condition, location, notes, lineItems[], photo?: {mime, data(base64)} }
 */
export async function notifyPurchasing(r) {
  if (!purchasingConfigured()) return;

  const rows = (r.lineItems || []).map(it => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e9f0;font-family:monospace;font-size:12px">${esc(it.partNumber) || '—'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e9f0">${esc(it.description)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e9f0;text-align:right;white-space:nowrap">${Number(it.qty) || 0} ${esc(it.unit) || 'EA'}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e9f0;text-align:right">${it.lineTotal > 0 ? money(it.lineTotal) : ''}</td>
    </tr>`).join('');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#0e1726;max-width:640px">
    <h2 style="margin:0 0 4px">Material received — proof of receipt</h2>
    <p style="margin:0 0 16px;color:#4a5768">Logged automatically by SSM Material Tracker.</p>
    <table style="border-collapse:collapse;margin-bottom:16px">
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">PO</td><td style="font-family:monospace"><strong>${esc(r.po) || '(none)'}</strong></td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">Job</td><td><strong>${esc(r.jobNumber) || '—'}</strong></td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">Vendor</td><td>${esc(r.vendor) || '—'}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">Invoice #</td><td>${esc(r.invoiceNumber) || '—'}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">Received by</td><td>${esc(r.receivedBy) || '—'}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">Condition</td><td>${esc(r.condition) || 'Good'}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#4a5768">Delivered to</td><td>${r.location === 'direct' ? 'Job site (direct)' : 'Shop'}</td></tr>
      ${r.notes ? `<tr><td style="padding:3px 14px 3px 0;color:#4a5768">Notes</td><td>${esc(r.notes)}</td></tr>` : ''}
    </table>
    <table style="border-collapse:collapse;width:100%;border:1px solid #e5e9f0">
      <tr style="background:#f7f9fc">
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#4a5768">Part #</th>
        <th style="padding:6px 10px;text-align:left;font-size:12px;color:#4a5768">Description</th>
        <th style="padding:6px 10px;text-align:right;font-size:12px;color:#4a5768">Qty</th>
        <th style="padding:6px 10px;text-align:right;font-size:12px;color:#4a5768">Total</th>
      </tr>
      ${rows}
    </table>
    ${r.total > 0 ? `<p style="text-align:right;font-size:16px"><strong>Document total: ${money(r.total)}</strong></p>` : ''}
    ${r.photo ? '<p style="color:#4a5768">Packing slip photo attached.</p>' : ''}
  </div>`;

  await getTransport().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.PURCHASING_EMAIL,
    subject: `Material received — PO ${r.po || '(no PO)'} — ${r.vendor || 'Unknown vendor'}`,
    html,
    attachments: r.photo && r.photo.data
      ? [{ filename: `packing-slip-${(r.po || 'receipt').replace(/[^\w.-]/g, '_')}.jpg`, content: Buffer.from(r.photo.data, 'base64'), contentType: r.photo.mime || 'image/jpeg' }]
      : [],
  });
}
