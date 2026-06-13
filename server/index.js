// HTTP API + static frontend host.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, q, isDevDb } from './db.js';
import { requireAuth, issueSession, clearSession, checkPasscode } from './auth.js';
import { scanSlip, scanConfigured } from './scan.js';
import { notifyPurchasing, purchasingConfigured } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20mb' }));

const nowISO = () => new Date().toISOString();

// "H01460-193" -> "H01460"; a bare value is its own job number.
function extractJobNumber(po) {
  if (!po) return null;
  const s = String(po).trim();
  if (!s) return null;
  const m = s.match(/^([A-Za-z0-9]+)-/);
  return (m ? m[1] : s).toUpperCase();
}

// Returns the job id, creating the job if needed. A name hint upgrades a
// job whose name is still just its number (e.g. slip printed the project name).
async function ensureJob(number, nameHint) {
  const existing = await q('SELECT id, name FROM jobs WHERE number = $1', [number]);
  if (existing.rows.length) {
    const job = existing.rows[0];
    if (nameHint && nameHint !== number && job.name === number) {
      await q('UPDATE jobs SET name = $1 WHERE id = $2', [nameHint, job.id]);
    }
    return job.id;
  }
  const ins = await q(
    'INSERT INTO jobs (number, name, created_at) VALUES ($1, $2, $3) RETURNING id',
    [number, nameHint || number, nowISO()]
  );
  return ins.rows[0].id;
}

