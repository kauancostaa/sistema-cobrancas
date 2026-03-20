const { getDb } = require('./src/db/database');

async function init() {
    try {
        const db = await getDb();
        console.log('Banco inicializado com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('Erro ao inicializar banco:', error);
        process.exit(1);
    }
}

init();
