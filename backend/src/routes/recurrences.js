const express = require('express');
const router  = express.Router();
const { z }   = require('zod');
const { run, get, all } = require('../db/database');
const { auth } = require('./auth');
const { generatePixLink } = require('../services/pix');

const Schema = z.object({
  customer_id:  z.coerce.number().int().positive(),
  amount:       z.coerce.number().positive(),
  description:  z.string().max(500).optional(),
  day_of_month: z.coerce.number().int().min(1).max(28).default(1),
});

// GET /recurrences
router.get('/', auth, async (req, res) => {
  try {
    const rows = await all(`
      SELECT r.*, c.name AS customer_name, c.phone AS customer_phone
      FROM recurrences r JOIN customers c ON c.id = r.customer_id
      ORDER BY r.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar recorrências' });
  }
});

// POST /recurrences
router.post('/', auth, async (req, res) => {
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { customer_id, amount, description, day_of_month } = parsed.data;

  try {
    const customer = await get('SELECT id FROM customers WHERE id = ?', [customer_id]);
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });

    const result = await run(
      'INSERT INTO recurrences (customer_id, amount, description, day_of_month) VALUES (?, ?, ?, ?)',
      [customer_id, amount, description || null, day_of_month]
    );

    // Generate first payment immediately for current month
    await generateNextPayment(result.lastInsertRowid);

    const rec = await get(`
      SELECT r.*, c.name AS customer_name FROM recurrences r
      JOIN customers c ON c.id = r.customer_id WHERE r.id = ?
    `, [result.lastInsertRowid]);
    res.status(201).json(rec);
  } catch (err) {
    console.error('[POST /recurrences]', err);
    res.status(500).json({ error: 'Erro ao criar recorrência' });
  }
});

// PATCH /recurrences/:id/toggle
router.patch('/:id/toggle', auth, async (req, res) => {
  try {
    const rec = await get('SELECT * FROM recurrences WHERE id = ?', [req.params.id]);
    if (!rec) return res.status(404).json({ error: 'Recorrência não encontrada' });
    await run('UPDATE recurrences SET active = ? WHERE id = ?', [rec.active ? 0 : 1, rec.id]);
    res.json({ id: rec.id, active: !rec.active });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar recorrência' });
  }
});

// DELETE /recurrences/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await run('DELETE FROM recurrences WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Não encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao remover recorrência' });
  }
});

// Helper: generate next monthly payment for a recurrence
async function generateNextPayment(recurrenceId) {
  const rec = await get('SELECT * FROM recurrences WHERE id = ?', [recurrenceId]);
  if (!rec || !rec.active) return;

  const now = new Date();
  let year  = now.getFullYear();
  let month = now.getMonth() + 1;

  // If past day_of_month this month, generate for next month
  if (now.getDate() > rec.day_of_month) {
    month++;
    if (month > 12) { month = 1; year++; }
  }

  const dueDate = `${year}-${String(month).padStart(2,'0')}-${String(rec.day_of_month).padStart(2,'0')}`;

  // Check if payment for this month already exists
  const existing = await get(
    "SELECT id FROM payments WHERE recurrence_id = ? AND strftime('%Y-%m', due_date) = ?",
    [recurrenceId, `${year}-${String(month).padStart(2,'0')}`]
  );
  if (existing) return;

  const result = await run(
    'INSERT INTO payments (customer_id, amount, due_date, description, recurrence_id) VALUES (?, ?, ?, ?, ?)',
    [rec.customer_id, rec.amount, dueDate, rec.description || 'Cobrança recorrente', recurrenceId]
  );

  const customer = await get('SELECT * FROM customers WHERE id = ?', [rec.customer_id]);
  await generatePixLink(result.lastInsertRowid, rec.amount, customer, { ...rec, id: result.lastInsertRowid, due_date: dueDate });
  console.log(`[Recurrence] Payment gerado para recurrence ${recurrenceId}: ${dueDate}`);
}

module.exports = { router, generateNextPayment };
