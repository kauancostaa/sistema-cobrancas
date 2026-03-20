import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime, messageTypeLabel, daysUntilDue } from '../lib/utils';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = dateStr.replace(' ', 'T').split('T')[0];
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function Dashboard() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [status, setStatus]     = useState(null);
  const [risk, setRisk]         = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const load = useCallback(() => {
    api.getDashboard()
      .then(res => { setData(res); setError(null); })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    // Load integration status
    api.getAIStatus().then(setStatus).catch(() => {});
    return () => clearInterval(iv);
  }, [load]);

  const loadRisk = async () => {
    setRiskLoading(true);
    try { setRisk(await api.getAIRisk()); }
    catch (e) { setRisk({ error: e.message }); }
    finally { setRiskLoading(false); }
  };

  if (loading) return <LoadingState />;
  if (error)   return <div className="alert alert-error">{error}</div>;
  if (!data)   return null;

  const s   = data.summary || {};
  const up  = Array.isArray(data.upcoming)        ? data.upcoming        : [];
  const msg = Array.isArray(data.recent_messages) ? data.recent_messages : [];
  const aiEnabled = status?.ai?.enabled;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Atualiza a cada 60s · {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>

      {/* Integration status bar */}
      {status && (
        <div style={{
          display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap',
        }}>
          {[
            { key: 'ai',       label: 'IA Claude',  icon: '' },
            { key: 'whatsapp', label: 'WhatsApp',   icon: '' },
            { key: 'email',    label: 'Email',      icon: '' },
            { key: 'pix',      label: 'Pix Real',   icon: '' },
          ].map(({ key, label, icon }) => {
            const s2 = status[key];
            const active = s2?.enabled;
            return (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99,
                background: active ? 'var(--green-bg)' : 'var(--surface-2)',
                border: `1px solid ${active ? 'rgba(0,200,150,.25)' : 'var(--border)'}`,
                fontSize: 11, fontWeight: 600,
                color: active ? 'var(--green)' : 'var(--text-3)',
              }}>
                <span>{icon}</span>
                <span>{label}</span>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: active ? 'var(--green)' : 'var(--text-3)',
                  marginLeft: 2,
                }} />
                <span style={{ fontWeight: 400, opacity: .7 }}>{s2?.provider}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-accent">⊞</div>
          <div className="stat-label">Total a receber</div>
          <div className="stat-value">{formatCurrency(s.total_to_receive)}</div>
          <div className="stat-count">{s.total_payments || 0} cobranças</div>
        </div>
        <div className="stat-card green">
          <div className="stat-accent">✓</div>
          <div className="stat-label">Recebido</div>
          <div className="stat-value">{formatCurrency(s.total_received)}</div>
          <div className="stat-count">{s.count_paid || 0} pagas</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-accent">◷</div>
          <div className="stat-label">Pendente</div>
          <div className="stat-value">{formatCurrency(s.total_pending)}</div>
          <div className="stat-count">{s.count_pending || 0} em aberto</div>
        </div>
        <div className="stat-card red">
          <div className="stat-accent">!</div>
          <div className="stat-label">Em atraso</div>
          <div className="stat-value">{formatCurrency(s.total_overdue)}</div>
          <div className="stat-count">{s.count_overdue || 0} vencidas</div>
        </div>
      </div>

      {/* AI Risk Analysis */}
      {aiEnabled && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: risk ? 14 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14 }}></span>
              <span className="card-title" style={{ margin: 0 }}>Análise de Risco IA</span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={loadRisk}
              disabled={riskLoading}
            >
              {riskLoading ? 'Analisando...' : risk ? '↻ Atualizar' : 'Analisar agora'}
            </button>
          </div>

          {risk && !risk.error && (
            <div>
              {/* Score bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99,
                    width: `${risk.score}%`,
                    background: risk.score >= 70 ? 'var(--green)' : risk.score >= 40 ? 'var(--amber)' : 'var(--red)',
                    transition: 'width .6s ease',
                  }} />
                </div>
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, minWidth: 40,
                  color: risk.score >= 70 ? 'var(--green)' : risk.score >= 40 ? 'var(--amber)' : 'var(--red)',
                }}>
                  {risk.score}/100
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500, marginBottom: 10 }}>{risk.headline}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {(risk.insights || []).map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
                    <span style={{ color: 'var(--brand)', flexShrink: 0 }}>→</span>
                    <span>{ins}</span>
                  </div>
                ))}
              </div>
              {risk.recommendation && (
                <div style={{
                  padding: '10px 14px', background: 'var(--brand-muted)',
                  border: '1px solid rgba(0,200,150,.2)', borderRadius: 'var(--r-md)',
                  fontSize: 12, color: 'var(--brand)',
                }}>
                   {risk.recommendation}
                </div>
              )}
              {(risk.high_risk_customers || []).length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Alto risco:</span>
                  {risk.high_risk_customers.map(n => (
                    <span key={n} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--red-bg)', color: 'var(--red)', borderRadius: 99 }}>{n}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {risk?.error && (
            <div className="alert alert-error" style={{ marginTop: 10 }}>{risk.error}</div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Upcoming */}
        <div className="card">
          <div className="card-title">Próximos vencimentos</div>
          {up.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <div className="empty-title" style={{ fontSize: 13 }}>Nenhum vencimento em 7 dias</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {up.map(p => {
                const days = daysUntilDue(p.due_date);
                const urgent = days <= 1;
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: urgent ? 'var(--red)' : 'var(--amber)' }} />
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{p.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                          {days === 0 ? 'Hoje' : `${days}d`} · {formatDate(p.due_date)}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, fontFamily: 'var(--mono)', color: urgent ? 'var(--red)' : 'var(--text-1)' }}>
                        {formatCurrency(p.amount)}
                      </span>
                      {p.pix_url && <a href={p.pix_url} target="_blank" rel="noreferrer" className="pix-link">Pix</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent messages */}
        <div className="card">
          <div className="card-title">Mensagens recentes</div>
          {msg.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <div className="empty-title" style={{ fontSize: 13 }}>Nenhuma mensagem enviada</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {msg.map(m => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '9px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{formatDateTime(m.sent_at)}</div>
                  </div>
                  <span className={`badge badge-${m.type}`}>{messageTypeLabel(m.type)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Chat */}
      {aiEnabled && <AIChat />}
    </div>
  );
}

function AIChat() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Olá! Posso responder perguntas sobre seus clientes, cobranças e métricas. Experimente: "Quais clientes estão mais atrasados?" ou "Quanto recebi este mês?"' }
  ]);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const { reply } = await api.aiChat(text);
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', text: `Erro: ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'Quais clientes estão em atraso?',
    'Quanto recebi este mês?',
    'Qual cliente deve mais?',
  ];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 14 }}></span>
        <span className="card-title" style={{ margin: 0 }}>Assistente IA</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>Claude</span>
      </div>

      <div style={{
        height: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '82%', padding: '9px 13px', borderRadius: 12,
              fontSize: 13, lineHeight: 1.55,
              background: m.role === 'user' ? 'var(--brand-muted)' : 'var(--surface-3)',
              color: m.role === 'user' ? 'var(--brand)' : m.error ? 'var(--red)' : 'var(--text-1)',
              border: `1px solid ${m.role === 'user' ? 'rgba(0,200,150,.2)' : 'var(--border)'}`,
              borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px',
              whiteSpace: 'pre-line',
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '9px 14px', background: 'var(--surface-3)',
              borderRadius: '2px 12px 12px 12px', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-3)',
            }}>
              <span style={{ animation: 'pulse 1s infinite' }}>Pensando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length === 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {suggestions.map(s => (
            <button key={s} onClick={() => setInput(s)} style={{
              padding: '4px 10px', borderRadius: 99, fontSize: 11,
              background: 'var(--surface-3)', border: '1px solid var(--border)',
              color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font)',
            }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder="Pergunte sobre seus dados financeiros..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim()}>
          Enviar
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="page-header"><div className="page-title">Dashboard</div></div>
      <div className="stats-grid">
        {[1,2,3,4].map(i => <div key={i} className="stat-card" style={{ height: 88, animation: 'pulse 1.5s infinite' }} />)}
      </div>
    </div>
  );
}
