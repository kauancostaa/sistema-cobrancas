const express = require('express');
const router  = express.Router();
const { z }   = require('zod');
const { run, get, all, transaction } = require('../db/database');
const { generatePixLink } = require('../services/pix');
const { auth } = require('./auth');

const CreateCustomerSchema = z.object({
  name:        z.string().min(1).max(200),
  phone:       z.string().min(1).max(50),
  email:       z.string().email().max(200).optional().or(z.literal('')),
  document:    z.string().max(20).optional(),
  notes:       z.string().max(1000).optional(),
  amount:      z.coerce.number().positive().optional(),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(500).optional(),
});

router.get('/', auth, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = `SELECT c.*,
      COUNT(p.id) AS total_payments,
      COALESCE(SUM(p.amount),0) AS total_amount,
      COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS paid_amount,
      COALESCE(SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END),0) AS overdue_amount
      FROM customers c LEFT JOIN payments p ON p.customer_id = c.id`;
    const params = [];
    if (search) { sql += ' WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    sql += ' GROUP BY c.id ORDER BY c.created_at DESC';
    res.json(await all(sql, params));
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar clientes' }); }
});

router.post('/', auth, async (req, res) => {
  const parsed = CreateCustomerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { name, phone, email, document, notes, amount, due_date, description } = parsed.data;
  try {
    const customer = await transaction(async () => {
      const { lastInsertRowid: cid } = await run(
        'INSERT INTO customers (name, phone, email, document, notes) VALUES (?,?,?,?,?)',
        [name.trim(), phone.trim(), email?.trim()||null, document?.trim()||null, notes?.trim()||null]
      );
      if (amount && due_date) {
        const { lastInsertRowid: pid } = await run(
          'INSERT INTO payments (customer_id, amount, due_date, description) VALUES (?,?,?,?)',
          [cid, amount, due_date, description?.trim()||null]
        );
        const c = await get('SELECT * FROM customers WHERE id=?',[cid]);
        await generatePixLink(pid, amount, c, { id:pid, amount, due_date, description });
      }
      return get('SELECT * FROM customers WHERE id=?',[cid]);
    });
    res.status(201).json(customer);
  } catch (err) { res.status(500).json({ error: 'Erro ao criar cliente' }); }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await get('SELECT * FROM customers WHERE id=?',[req.params.id]);
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });
    const payments = await all(
      'SELECT p.*, pl.url AS pix_url FROM payments p LEFT JOIN pix_links pl ON pl.payment_id=p.id WHERE p.customer_id=? ORDER BY p.due_date ASC',
      [req.params.id]
    );
    res.json({ ...customer, payments });
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar cliente' }); }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, phone, email, document, notes } = req.body;
    await run('UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), email=COALESCE(?,email), document=COALESCE(?,document), notes=COALESCE(?,notes) WHERE id=?',
      [name||null, phone||null, email||null, document||null, notes||null, req.params.id]);
    res.json(await get('SELECT * FROM customers WHERE id=?',[req.params.id]));
  } catch (err) { res.status(500).json({ error: 'Erro ao atualizar cliente' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await run('DELETE FROM customers WHERE id=?',[req.params.id]);
    if (result.changes===0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erro ao remover cliente' }); }
});

// POST /customers/import — bulk import from CSV data array
router.post('/import', auth, async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'rows[] obrigatório' });
  let created = 0, errors = [];
  for (const [i, row] of rows.entries()) {
    try {
      if (!row.name || !row.phone) { errors.push(`Linha ${i+2}: nome e telefone obrigatórios`); continue; }
      await run('INSERT INTO customers (name, phone, email, document, notes) VALUES (?,?,?,?,?)',
        [row.name.trim(), row.phone.trim(), row.email||null, row.document||null, row.notes||null]);
      created++;
    } catch (err) { errors.push(`Linha ${i+2}: ${err.message}`); }
  }
  res.json({ created, errors });
});

module.exports = router;
