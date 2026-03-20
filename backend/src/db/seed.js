const { initSchema, run, get, transaction } = require('./database');

function relativeDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

async function seed() {
  await initSchema();

  const existing = await get('SELECT COUNT(*) as c FROM customers');
  if (existing.c > 0) {
    console.log('[Seed] Dados já existem. Nenhuma ação necessária.');
    process.exit(0);
  }

  await transaction(async () => {
    const c1 = await run('INSERT INTO customers (name, phone, email) VALUES (?,?,?)',
      ['João Silva',    '(11) 99999-9999', 'joao@email.com']);
    const c2 = await run('INSERT INTO customers (name, phone, email) VALUES (?,?,?)',
      ['Maria Santos',  '(11) 88888-8888', 'maria@email.com']);
    const c3 = await run('INSERT INTO customers (name, phone, email) VALUES (?,?,?)',
      ['Pedro Oliveira','(11) 77777-7777', 'pedro@email.com']);

    const ins = (cid, amount, due, status, desc, paidAt) =>
      run('INSERT INTO payments (customer_id,amount,due_date,status,description,paid_at) VALUES (?,?,?,?,?,?)',
        [cid, amount, due, status, desc, paidAt]);

    await ins(c1.lastInsertRowid, 1500, relativeDate(-30), 'paid',    'Mensalidade anterior', relativeDate(-30) + ' 10:30:00');
    await ins(c1.lastInsertRowid, 1500, relativeDate(2),   'pending', 'Mensalidade atual',    null);
    await ins(c2.lastInsertRowid, 2500, relativeDate(-35), 'paid',    'Aluguel anterior',     relativeDate(-35) + ' 14:20:00');
    await ins(c2.lastInsertRowid, 2500, relativeDate(0),   'pending', 'Aluguel atual',        null);
    await ins(c3.lastInsertRowid, 800,  relativeDate(-5),  'pending', 'Internet em atraso',   null);
    await ins(c3.lastInsertRowid, 800,  relativeDate(7),   'pending', 'Internet próxima',     null);
  });

  console.log('[Seed] Dados inseridos com sucesso!');
  process.exit(0);
}

seed().catch(err => { console.error('[Seed] Erro:', err); process.exit(1); });
