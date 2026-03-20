const express   = require('express');
const router    = express.Router();
const { get, all } = require('../db/database');
const { auth } = require('./auth');

function getAI() {
  try { return require('../services/ai'); } catch { return null; }
}

function isAIEnabled() {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!(key && key !== 'your_anthropic_api_key_here');
}

// GET /ai/status — check if AI is configured
router.get("/status", auth, (req, res) => {
  const whatsappProvider = require('../services/whatsapp').getProvider();
  const emailProvider    = require('../services/email').getProvider();
  const pixProvider      = require('../services/pix').getProvider();

  res.json({
    ai:        { enabled: isAIEnabled(), provider: isAIEnabled() ? 'claude' : 'disabled' },
    whatsapp:  { enabled: whatsappProvider !== 'mock', provider: whatsappProvider },
    email:     { enabled: emailProvider !== 'mock',    provider: emailProvider },
    pix:       { enabled: pixProvider !== 'mock',      provider: pixProvider },
  });
});

// GET /ai/risk — risk analysis of all customers and payments
router.get('/risk', auth, async (req, res) => {
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada. Adicione no arquivo .env.' });
  }

  try {
    const ai = getAI();
    const customers = await all(`
      SELECT c.*, COUNT(p.id) AS total_payments,
        COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END), 0) AS paid_amount
      FROM customers c LEFT JOIN payments p ON p.customer_id = c.id
      GROUP BY c.id
    `);
    const payments = await all('SELECT * FROM payments');

    const analysis = await ai.analyzeRisk(customers, payments);
    res.json(analysis);
  } catch (err) {
    console.error('[GET /ai/risk]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/chat — natural language query
router.post('/chat', auth, async (req, res) => {
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada. Adicione no arquivo .env.' });
  }

  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message é obrigatório' });
  }

  try {
    const ai = getAI();
    const today = new Date().toISOString().split('T')[0];

    const [customers, payments, summaryRow] = await Promise.all([
      all(`SELECT c.*, COUNT(p.id) AS total_payments,
        COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END), 0) AS paid_amount
        FROM customers c LEFT JOIN payments p ON p.customer_id = c.id GROUP BY c.id`),
      all(`SELECT p.*, c.name AS customer_name FROM payments p JOIN customers c ON c.id=p.customer_id ORDER BY p.due_date DESC LIMIT 50`),
      get(`SELECT
        COALESCE(SUM(CASE WHEN status!='cancelled' THEN amount ELSE 0 END), 0) AS total_to_receive,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END), 0) AS total_received,
        COALESCE(SUM(CASE WHEN status='pending' AND due_date < ? THEN amount ELSE 0 END), 0) AS total_overdue,
        COALESCE(SUM(CASE WHEN status='pending' AND due_date >= ? THEN amount ELSE 0 END), 0) AS total_pending
        FROM payments`, [today, today]),
    ]);

    const reply = await ai.chat(message.trim(), { customers, payments, summary: summaryRow });
    res.json({ reply });
  } catch (err) {
    console.error('[POST /ai/chat]', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /ai/message/:paymentId — generate AI message for specific payment
router.post('/message/:paymentId', auth, async (req, res) => {
  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY não configurada.' });
  }

  try {
    const ai = getAI();
    const payment = await get('SELECT p.*, c.name, c.phone, c.email FROM payments p JOIN customers c ON c.id=p.customer_id WHERE p.id=?', [req.params.paymentId]);
    if (!payment) return res.status(404).json({ error: 'Cobrança não encontrada' });

    const pixRow = await get('SELECT url FROM pix_links WHERE payment_id=?', [payment.id]);
    const pixUrl = pixRow?.url || `${process.env.BASE_URL || 'http://localhost:3001'}/pix/demo`;

    const customer = { name: payment.name, phone: payment.phone };
    const msg = await ai.generateCollectionMessage(customer, payment, pixUrl);
    res.json({ message: msg });
  } catch (err) {
    console.error('[POST /ai/message]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
