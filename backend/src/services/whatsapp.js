/**
 * WhatsApp Service
 * 
 * Supports two providers:
 *   - Z-API (Brazilian, most popular for WhatsApp business)
 *     Setup: create account at z-api.io → get Instance ID + Token → set in .env
 *     Free trial: 5 days, then ~R$50/month
 * 
 *   - Twilio WhatsApp API (international)
 *     Setup: create account at twilio.com → get Account SID + Auth Token → set in .env
 *     Pricing: ~$0.005 per message
 * 
 * When neither is configured, logs to console (mock mode).
 */

const { run } = require('../db/database');

const MESSAGE_TYPES = {
  REMINDER_BEFORE: 'reminder_before',
  DUE_TODAY:       'due_today',
  OVERDUE:         'overdue',
};

// ── Provider detection ────────────────────────────────────────────────────────
function getProvider() {
  if (process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN &&
      process.env.ZAPI_INSTANCE_ID !== 'your_zapi_instance_id') {
    return 'zapi';
  }
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_ACCOUNT_SID !== 'your_twilio_account_sid') {
    return 'twilio';
  }
  return 'mock';
}

// ── Z-API sender ──────────────────────────────────────────────────────────────
async function sendViaZapi(phone, message) {
  // Normalize phone to E.164 format (+55XXXXXXXXXXX)
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;

  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': process.env.ZAPI_CLIENT_TOKEN || '' },
    body: JSON.stringify({ phone: normalized, message }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Z-API error: ${err}`);
  }
  return response.json();
}

// ── Twilio sender ─────────────────────────────────────────────────────────────
async function sendViaTwilio(phone, message) {
  const digits = phone.replace(/\D/g, '');
  const normalized = `+55${digits.startsWith('55') ? digits.slice(2) : digits}`;

  const { Twilio } = require('twilio');
  const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
    to: `whatsapp:${normalized}`,
    body: message,
  });
}

// ── Main send function ────────────────────────────────────────────────────────
async function sendMessage(phone, message, paymentId, type) {
  const provider = getProvider();

  if (provider === 'mock') {
    console.log('\n📱 [WhatsApp Mock] ─────────────────────────────');
    console.log(`   Para : ${phone}`);
    console.log(`   Tipo : ${type}`);
    console.log(`   Msg  :\n${message}`);
    console.log('─────────────────────────────────────────────────\n');
  } else if (provider === 'zapi') {
    await sendViaZapi(phone, message);
    console.log(`[WhatsApp Z-API] Enviado para ${phone}`);
  } else if (provider === 'twilio') {
    await sendViaTwilio(phone, message);
    console.log(`[WhatsApp Twilio] Enviado para ${phone}`);
  }

  await run(
    'INSERT INTO message_logs (payment_id, type, status, message_body) VALUES (?, ?, ?, ?)',
    [paymentId, type, provider === 'mock' ? 'mock' : 'sent', message]
  );

  return { success: true, provider };
}

// ── Static template (fallback when AI is not configured) ─────────────────────
function buildMessage(type, customer, payment, pixUrl) {
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount);
  const [y, m, d] = payment.due_date.split('-');
  const due = `${d}/${m}/${y}`;

  const templates = {
    [MESSAGE_TYPES.REMINDER_BEFORE]: `Olá ${customer.name}! 👋\n\nLembrete: você tem um pagamento de *${amount}* vencendo em *${due}*.\n\nPague com Pix agora: ${pixUrl}`,
    [MESSAGE_TYPES.DUE_TODAY]:       `Olá ${customer.name}! 📅\n\nSeu pagamento de *${amount}* vence *hoje*.\n\nEvite atrasos: ${pixUrl}`,
    [MESSAGE_TYPES.OVERDUE]:         `Olá ${customer.name}! ⚠️\n\nSeu pagamento de *${amount}* (vencimento ${due}) está em aberto.\n\nRegularize: ${pixUrl}`,
  };

  return templates[type] || '';
}

module.exports = { sendMessage, buildMessage, MESSAGE_TYPES, getProvider };
