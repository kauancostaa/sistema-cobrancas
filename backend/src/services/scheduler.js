/**
 * Scheduler — runs every hour
 * 
 * When ANTHROPIC_API_KEY is set: uses AI to generate personalized messages
 * Otherwise: falls back to static templates
 */
const cron = require('node-cron');
const { run, get, all } = require('../db/database');
const { sendMessage, buildMessage, MESSAGE_TYPES } = require('./whatsapp');
const { sendEmail } = require('./email');
const { generatePixLink, getPixLink } = require('./pix');

let aiService = null;
function getAI() {
  if (!aiService) {
    try { aiService = require('./ai'); } catch { aiService = null; }
  }
  return aiService;
}

function todayStr()       { return new Date().toISOString().split('T')[0]; }
function dateOffset(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

async function alreadySentToday(paymentId, type) {
  const row = await get(
    `SELECT id FROM message_logs WHERE payment_id = ? AND type = ? AND date(sent_at) = date('now')`,
    [paymentId, type]
  );
  return !!row;
}

async function buildSmartMessage(type, customer, payment, pixUrl) {
  const ai = getAI();
  const hasAI = ai && process.env.ANTHROPIC_API_KEY &&
                process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here';

  if (hasAI) {
    try {
      const msg = await ai.generateCollectionMessage(customer, payment, pixUrl);
      console.log(`[Scheduler] Mensagem IA gerada para ${customer.name}`);
      return msg;
    } catch (err) {
      console.warn('[Scheduler] IA indisponível, usando template:', err.message);
    }
  }

  return buildMessage(type, customer, payment, pixUrl);
}

async function runScheduler() {
  const today   = todayStr();
  const in2days = dateOffset(2);
  console.log(`[Scheduler] Iniciando em ${new Date().toLocaleString('pt-BR')}`);

  try {
    // Auto-update overdue
    const updated = await run(
      `UPDATE payments SET status='overdue' WHERE status='pending' AND due_date < ?`, [today]
    );
    if (updated.changes > 0)
      console.log(`[Scheduler] ${updated.changes} cobrança(s) → overdue`);

    // Pending payments
    const pending = await all(`
      SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
             c.id AS cid
      FROM payments p JOIN customers c ON c.id = p.customer_id
      WHERE p.status = 'pending'
    `);

    for (const payment of pending) {
      try {
        const customer = {
          id: payment.cid, name: payment.customer_name,
          phone: payment.customer_phone, email: payment.customer_email,
        };
        const pixUrl = (await getPixLink(payment.id)) ||
                       (await generatePixLink(payment.id, payment.amount, customer, payment));

        // Reminder 2 days before
        if (payment.due_date === in2days &&
            !(await alreadySentToday(payment.id, MESSAGE_TYPES.REMINDER_BEFORE))) {
          const msg = await buildSmartMessage(MESSAGE_TYPES.REMINDER_BEFORE, customer, payment, pixUrl);
          await sendMessage(customer.phone, msg, payment.id, MESSAGE_TYPES.REMINDER_BEFORE);
          if (customer.email)
            await sendEmail({ to: customer.email, customerName: customer.name,
              amount: formatCurrency(payment.amount), dueDate: formatDate(payment.due_date),
              pixUrl, message: msg, paymentId: payment.id, type: MESSAGE_TYPES.REMINDER_BEFORE });
        }

        // Due today
        if (payment.due_date === today &&
            !(await alreadySentToday(payment.id, MESSAGE_TYPES.DUE_TODAY))) {
          const msg = await buildSmartMessage(MESSAGE_TYPES.DUE_TODAY, customer, payment, pixUrl);
          await sendMessage(customer.phone, msg, payment.id, MESSAGE_TYPES.DUE_TODAY);
          if (customer.email)
            await sendEmail({ to: customer.email, customerName: customer.name,
              amount: formatCurrency(payment.amount), dueDate: formatDate(payment.due_date),
              pixUrl, message: msg, paymentId: payment.id, type: MESSAGE_TYPES.DUE_TODAY });
        }
      } catch (err) {
        console.error(`[Scheduler] Erro payment ${payment.id}:`, err.message);
      }
    }

    // Overdue payments
    const overdue = await all(`
      SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
             c.id AS cid
      FROM payments p JOIN customers c ON c.id = p.customer_id
      WHERE p.status = 'overdue'
    `);

    for (const payment of overdue) {
      try {
        if (await alreadySentToday(payment.id, MESSAGE_TYPES.OVERDUE)) continue;
        const customer = {
          id: payment.cid, name: payment.customer_name,
          phone: payment.customer_phone, email: payment.customer_email,
        };
        const pixUrl = (await getPixLink(payment.id)) ||
                       (await generatePixLink(payment.id, payment.amount, customer, payment));
        const msg = await buildSmartMessage(MESSAGE_TYPES.OVERDUE, customer, payment, pixUrl);
        await sendMessage(customer.phone, msg, payment.id, MESSAGE_TYPES.OVERDUE);
        if (customer.email)
          await sendEmail({ to: customer.email, customerName: customer.name,
            amount: formatCurrency(payment.amount), dueDate: formatDate(payment.due_date),
            pixUrl, message: msg, paymentId: payment.id, type: MESSAGE_TYPES.OVERDUE });
      } catch (err) {
        console.error(`[Scheduler] Erro overdue payment ${payment.id}:`, err.message);
      }
    }

    console.log(`[Scheduler] Concluído — ${pending.length} pendente(s), ${overdue.length} vencido(s)`);
  } catch (err) {
    console.error('[Scheduler] Erro geral:', err.message);
  }
}

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function formatDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function startScheduler() {
  cron.schedule('0 * * * *', runScheduler);
  console.log('[Scheduler] Iniciado — executa a cada hora');
  setTimeout(() => runScheduler().catch(console.error), 3000);
}

module.exports = { startScheduler, runScheduler };

// Called once a day at midnight to generate monthly payments from recurrences
async function generateRecurrencePayments() {
  try {
    const { generateNextPayment } = require('../routes/recurrences');
    const recs = await require('../db/database').all('SELECT id FROM recurrences WHERE active=1');
    for (const r of recs) {
      await generateNextPayment(r.id).catch(e => console.error(`[Recurrence] ${r.id}:`, e.message));
    }
    console.log(`[Recurrence] ${recs.length} recorrência(s) verificadas`);
  } catch (err) {
    console.error('[Recurrence] Erro:', err.message);
  }
}

// Run recurrence generation daily at 6am
const cron2 = require('node-cron');
cron2.schedule('0 6 * * *', generateRecurrencePayments);
