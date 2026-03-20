/**
 * AI Service — powered by Claude (Anthropic)
 * 
 * Features:
 *   1. generateCollectionMessage()  — personalized WhatsApp message per customer
 *   2. analyzeRisk()                — risk analysis for all customers
 *   3. chat()                       — natural language queries over financial data
 * 
 * SETUP: set ANTHROPIC_API_KEY in your .env file
 * Get your key at: https://console.anthropic.com
 */

const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key === 'your_anthropic_api_key_here') {
    throw new Error('ANTHROPIC_API_KEY não configurada. Adicione no arquivo .env do backend.');
  }
  return new Anthropic({ apiKey: key });
}

// ── 1. Personalized collection message ───────────────────────────────────────
async function generateCollectionMessage(customer, payment, pixUrl) {
  const client = getClient();

  const overdayeDays = payment.due_date < new Date().toISOString().split('T')[0]
    ? Math.floor((new Date() - new Date(payment.due_date)) / 86400000)
    : 0;

  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount);
  const [y, m, d] = payment.due_date.split('-');
  const dueFormatted = `${d}/${m}/${y}`;

  const prompt = `Você é um assistente de cobrança profissional e empático de uma empresa brasileira.

Cliente: ${customer.name}
Valor: ${amount}
Vencimento: ${dueFormatted}
Dias em atraso: ${overdayeDays > 0 ? overdayeDays : 'não venceu ainda'}
Histórico: ${payment.description || 'cobrança geral'}
Link para pagamento Pix: ${pixUrl}

Escreva UMA mensagem de WhatsApp para este cliente.

Regras:
- Tom: profissional mas humano, nunca ameaçador
- Se em atraso 1-3 dias: gentil lembrete, pode ter esquecido
- Se em atraso 4-14 dias: mais direto, mencionar regularização urgente  
- Se em atraso 15+ dias: firme, mencionar possíveis consequências de forma respeitosa
- Se não venceu ainda: lembrete amigável antecipado
- Sempre incluir o link Pix ao final
- Máximo 5 linhas
- Use emojis com moderação (1-2 no máximo)
- NÃO inclua saudação inicial como "Olá" — vá direto ao ponto
- Responda APENAS com o texto da mensagem, sem explicações`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  return msg.content[0].text.trim();
}

// ── 2. Risk analysis ──────────────────────────────────────────────────────────
async function analyzeRisk(customers, payments) {
  const client = getClient();

  const today = new Date().toISOString().split('T')[0];

  const summary = customers.map(c => {
    const cp = payments.filter(p => p.customer_id === c.id);
    const paid    = cp.filter(p => p.status === 'paid').length;
    const overdue = cp.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < today)).length;
    const pending = cp.filter(p => p.status === 'pending' && p.due_date >= today).length;
    const totalOwed = cp
      .filter(p => p.status !== 'paid' && p.status !== 'cancelled')
      .reduce((a, p) => a + p.amount, 0);
    return { name: c.name, paid, overdue, pending, totalOwed };
  });

  const totalReceived = payments.filter(p => p.status === 'paid').reduce((a, p) => a + p.amount, 0);
  const totalOverdue  = payments.filter(p => p.status === 'overdue' || (p.status === 'pending' && p.due_date < today)).reduce((a, p) => a + p.amount, 0);

  const prompt = `Você é um analista financeiro especializado em gestão de recebíveis de PMEs brasileiras.

DADOS DA CARTEIRA:
Total recebido: R$ ${totalReceived.toFixed(2)}
Total em atraso: R$ ${totalOverdue.toFixed(2)}
Clientes: ${JSON.stringify(summary, null, 2)}

Gere uma análise em JSON com este formato exato:
{
  "score": número de 0-100 indicando saúde financeira geral (100 = excelente),
  "headline": "frase curta de 1 linha sobre o estado geral da carteira",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "high_risk_customers": ["nome1", "nome2"],
  "recommendation": "ação mais importante a tomar agora (1 frase)"
}

Responda APENAS com o JSON, sem markdown ou explicações.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract JSON if wrapped in markdown
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { score: 50, headline: 'Análise indisponível', insights: [], high_risk_customers: [], recommendation: '' };
  }
}

// ── 3. Natural language chat over financial data ──────────────────────────────
async function chat(userMessage, dbContext) {
  const client = getClient();

  const { customers, payments, summary } = dbContext;
  const today = new Date().toISOString().split('T')[0];

  const context = `
DADOS ATUAIS DO SISTEMA (${today}):

RESUMO FINANCEIRO:
- Total a receber: R$ ${summary.total_to_receive?.toFixed(2) || 0}
- Total recebido: R$ ${summary.total_received?.toFixed(2) || 0}
- Em atraso: R$ ${summary.total_overdue?.toFixed(2) || 0}
- Pendente: R$ ${summary.total_pending?.toFixed(2) || 0}

CLIENTES (${customers.length} total):
${customers.map(c => `- ${c.name} | ${c.phone} | ${c.total_payments} cobranças | R$${Number(c.paid_amount||0).toFixed(2)} pagos`).join('\n')}

COBRANÇAS RECENTES (últimas 20):
${payments.slice(0, 20).map(p => `- ${p.customer_name} | R$${p.amount} | vence ${p.due_date} | ${p.status} | ${p.description || ''}`).join('\n')}
`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 800,
    system: `Você é um assistente financeiro inteligente para um sistema de cobranças brasileiro. 
Você tem acesso aos dados financeiros em tempo real do sistema.
Responda em português, de forma direta e útil.
Use formatação simples — sem markdown pesado, sem tabelas complexas.
Se perguntarem sobre clientes específicos, consulte os dados fornecidos.
Hoje é ${today}.`,
    messages: [
      { role: 'user', content: context + '\n\nPERGUNTA DO USUÁRIO: ' + userMessage }
    ],
  });

  return msg.content[0].text.trim();
}

module.exports = { generateCollectionMessage, analyzeRisk, chat };
