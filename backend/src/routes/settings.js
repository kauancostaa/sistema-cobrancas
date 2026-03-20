const express = require('express');
const router  = express.Router();
const { get, run, all } = require('../db/database');
const { auth } = require('./auth');

// GET /settings
router.get('/', auth, async (req, res) => {
  try {
    const rows = await all('SELECT key, value FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// PATCH /settings
router.patch('/', auth, async (req, res) => {
  try {
    const allowed = ['company_name', 'pix_key', 'company_email', 'company_phone', 'overdue_days_to_notify'];
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue;
      await run(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
        [key, String(value)]
      );
    }
    const rows = await all('SELECT key, value FROM settings');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

module.exports = router;
