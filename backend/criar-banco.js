const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'cobrancas.db');
const dataDir = path.join(__dirname, 'data');

// Criar pasta data se não existir
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Pasta data criada');
}

console.log('Criando banco em:', dbPath);

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Criando tabelas...');
    
    // Criar tabela customers
    db.run(\
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    \, (err) => {
        if (err) console.error('Erro customers:', err);
        else console.log('Tabela customers criada');
    });
    
    // Criar tabela payments
    db.run(\
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            due_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            description TEXT,
            paid_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
        )
    \, (err) => {
        if (err) console.error('Erro payments:', err);
        else console.log('Tabela payments criada');
    });
    
    // Criar tabela message_logs
    db.run(\
        CREATE TABLE IF NOT EXISTS message_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'sent',
            message_body TEXT,
            sent_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
        )
    \, (err) => {
        if (err) console.error('Erro message_logs:', err);
        else console.log('Tabela message_logs criada');
    });
    
    // Criar tabela pix_links
    db.run(\
        CREATE TABLE IF NOT EXISTS pix_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            payment_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            url TEXT NOT NULL,
            expires_at TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
        )
    \, (err) => {
        if (err) console.error('Erro pix_links:', err);
        else console.log('Tabela pix_links criada');
    });
    
    // Criar índices
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id)');
    
    console.log('Tabelas criadas com sucesso!');
    
    // Verificar se há dados
    db.get('SELECT COUNT(*) as count FROM customers', (err, row) => {
        if (err) {
            console.error('Erro ao verificar customers:', err);
            return;
        }
        
        if (row.count === 0) {
            console.log('Inserindo dados de exemplo...');
            
            // Inserir customers
            db.run(\
                INSERT INTO customers (name, phone, email) VALUES
                ('João Silva', '(11) 99999-9999', 'joao@email.com'),
                ('Maria Santos', '(11) 88888-8888', 'maria@email.com'),
                ('Pedro Oliveira', '(11) 77777-7777', 'pedro@email.com')
            \, function(err) {
                if (err) console.error('Erro ao inserir customers:', err);
                else console.log('Customers inseridos');
                
                // Inserir payments
                db.run(\
                    INSERT INTO payments (customer_id, amount, due_date, status, description, paid_at) VALUES
                    (1, 1500.00, '2024-01-15', 'paid', 'Mensalidade Janeiro', '2024-01-15 10:30:00'),
                    (1, 1500.00, '2024-02-15', 'pending', 'Mensalidade Fevereiro', NULL),
                    (2, 2500.00, '2024-01-20', 'paid', 'Aluguel Janeiro', '2024-01-19 14:20:00'),
                    (2, 2500.00, '2024-02-20', 'overdue', 'Aluguel Fevereiro', NULL),
                    (3, 800.00, '2024-01-10', 'paid', 'Internet Janeiro', '2024-01-09 09:15:00')
                \, function(err) {
                    if (err) console.error('Erro ao inserir payments:', err);
                    else console.log('Payments inseridos');
                });
            });
        }
    });
});

setTimeout(() => {
    db.close();
    console.log('Banco de dados configurado com sucesso!');
}, 2000);
