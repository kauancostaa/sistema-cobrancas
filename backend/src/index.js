require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const { initSchema, get } = require('./db/database');
const { startScheduler }  = require('./services/scheduler');

const { router: authRouter, auth } = require('./routes/auth');
const customersRouter  = require('./routes/customers');
const paymentsRouter   = require('./routes/payments');
const dashboardRouter  = require('./routes/dashboard');
const aiRouter         = require('./routes/ai');
const settingsRouter   = require('./routes/settings');
const recurrencesRouter = require('./routes/recurrences').router;
const reportsRouter    = require('./routes/reports');

const app  = express();
const PORT = process.env.PORT || 3001;

process.on('unhandledRejection', err => console.error('[UnhandledRejection]', err));
process.on('uncaughtException',  err => { console.error('[UncaughtException]', err); process.exit(1); });

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin, methods: ['GET','POST','PATCH','DELETE'] }));

app.use(rateLimit({ windowMs: 15*60*1000, max: 300, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '5mb' }));
app.use((req,_,next) => { console.log(`${req.method} ${req.path}`); next(); });
app.use((_,res,next) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  next();
});

// Routes
app.use('/auth',        authRouter);
app.use('/customers',   customersRouter);
app.use('/payments',    paymentsRouter);
app.use('/dashboard',   dashboardRouter);
app.use('/settings',    settingsRouter);
app.use('/recurrences', recurrencesRouter);
app.use('/reports',     reportsRouter);
app.use('/ai',          rateLimit({ windowMs: 60*1000, max: 15 }), aiRouter);

// Asaas webhook
app.post('/webhooks/asaas', async (req, res) => {
  try {
    const event = req.body;
    if (event.event === 'PAYMENT_RECEIVED' && event.payment?.externalReference) {
      const pid = parseInt(event.payment.externalReference);
      await require('./db/database').run('UPDATE payments SET status=?,paid_at=? WHERE id=?',['paid', new Date().toISOString(), pid]);
      console.log(`[Webhook] Payment ${pid} → pago`);
    }
    res.json({ received: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pix page (public — no auth)
app.get('/pix/:token', async (req, res) => {
  try {
    const row = await get(`
      SELECT pl.*, p.amount, p.due_date, c.name AS customer_name
      FROM pix_links pl JOIN payments p ON p.id=pl.payment_id JOIN customers c ON c.id=p.customer_id
      WHERE pl.token=?`,[req.params.token]);
    if (!row) return res.status(404).send('<h2>Link inválido.</h2>');
    if (row.expires_at && row.expires_at < new Date().toISOString())
      return res.status(410).send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>⏰ Link Expirado</h2></body></html>');
    const amount = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(row.amount);
    const [y,m,d] = row.due_date.split('-');
    const pixKey  = row.pix_copy_paste || process.env.PIX_KEY || 'pagamentos@empresa.com.br';
    res.send(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pagar via Pix</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0fdf4}
.card{background:#fff;border-radius:16px;padding:40px;max-width:400px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);width:100%}
.amount{font-size:2.5rem;font-weight:700;color:#16a34a;margin:16px 0}
.pix-key{background:#f0fdf4;border:2px dashed #86efac;border-radius:8px;padding:16px;font-family:monospace;margin:20px 0;font-size:.85rem;color:#166534;word-break:break-all}
button{background:#16a34a;color:#fff;border:none;padding:14px;border-radius:8px;font-size:1rem;cursor:pointer;width:100%}
button:hover{background:#15803d}</style></head>
<body><div class="card"><div style="font-size:3rem">💚</div>
<h2 style="margin:0 0 4px">Pagamento via Pix</h2>
<p style="color:#6b7280">${row.customer_name}</p>
<div class="amount">${amount}</div>
<p style="color:#6b7280">Vencimento: ${d}/${m}/${y}</p>
<div class="pix-key"><div style="font-weight:600;margin-bottom:8px">Chave Pix</div>${pixKey}</div>
<button onclick="navigator.clipboard.writeText('${pixKey.replace(/'/g,"\\'")}').then(()=>this.textContent='✓ Copiado!')">📋 Copiar Chave Pix</button>
</div></body></html>`);
  } catch (err) { res.status(500).send('<h2>Erro.</h2>'); }
});

app.get('/health', async (_,res) => {
  try {
    await get('SELECT 1');
    const ai = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here');
    res.json({ status:'ok', db:'connected', ai: ai?'enabled':'disabled', ts: new Date().toISOString() });
  } catch (err) { res.status(503).json({ status:'error', db:'disconnected' }); }
});

app.use((_,res) => res.status(404).json({ error: 'Rota não encontrada' }));
app.use((err,_,res,__) => { console.error('[Error]',err); res.status(500).json({ error:'Erro interno' }); });

async function start() {
  await initSchema();
  app.listen(PORT, () => {
    console.log(`\n🚀 Cobranças API v4 em http://localhost:${PORT}`);
    const ai = !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here');
    console.log(`🤖 IA: ${ai ? '✓ Claude ativado' : '✗ Configure ANTHROPIC_API_KEY'}`);
    console.log(`📱 WhatsApp: ${require('./services/whatsapp').getProvider()}`);
    console.log(`📧 Email: ${require('./services/email').getProvider()}`);
    console.log(`💳 Pix: ${require('./services/pix').getProvider()}`);
    console.log(`🔐 Auth: JWT ativo — login: admin@empresa.com / admin123`);
    startScheduler();
  });
}

start().catch(err => { console.error('Falha:', err); process.exit(1); });
