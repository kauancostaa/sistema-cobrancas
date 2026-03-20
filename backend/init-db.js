const Database = require('better-sqlite3');
// ou para sqlite3: const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Garantir que a pasta database existe
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('Pasta database criada');
}

const dbPath = path.join(dbDir, 'app.db');
console.log('Caminho do banco:', dbPath);

// Tentar com better-sqlite3 primeiro
let db;
try {
    db = new Database(dbPath);
    console.log('Usando better-sqlite3');
} catch (err) {
    console.log('better-sqlite3 não disponível, tentando sqlite3...');
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(dbPath);
}

// Criar tabelas
console.log('Criando tabelas...');

const createTables = 
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    document TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    amount DECIMAL(10,2),
    status TEXT,
    due_date DATE,
    paid_at DATETIME,
    FOREIGN KEY (customer_id) REFERENCES customers (id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    content TEXT,
    type TEXT,
    sent_at DATETIME,
    status TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers (id)
  );
;

try {
    // Para better-sqlite3
    if (db.exec) {
        db.exec(createTables);
    } 
    // Para sqlite3
    else {
        db.exec(createTables, (err) => {
            if (err) throw err;
        });
    }
    console.log('Tabelas criadas com sucesso!');
    
    // Inserir alguns dados de exemplo
    console.log('Inserindo dados de exemplo...');
    
    const sampleData = 
        INSERT OR IGNORE INTO customers (name, email, phone, document) VALUES 
        ('João Silva', 'joao@email.com', '(11) 99999-9999', '123.456.789-00'),
        ('Maria Santos', 'maria@email.com', '(11) 88888-8888', '987.654.321-00'),
        ('Pedro Oliveira', 'pedro@email.com', '(11) 77777-7777', '456.789.123-00');
        
        INSERT OR IGNORE INTO payments (customer_id, amount, status, due_date, paid_at) VALUES 
        (1, 1500.00, 'paid', '2024-01-15', '2024-01-15 10:30:00'),
        (1, 1500.00, 'pending', '2024-02-15', NULL),
        (2, 2500.00, 'paid', '2024-01-20', '2024-01-19 14:20:00'),
        (2, 2500.00, 'overdue', '2024-02-20', NULL),
        (3, 800.00, 'paid', '2024-01-10', '2024-01-09 09:15:00');
        
        INSERT OR IGNORE INTO messages (customer_id, content, type, sent_at, status) VALUES 
        (1, 'Cobrança enviada com sucesso', 'payment', '2024-01-15 10:35:00', 'sent'),
        (2, 'Lembrete de pagamento', 'reminder', '2024-02-18 09:00:00', 'sent'),
        (3, 'Mensagem de boas-vindas', 'welcome', '2024-01-09 09:30:00', 'delivered');
    ;
    
    if (db.exec) {
        db.exec(sampleData);
    } else {
        db.exec(sampleData, (err) => {
            if (err) throw err;
        });
    }
    
    console.log('Dados de exemplo inseridos!');
    
} catch (error) {
    console.error('Erro ao criar tabelas:', error);
}

console.log('Banco de dados inicializado com sucesso!');

// Fechar conexão
if (db.close) {
    db.close();
}