// ── auth (open routes) ──
app.post('/api/login', async (req, res) => {
  const { passcode, name } = req.body || {};
  if (!checkPasscode(passcode)) {
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    res.status(401).json({ error: 'Wrong passcode' });
    return;
  }
  issueSession(res, String(name || 'crew').slice(0, 60));
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

app.use('/api', requireAuth);

app.get('/api/me', (req, res) => {
  res.json({
    name: req.session.name,
    scanConfigured: scanConfigured(),
    purchasingConfigured: purchasingConfigured(),
    purchasingEmail: purchasingConfigured() ? process.env.PURCHASING_EMAIL : null,
    devDb: isDevDb,
  });
});

// ── full app state (small data set; one fetch keeps the client simple) ──
app.get('/api/state', async (req, res) => {
  const jobs = (await q('SELECT number, name, created_at FROM jobs ORDER BY number')).rows
    .map(j => ({ number: j.number, name: j.name, createdAt: j.created_at }));

  const receipts = (await q(`
    SELECT r.id, j.number AS job_number, r.vendor, r.invoice_number, r.po, r.total,
           r.received_by, r.condition, r.location, r.status, r.sent_at, r.notes,
           r.photo_id, r.created_at
    FROM receipts r JOIN jobs j ON j.id = r.job_id
    ORDER BY r.id DESC
  `)).rows;

  const items = (await q('SELECT * FROM line_items ORDER BY id')).rows;
  const itemsByReceipt = new Map();
  for (const it of items) {
    if (!itemsByReceipt.has(it.receipt_id)) itemsByReceipt.set(it.receipt_id, []);
    itemsByReceipt.get(it.receipt_id).push({
      partNumber: it.part_number, description: it.description, unit: it.unit,
      qty: it.qty, unitPrice: it.unit_price, lineTotal: it.line_total,
    });
  }

  const pos = (await q(`
    SELECT p.id, p.po, j.number AS job_number, p.description, p.vendor, p.category,
           p.qty_ordered, p.status, p.notes, p.created_at
    FROM purchase_orders p LEFT JOIN jobs j ON j.id = p.job_id
    ORDER BY p.id DESC
  `)).rows;

  res.json({
    jobs,
    receipts: receipts.map(r => ({
      id: r.id, jobNumber: r.job_number, vendor: r.vendor, invoiceNumber: r.invoice_number,
      po: r.po, total: r.total, receivedBy: r.received_by, condition: r.condition,
      location: r.location, status: r.status, sentAt: r.sent_at, notes: r.notes,
      photoId: r.photo_id, createdAt: r.created_at,
      lineItems: itemsByReceipt.get(r.id) || [],
    })),
    pos: pos.map(p => ({
      id: p.id, po: p.po, jobNumber: p.job_number, description: p.description,
      vendor: p.vendor, category: p.category, qtyOrdered: p.qty_ordered,
      status: p.status, notes: p.notes, createdAt: p.created_at,
    })),
  });
});

// ── AI scan ──
app.post('/api/scan', async (req, res) => {
  if (!scanConfigured()) {
    res.status(503).json({ error: 'Scanner not set up — ANTHROPIC_API_KEY is missing on the server.' });
    return;
  }
  const { image, mediaType } = req.body || {};
  if (!image) {
    res.status(400).json({ error: 'No image provided' });
    return;
  }
  try {
    res.json(await scanSlip(image, mediaType || 'image/jpeg'));
  } catch (err) {
    res.status(502).json({ error: err.message || 'Scan failed' });
  }
});

// ── receipts ──
app.post('/api/receipts', async (req, res) => {
  const b = req.body || {};
  const po = String(b.po || '').trim();
  const jobNumber = (String(b.jobNumber || '').trim().toUpperCase()) || extractJobNumber(po) || 'UNSORTED';
  const nameHint = String(b.jobName || '').trim() || undefined;
  const jobId = await ensureJob(jobNumber, nameHint);

  let photoId = null;
  if (b.photo && b.photo.data) {
    const ins = await q(
      'INSERT INTO photos (mime, data, created_at) VALUES ($1, $2, $3) RETURNING id',
      [b.photo.mime || 'image/jpeg', Buffer.from(b.photo.data, 'base64'), nowISO()]
    );
    photoId = ins.rows[0].id;
  }

  const location = b.location === 'direct' ? 'direct' : 'shop';
  const status = location === 'direct' ? 'delivered' : 'at_shop';
  const ins = await q(`
    INSERT INTO receipts (job_id, vendor, invoice_number, po, total, received_by, condition,
                          location, status, notes, photo_id, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [jobId, b.vendor || '', b.invoiceNumber || '', po, Number(b.total) || 0,
     b.receivedBy || '', b.condition || 'Good', location, status, b.notes || '', photoId, nowISO()]
  );
  const receiptId = ins.rows[0].id;

  const lineItems = Array.isArray(b.lineItems) ? b.lineItems : [];
  for (const it of lineItems) {
    await q(`
      INSERT INTO line_items (receipt_id, part_number, description, unit, qty, unit_price, line_total)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [receiptId, it.partNumber || '', it.description || '', it.unit || 'EA',
       Number(it.qty) || 0, Number(it.unitPrice) || 0, Number(it.lineTotal) || 0]
    );
  }

  // Proof-of-receipt copy to purchasing — fire-and-forget so a mail hiccup
  // never blocks the crew from logging material.
  notifyPurchasing({
    jobNumber, po,
    vendor: b.vendor || '', invoiceNumber: b.invoiceNumber || '',
    total: Number(b.total) || 0, receivedBy: b.receivedBy || '',
    condition: b.condition || 'Good', location, notes: b.notes || '',
    lineItems, photo: b.photo || null,
  }).catch(err => console.warn('[mail] purchasing notification failed:', err.message));

  res.json({ id: receiptId, jobNumber });
});

// Edit a receipt — reassigning the PO/job moves it out of UNSORTED.
app.put('/api/receipts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q('SELECT * FROM receipts WHERE id = $1', [id]);
  if (!existing.rows.length) {
    res.status(404).json({ error: 'Receipt not found' });
    return;
  }
  const r = existing.rows[0];
  const b = req.body || {};
  const po = b.po !== undefined ? String(b.po).trim() : r.po;
  const jobNumber = (String(b.jobNumber || '').trim().toUpperCase()) || extractJobNumber(po) || 'UNSORTED';
  const jobId = await ensureJob(jobNumber, String(b.jobName || '').trim() || undefined);
  await q(`
    UPDATE receipts SET job_id = $1, po = $2, vendor = $3, invoice_number = $4,
                        received_by = $5, condition = $6, notes = $7
    WHERE id = $8`,
    [jobId, po,
     b.vendor !== undefined ? String(b.vendor).trim() : r.vendor,
     b.invoiceNumber !== undefined ? String(b.invoiceNumber).trim() : r.invoice_number,
     b.receivedBy !== undefined ? String(b.receivedBy).trim() : r.received_by,
     b.condition !== undefined ? b.condition : r.condition,
     b.notes !== undefined ? String(b.notes).trim() : r.notes,
     id]
  );
  res.json({ ok: true, jobNumber });
});

