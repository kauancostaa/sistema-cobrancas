import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDateTime, messageTypeLabel, formatCurrency } from '../lib/utils';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = dateStr.replace(' ', 'T').split('T')[0];
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function Messages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    api.getMessages()
      .then(d => setMessages(Array.isArray(d) ? d : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error)   return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Mensagens</div>
          <div className="page-subtitle">{messages.length} mensagem{messages.length !== 1 ? 's' : ''} no histórico</div>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">◈</div>
            <div className="empty-title">Nenhuma mensagem enviada ainda</div>
            <div className="empty-description">As mensagens automáticas do scheduler aparecerão aqui</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(msg => (
            <div key={msg.id} className="message-card">
              <div className="message-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--surface-3)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-2)',
                    flexShrink: 0,
                  }}>
                    {(msg.customer_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{msg.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{msg.phone}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-3)' }}>
                    {formatCurrency(msg.amount)}
                  </span>
                  <span className={`badge badge-${msg.type}`}>{messageTypeLabel(msg.type)}</span>
                </div>
              </div>

              <div className="message-body">{msg.message_body}</div>

              <div className="message-footer">
                <span style={{ color: 'var(--text-3)', fontSize: 11, fontFamily: 'var(--mono)' }}>
                  {formatDateTime(msg.sent_at)}
                </span>
                <span style={{
                  color: 'var(--green)', fontSize: 10, fontWeight: 600,
                  letterSpacing: '.04em', textTransform: 'uppercase',
                }}>
                  ✓ {msg.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="page-header"><div className="page-title">Mensagens</div></div>
      <div className="card" style={{ height: 300, animation: 'pulse 1.5s infinite' }} />
    </div>
  );
}
