require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const fs      = require('fs');

const DB_PATH = path.join(__dirname, '../../data/cobrancas.db');
let db;

function getDb() {
  if (db) return db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new sqlite3.Database(DB_PATH);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => { if (err) reject(err); else resolve(rows || []); });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, err => { if (err) reject(err); else resolve(); });
  });
}

async function transaction(fn) {
  await run('BEGIN');
  try { const r = await fn(); await run('COMMIT'); return r; }
  catch (err) { await run('ROLLBACK'); throw err; }
}

async function initSchema() {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
      document TEXT, notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL, due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      description TEXT, paid_at TEXT,
      recurrence_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS recurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      day_of_month INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sent',
      message_body TEXT,
      sent_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS pix_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL, expires_at TEXT,
      asaas_charge_id TEXT, pix_copy_paste TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_payments_due_date    ON payments(due_date);
    CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_customer    ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status_date ON payments(status, due_date);
  `);

  // Safe migrations for existing DBs
  const migrations = [
    "ALTER TABLE customers ADD COLUMN document TEXT",
    "ALTER TABLE customers ADD COLUMN notes TEXT",
    "ALTER TABLE payments ADD COLUMN recurrence_id INTEGER",
    "ALTER TABLE pix_links ADD COLUMN asaas_charge_id TEXT",
    "ALTER TABLE pix_links ADD COLUMN pix_copy_paste TEXT",
  ];
  for (const m of migrations) {
    try { await run(m); } catch {}
  }

  // Default admin if no users exist
  const userCount = await get('SELECT COUNT(*) as c FROM users');
  if (userCount.c === 0) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await run("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      ['Administrador', 'admin@empresa.com', hash]);
    console.log('[DB] Usuário admin criado: admin@empresa.com / admin123');
  }

  // Default settings
  const defaults = [
    ['company_name', 'Minha Empresa'],
    ['pix_key', 'pagamentos@empresa.com.br'],
    ['company_email', ''],
    ['company_phone', ''],
    ['overdue_days_to_notify', '1'],
  ];
  for (const [key, value] of defaults) {
    try { await run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]); } catch {}
  }

  console.log('[DB] Schema pronto');
}

module.exports = { getDb, run, get, all, exec, transaction, initSchema };
