/**
 * Email Service
 * 
 * Supports two providers:
 *   - Resend (recommended, free tier: 3.000 emails/mês)
 *     Setup: create account at resend.com → get API key → set RESEND_API_KEY in .env
 * 
 *   - SMTP (Gmail, Outlook, or any SMTP server)
 *     Setup: set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS in .env
 * 
 * When neither is configured, logs to console (mock mode).
 */

const nodemailer = require('nodemailer');
const { run } = require('../db/database');

// ── Provider detection ────────────────────────────────────────────────────────
function getProvider() {
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here') {
    return 'resend';
  }
  if (process.env.EMAIL_HOST && process.env.EMAIL_USER) {
    return 'smtp';
  }
  return 'mock';
}

// ── Resend sender ─────────────────────────────────────────────────────────────
async function sendViaResend(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'cobranças@resend.dev',
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
  return response.json();
}

// ── SMTP sender ───────────────────────────────────────────────────────────────
async function sendViaSmtp(to, subject, html) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
}

// ── Email template ────────────────────────────────────────────────────────────
function buildEmailHtml({ customerName, amount, dueDate, pixUrl, message, companyName }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cobrança</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
  .card { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  .header { background: #00C896; padding: 28px 32px; }
  .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 600; }
  .header p { color: rgba(255,255,255,.8); margin: 4px 0 0; font-size: 14px; }
  .body { padding: 28px 32px; }
  .amount-box { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px 20px; margin: 20px 0; text-align: center; }
  .amount { font-size: 32px; font-weight: 700; color: #16a34a; }
  .due { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .message-box { background: #f9fafb; border-left: 3px solid #00C896; padding: 14px 16px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-line; }
  .pix-btn { display: block; background: #00C896; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px 0 0; }
  .footer { padding: 16px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
</style>
</head>
<body>
<div class="card">
  <div class="header">
    <h1>${companyName || 'Sistema de Cobranças'}</h1>
    <p>Notificação de pagamento</p>
  </div>
  <div class="body">
    <p style="color:#374151;font-size:15px">Olá, <strong>${customerName}</strong></p>
    <div class="amount-box">
      <div class="amount">${amount}</div>
      <div class="due">Vencimento: ${dueDate}</div>
    </div>
    <div class="message-box">${message}</div>
    <a href="${pixUrl}" class="pix-btn">💳 Pagar agora via Pix</a>
  </div>
  <div class="footer">
    Este é um email automático. Em caso de dúvidas, entre em contato conosco.
  </div>
</div>
</body>
</html>`;
}

// ── Main send function ────────────────────────────────────────────────────────
async function sendEmail({ to, customerName, amount, dueDate, pixUrl, message, paymentId, type }) {
  const provider = getProvider();
  const companyName = process.env.COMPANY_NAME || 'Cobranças';
  const subject = `[${companyName}] Cobrança de ${amount} — vencimento ${dueDate}`;

  const html = buildEmailHtml({
    customerName, amount, dueDate, pixUrl, message, companyName,
  });

  if (provider === 'mock') {
    console.log('\n📧 [Email Mock] ─────────────────────────────');
    console.log(`   Para   : ${to}`);
    console.log(`   Assunto: ${subject}`);
    console.log(`   Corpo  : ${message}`);
    console.log('─────────────────────────────────────────────\n');
  } else if (provider === 'resend') {
    await sendViaResend(to, subject, html);
    console.log(`[Email] Enviado via Resend para ${to}`);
  } else {
    await sendViaSmtp(to, subject, html);
    console.log(`[Email] Enviado via SMTP para ${to}`);
  }

  // Log to DB
  if (paymentId && type) {
    await run(
      'INSERT INTO message_logs (payment_id, type, status, message_body) VALUES (?, ?, ?, ?)',
      [paymentId, type, provider === 'mock' ? 'mock' : 'sent', `[EMAIL] ${message}`]
    );
  }

  return { success: true, provider };
}

module.exports = { sendEmail, getProvider };
