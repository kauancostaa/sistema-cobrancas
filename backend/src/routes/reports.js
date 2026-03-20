const express = require('express');
const router  = express.Router();
const { get, all } = require('../db/database');
const { auth } = require('./auth');

function formatCurrency(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function formatDate(s) {
  if (!s) return '';
  const d = s.replace(' ','T').split('T')[0];
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function statusLabel(s) {
  return { pending:'Pendente', paid:'Pago', overdue:'Vencido', cancelled:'Cancelado' }[s] || s;
}

// GET /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/summary', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const where  = from && to ? 'WHERE p.due_date BETWEEN ? AND ?' : '';
    const params = from && to ? [from, to] : [];

    const summary = await get(`
      SELECT
        COUNT(*) AS total_payments,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS total_received,
        COALESCE(SUM(CASE WHEN status='pending' OR status='overdue' THEN amount ELSE 0 END),0) AS total_pending,
        COALESCE(SUM(CASE WHEN status='overdue' THEN amount ELSE 0 END),0) AS total_overdue,
        COUNT(CASE WHEN status='paid' THEN 1 END) AS count_paid,
        COUNT(CASE WHEN status='overdue' THEN 1 END) AS count_overdue
      FROM payments p ${where}
    `, params);

    const byMonth = await all(`
      SELECT strftime('%Y-%m', due_date) AS month,
        COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) AS received,
        COALESCE(SUM(CASE WHEN status='pending' OR status='overdue' THEN amount ELSE 0 END),0) AS pending,
        COUNT(*) AS total
      FROM payments p ${where}
      GROUP BY month ORDER BY month ASC
    `, params);

    const topCustomers = await all(`
      SELECT c.name, c.phone,
        COALESCE(SUM(CASE WHEN p.status='paid' THEN p.amount ELSE 0 END),0) AS paid,
        COALESCE(SUM(CASE WHEN p.status='overdue' THEN p.amount ELSE 0 END),0) AS overdue,
        COUNT(p.id) AS total_payments
      FROM customers c LEFT JOIN payments p ON p.customer_id = c.id ${where ? 'AND p.due_date BETWEEN ? AND ?' : ''}
      GROUP BY c.id ORDER BY overdue DESC LIMIT 10
    `, from && to ? [from, to] : []);

    res.json({ summary, byMonth, topCustomers });
  } catch (err) {
    console.error('[GET /reports/summary]', err);
    res.status(500).json({ error: 'Erro ao gerar relatório' });
  }
});

// GET /reports/export/csv?from=&to=&status=
router.get('/export/csv', auth, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from) { where += ' AND p.due_date >= ?'; params.push(from); }
    if (to)   { where += ' AND p.due_date <= ?'; params.push(to); }
    if (status && status !== 'all') { where += ' AND p.status = ?'; params.push(status); }

    const rows = await all(`
      SELECT c.name AS cliente, c.phone AS telefone, c.email,
             p.amount AS valor, p.due_date AS vencimento,
             p.status AS status, p.paid_at AS pago_em,
             p.description AS descricao, p.created_at AS criado_em
      FROM payments p JOIN customers c ON c.id = p.customer_id
      ${where} ORDER BY p.due_date DESC
    `, params);

    const headers = ['Cliente','Telefone','Email','Valor (R$)','Vencimento','Status','Pago em','Descrição','Criado em'];
    const csvRows = rows.map(r => [
      r.cliente, r.telefone, r.email || '',
      Number(r.valor).toFixed(2).replace('.',','),
      formatDate(r.vencimento), statusLabel(r.status),
      r.pago_em ? formatDate(r.pago_em) : '',
      r.descricao || '', formatDate(r.criado_em)
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));

    const csv = '\uFEFF' + [headers.join(';'), ...csvRows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cobrancas_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[GET /reports/export/csv]', err);
    res.status(500).json({ error: 'Erro ao exportar' });
  }
});

// GET /reports/export/pdf — HTML that browser can print as PDF
router.get('/export/pdf', auth, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (from) { where += ' AND p.due_date >= ?'; params.push(from); }
    if (to)   { where += ' AND p.due_date <= ?'; params.push(to); }
    if (status && status !== 'all') { where += ' AND p.status = ?'; params.push(status); }

    const rows = await all(`
      SELECT c.name AS cliente, c.phone AS telefone,
             p.amount AS valor, p.due_date AS vencimento,
             p.status AS status, p.paid_at AS pago_em, p.description AS descricao
      FROM payments p JOIN customers c ON c.id = p.customer_id
      ${where} ORDER BY p.due_date DESC
    `, params);

    const settings = await all('SELECT key, value FROM settings');
    const cfg = {};
    settings.forEach(s => cfg[s.key] = s.value);

    const total = rows.reduce((a,r) => a + r.valor, 0);
    const totalPaid = rows.filter(r => r.status==='paid').reduce((a,r) => a + r.valor, 0);

    const statusColor = { paid:'#16a34a', pending:'#d97706', overdue:'#dc2626', cancelled:'#6b7280' };
    const statusBg    = { paid:'#dcfce7', pending:'#fef3c7', overdue:'#fee2e2', cancelled:'#f3f4f6' };

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Relatório de Cobranças</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:0;padding:20px}
h1{font-size:18px;margin:0 0 4px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #00C896}
.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.sum-card{padding:12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
.sum-label{font-size:10px;color:#6b7280;text-transform:uppercase;margin-bottom:4px}
.sum-value{font-size:16px;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f3f4f6;text-align:left;padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;border-bottom:1px solid #e5e7eb}
td{padding:8px;border-bottom:1px solid #f3f4f6}
tr:nth-child(even) td{background:#f9fafb}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600}
@media print{body{padding:0}@page{margin:1cm}}
</style></head><body>
<div class="header">
  <div>
    <h1>${cfg.company_name || 'Relatório de Cobranças'}</h1>
    <p style="color:#6b7280;margin:0;font-size:11px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    ${from||to ? `<p style="color:#6b7280;margin:0;font-size:11px">Período: ${from||'início'} a ${to||'fim'}</p>` : ''}
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#6b7280">${rows.length} cobranças</div>
  </div>
</div>
<div class="summary">
  <div class="sum-card">
    <div class="sum-label">Total</div>
    <div class="sum-value">${formatCurrency(total)}</div>
  </div>
  <div class="sum-card">
    <div class="sum-label">Recebido</div>
    <div class="sum-value" style="color:#16a34a">${formatCurrency(totalPaid)}</div>
  </div>
  <div class="sum-card">
    <div class="sum-label">Pendente / Atrasado</div>
    <div class="sum-value" style="color:#d97706">${formatCurrency(total - totalPaid)}</div>
  </div>
</div>
<table>
<thead><tr><th>Cliente</th><th>Telefone</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Descrição</th></tr></thead>
<tbody>
${rows.map(r => `<tr>
  <td><strong>${r.cliente}</strong></td>
  <td>${r.telefone}</td>
  <td style="font-weight:600">${formatCurrency(r.valor)}</td>
  <td>${formatDate(r.vencimento)}</td>
  <td><span class="badge" style="background:${statusBg[r.status]||'#f3f4f6'};color:${statusColor[r.status]||'#111'}">${statusLabel(r.status)}</span></td>
  <td style="color:#6b7280">${r.descricao||'—'}</td>
</tr>`).join('')}
</tbody></table>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('[GET /reports/export/pdf]', err);
    res.status(500).json({ error: 'Erro ao exportar PDF' });
  }
});

module.exports = router;
