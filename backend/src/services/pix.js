/**
 * Pix Service
 * 
 * Supports:
 *   - Asaas (Brazilian fintech — recommended)
 *     Setup: create account at asaas.com → get API key → set ASAAS_API_KEY in .env
 *     Sandbox: use key starting with "$aact_YTU5YTE0M..." from sandbox.asaas.com
 *     Fee: ~1-2% per transaction, no monthly fee
 * 
 *   - Mock (default): generates local link, no real payment
 */

const { v4: uuidv4 } = require('uuid');
const { run, get }   = require('../db/database');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ── Provider detection ────────────────────────────────────────────────────────
function getProvider() {
  const key = process.env.ASAAS_API_KEY;
  if (key && key !== 'your_asaas_api_key_here') return 'asaas';
  return 'mock';
}

const ASAAS_BASE = process.env.ASAAS_SANDBOX === 'true'
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3';

// ── Asaas: create/find customer ───────────────────────────────────────────────
async function getOrCreateAsaasCustomer(customer) {
  const headers = {
    'Content-Type': 'application/json',
    'access_token': process.env.ASAAS_API_KEY,
  };

  // Search by name
  const search = await fetch(`${ASAAS_BASE}/customers?name=${encodeURIComponent(customer.name)}&limit=1`, { headers });
  const { data } = await search.json();

  if (data && data.length > 0) return data[0].id;

  // Create new
  const digits = customer.phone.replace(/\D/g, '');
  const create = await fetch(`${ASAAS_BASE}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: customer.name,
      email: customer.email || undefined,
      mobilePhone: digits,
      notificationDisabled: false,
    }),
  });

  const created = await create.json();
  if (!created.id) throw new Error(`Asaas customer error: ${JSON.stringify(created)}`);
  return created.id;
}

// ── Asaas: create Pix charge ──────────────────────────────────────────────────
async function createAsaasCharge(asaasCustomerId, payment) {
  const headers = {
    'Content-Type': 'application/json',
    'access_token': process.env.ASAAS_API_KEY,
  };

  const body = {
    customer: asaasCustomerId,
    billingType: 'PIX',
    value: payment.amount,
    dueDate: payment.due_date,
    description: payment.description || 'Cobrança',
    externalReference: String(payment.id),
  };

  const res = await fetch(`${ASAAS_BASE}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const charge = await res.json();
  if (!charge.id) throw new Error(`Asaas charge error: ${JSON.stringify(charge)}`);

  // Get Pix QR Code
  const qrRes = await fetch(`${ASAAS_BASE}/payments/${charge.id}/pixQrCode`, { headers });
  const qr    = await qrRes.json();

  return {
    chargeId: charge.id,
    invoiceUrl: charge.invoiceUrl,
    pixCopyPaste: qr.payload || null,
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ── Main generate function ────────────────────────────────────────────────────
async function generatePixLink(paymentId, amount, customerData, paymentData) {
  const provider = getProvider();
  const token    = uuidv4();
  let url        = `${BASE_URL}/pix/${token}`;
  let expiresAt  = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  let asaasChargeId = null;
  let pixCopyPaste  = null;

  if (provider === 'asaas' && customerData && paymentData) {
    try {
      const asaasCustomerId = await getOrCreateAsaasCustomer(customerData);
      const charge = await createAsaasCharge(asaasCustomerId, paymentData);
      url           = charge.invoiceUrl;
      expiresAt     = charge.expiresAt;
      asaasChargeId = charge.chargeId;
      pixCopyPaste  = charge.pixCopyPaste;
      console.log(`[Pix Asaas] Cobrança criada: ${charge.chargeId}`);
    } catch (err) {
      console.error('[Pix Asaas] Erro, usando mock:', err.message);
      url = `${BASE_URL}/pix/${token}`;
    }
  }

  const existing = await get('SELECT id FROM pix_links WHERE payment_id = ?', [paymentId]);
  if (existing) {
    await run('UPDATE pix_links SET token=?, url=?, expires_at=?, asaas_charge_id=?, pix_copy_paste=? WHERE payment_id=?',
      [token, url, expiresAt, asaasChargeId, pixCopyPaste, paymentId]);
  } else {
    await run('INSERT INTO pix_links (payment_id, token, url, expires_at, asaas_charge_id, pix_copy_paste) VALUES (?,?,?,?,?,?)',
      [paymentId, token, url, expiresAt, asaasChargeId, pixCopyPaste]);
  }

  return url;
}

async function getPixLink(paymentId) {
  const row = await get('SELECT url, expires_at FROM pix_links WHERE payment_id = ?', [paymentId]);
  if (!row) return null;
  if (row.expires_at && row.expires_at < new Date().toISOString()) return null;
  return row.url;
}

module.exports = { generatePixLink, getPixLink, getProvider };
