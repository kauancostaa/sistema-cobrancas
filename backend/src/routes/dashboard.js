const express   = require('express');
const router    = express.Router();
const { get, all } = require('../db/database');
const { auth } = require('./auth');

router.get('/', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const summary = await get(`
      SELECT COUNT(*) AS total_payments,
        COALESCE(SUM(CASE WHEN status!='cancelled' THEN amount ELSE 0 END),0) AS total_to_receive,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS total_received,
        COALESCE(SUM(CASE WHEN status='pending' AND due_date<? THEN amount ELSE 0 END),0) AS total_overdue,
        COALESCE(SUM(CASE WHEN status='pending' AND due_date>=? THEN amount ELSE 0 END),0) AS total_pending,
        COUNT(CASE WHEN status='paid' THEN 1 END) AS count_paid,
        COUNT(CASE WHEN status='pending' AND due_date<? THEN 1 END) AS count_overdue,
        COUNT(CASE WHEN status='pending' AND due_date>=? THEN 1 END) AS count_pending
      FROM payments
    `,[today,today,today,today]);
    const recent_messages = await all(`
      SELECT ml.*, p.amount, c.name AS customer_name, c.phone FROM message_logs ml
      JOIN payments p ON p.id=ml.payment_id JOIN customers c ON c.id=p.customer_id
      ORDER BY ml.sent_at DESC LIMIT 10`);
    const upcoming = await all(`
      SELECT p.*, c.name AS customer_name, c.phone, pl.url AS pix_url FROM payments p
      JOIN customers c ON c.id=p.customer_id LEFT JOIN pix_links pl ON pl.payment_id=p.id
      WHERE p.status='pending' AND p.due_date BETWEEN ? AND date(?,' +7 days')
      ORDER BY p.due_date ASC`,[today,today]);
    const byMonth = await all(`
      SELECT strftime('%Y-%m', due_date) AS month,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS received,
        COALESCE(SUM(CASE WHEN status IN('pending','overdue') THEN amount ELSE 0 END),0) AS pending
      FROM payments WHERE due_date >= date('now','-6 months')
      GROUP BY month ORDER BY month ASC`);
    res.json({ summary, recent_messages, upcoming, byMonth });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar dashboard' }); }
});

router.get('/messages', auth, async (req, res) => {
  try {
    const messages = await all(`
      SELECT ml.*, c.name AS customer_name, c.phone, p.amount, p.due_date FROM message_logs ml
      JOIN payments p ON p.id=ml.payment_id JOIN customers c ON c.id=p.customer_id
      ORDER BY ml.sent_at DESC LIMIT 100`);
    res.json(messages);
  } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

module.exports = router;
