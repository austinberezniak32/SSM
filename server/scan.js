// AI packing-slip scanning. The API key lives only on the server (env var) —
// phones never see it. Defaults to Claude Sonnet 4.6 — slips are often faint
// thermal/thin-paper prints and the stronger vision model reads them far more
// reliably (~2¢/scan). Set SCAN_MODEL=claude-haiku-4-5 to trade accuracy for
// ~0.7¢/scan. Structured-output schema keeps the response valid JSON either way.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.SCAN_MODEL || 'claude-sonnet-4-6';

const SLIP_SCHEMA = {
  type: 'object',
  properties: {
    vendor: { type: 'string', description: 'Supplier/vendor company name' },
    invoiceNumber: { type: 'string', description: 'Invoice, packing slip, or order number' },
    invoiceDate: { type: 'string', description: 'Document date as YYYY-MM-DD, empty string if not shown' },
    customerPO: { type: 'string', description: 'Customer purchase order number, e.g. H01460-193' },
    project: { type: 'string', description: 'Project or job name if printed on the slip' },
    total: { type: 'number', description: 'Document total in dollars, 0 if not shown' },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          partNumber: { type: 'string' },
          description: { type: 'string' },
          unit: { type: 'string', description: 'Unit of measure: EA, FT, RL, BX, etc.' },
          qty: { type: 'number', description: 'Quantity shipped/received (not ordered or backordered)' },
          unitPrice: { type: 'number' },
          lineTotal: { type: 'number' }
        },
        required: ['partNumber', 'description', 'unit', 'qty', 'unitPrice', 'lineTotal'],
        additionalProperties: false
      }
    }
  },
  required: ['vendor', 'invoiceNumber', 'invoiceDate', 'customerPO', 'project', 'total', 'lineItems'],
  additionalProperties: false
};

const PROMPT = `Read this construction packing slip / invoice photo carefully and extract its data.

The photo may be low quality: faint or light-gray lettering on thin paper, low contrast, wrinkles, or shadows. Read carefully and use surrounding context (column headers, alignment, units) to recover characters that are hard to make out.

Rules:
- For qty, use the SHIPPED or RECEIVED quantity column, not ordered or backordered.
- customerPO is the customer's purchase order number (often labeled "PO", "Cust PO", "Customer PO", or "Job"). Formats like H01460-193 are common.
- If prices aren't printed, use 0 for unitPrice/lineTotal/total.
- Include every line item on the slip.
- Use empty strings for fields that are not present.`;

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

export function scanConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * @param {string} base64 image data (no data: prefix)
 * @param {string} mediaType e.g. image/jpeg
 * @returns parsed slip object matching SLIP_SCHEMA
 */
export async function scanSlip(base64, mediaType) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    output_config: { format: { type: 'json_schema', schema: SLIP_SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: PROMPT }
      ]
    }]
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The scanner declined to read this image.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Slip too long to read in one pass — try a tighter photo.');
  }
  const text = response.content.find(b => b.type === 'text')?.text ?? '';
  return JSON.parse(text);
}