app.post('/api/receipts/:id/send', async (req, res) => {
  await q("UPDATE receipts SET status = 'sent', sent_at = $1 WHERE id = $2",
    [nowISO(), Number(req.params.id)]);
  res.json({ ok: true });
});

app.delete('/api/receipts/:id', async (req, res) => {
  const id = Number(req.params.id);
  const r = await q('SELECT photo_id FROM receipts WHERE id = $1', [id]);
  await q('DELETE FROM line_items WHERE receipt_id = $1', [id]);
  await q('DELETE FROM receipts WHERE id = $1', [id]);
  if (r.rows[0]?.photo_id) await q('DELETE FROM photos WHERE id = $1', [r.rows[0].photo_id]);
  res.json({ ok: true });
});

// ── purchase orders ──
app.post('/api/pos', async (req, res) => {
  const b = req.body || {};
  const po = String(b.po || '').trim();
  const description = String(b.description || '').trim();
  if (!po || !description) {
    res.status(400).json({ error: 'PO and description required' });
    return;
  }
  const jobNumber = extractJobNumber(po);
  const jobId = jobNumber ? await ensureJob(jobNumber) : null;
  const ins = await q(`
    INSERT INTO purchase_orders (po, job_id, description, vendor, category, qty_ordered, status, notes, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [po, jobId, description, b.vendor || '', b.category || 'Mechanical',
     Number(b.qtyOrdered) || 1, b.status || 'Ordered', b.notes || '', nowISO()]
  );
  res.json({ id: ins.rows[0].id, jobNumber });
});

// ── photos ──
app.get('/api/photos/:id', async (req, res) => {
  const r = await q('SELECT mime, data FROM photos WHERE id = $1', [Number(req.params.id)]);
  if (!r.rows.length) {
    res.status(404).end();
    return;
  }
  const { mime, data } = r.rows[0];
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(Buffer.isBuffer(data) ? data : Buffer.from(data));
});

// ── CSV export ──
app.get('/api/export.csv', async (req, res) => {
  const receipts = (await q(`
    SELECT r.id, j.number AS job_number, r.vendor, r.invoice_number, r.po, r.total,
           r.received_by, r.condition, r.location, r.status, r.created_at
    FROM receipts r JOIN jobs j ON j.id = r.job_id
    ORDER BY r.id DESC
  `)).rows;
  const items = (await q('SELECT * FROM line_items ORDER BY id')).rows;
  const byReceipt = new Map();
  for (const it of items) {
    if (!byReceipt.has(it.receipt_id)) byReceipt.set(it.receipt_id, []);
    byReceipt.get(it.receipt_id).push(it);
  }
  const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Job', 'Vendor', 'Invoice #', 'PO', 'Date', 'Received By', 'Condition',
    'Location', 'Status', 'Total', 'Part #', 'Description', 'Unit', 'Qty', 'Unit Price', 'Line Total']];
  for (const r of receipts) {
    for (const it of byReceipt.get(r.id) || []) {
      rows.push([r.job_number, r.vendor, r.invoice_number, r.po, String(r.created_at).slice(0, 10),
        r.received_by, r.condition, r.location, r.status, r.total,
        it.part_number, it.description, it.unit, it.qty, it.unit_price, it.line_total]);
    }
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="ssm-slips-${nowISO().slice(0, 10)}.csv"`);
  res.send(rows.map(r => r.map(csvCell).join(',')).join('\n'));
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, '..', 'public')));

const port = process.env.PORT || 3000;
try {
  await initDb();
} catch (err) {
  console.error('[startup] failed to initialize database:', err.message);
  process.exit(1);
}
app.listen(port, () => console.log(`SSM Tracker listening on http://localhost:${port}`));
