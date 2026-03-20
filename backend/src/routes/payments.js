const express = require('express');
const router  = express.Router();
const { z }   = require('zod');
const { run, get, all } = require('../db/database');
const { generatePixLink } = require('../services/pix');
const { auth } = require('./auth');

const CreatePaymentSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  amount:      z.coerce.number().positive(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional(),
});

const VALID = ['pending','paid','overdue','cancelled'];

router.get('/', auth, async (req, res) => {
  try {
    const { status, customer_id, from, to, search } = req.query;
    if (status && !VALID.includes(status)) return res.status(400).json({ error: 'status inválido' });
    let sql = `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, pl.url AS pix_url
      FROM payments p JOIN customers c ON c.id=p.customer_id
      LEFT JOIN pix_links pl ON pl.payment_id=p.id WHERE 1=1`;
    const params = [];
    if (status)      { sql += ' AND p.status=?'; params.push(status); }
    if (customer_id) { sql += ' AND p.customer_id=?'; params.push(customer_id); }
    if (from)        { sql += ' AND p.due_date>=?'; params.push(from); }
    if (to)          { sql += ' AND p.due_date<=?'; params.push(to); }
    if (search)      { sql += ' AND (c.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY p.due_date ASC';
    res.json(await all(sql, params));
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar cobranças' }); }
});

router.post('/', auth, async (req, res) => {
  const parsed = CreatePaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { customer_id, amount, due_date, description } = parsed.data;
  try {
    const customer = await get('SELECT * FROM customers WHERE id=?',[customer_id]);
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });
    const { lastInsertRowid: pid } = await run(
      'INSERT INTO payments (customer_id, amount, due_date, description) VALUES (?,?,?,?)',
      [customer_id, amount, due_date, description?.trim()||null]
    );
    await generatePixLink(pid, amount, customer, { id:pid, amount, due_date, description });
    const payment = await get('SELECT p.*, pl.url AS pix_url FROM payments p LEFT JOIN pix_links pl ON pl.payment_id=p.id WHERE p.id=?',[pid]);
    res.status(201).json(payment);
  } catch (err) { res.status(500).json({ error: 'Erro ao criar cobrança' }); }
});

router.patch('/:id/status', auth, async (req, res) => {
  const { status } = req.body;
  if (!VALID.includes(status)) return res.status(400).json({ error: 'status inválido' });
  try {
    const paidAt = status==='paid' ? new Date().toISOString() : null;
    const result = await run('UPDATE payments SET status=?, paid_at=? WHERE id=?',[status, paidAt, req.params.id]);
    if (result.changes===0) return res.status(404).json({ error: 'Cobrança não encontrada' });
    res.json(await get('SELECT * FROM payments WHERE id=?',[req.params.id]));
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar status' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await run('DELETE FROM payments WHERE id=?',[req.params.id]);
    if (result.changes===0) return res.status(404).json({ error: 'Não encontrada' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao remover' }); }
});

module.exports = router;
