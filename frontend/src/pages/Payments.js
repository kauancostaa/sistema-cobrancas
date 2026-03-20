import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { toastSuccess, toastError } from '../lib/toast';

const STATUS_OPTS = [
  { value: 'all',       label: 'Todos' },
  { value: 'pending',   label: 'Pendente' },
  { value: 'paid',      label: 'Pago' },
  { value: 'overdue',   label: 'Vencido' },
  { value: 'cancelled', label: 'Cancelado' },
];

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [filter, setFilter]     = useState('all');
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getPayments(filter)
      .then(data => { setPayments(Array.isArray(data) ? data : []); setError(null); })
      .catch(e  => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, status) => {
    try { await api.updatePaymentStatus(id, status); load(); toastSuccess('Status atualizado'); }
    catch (e) { toastError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta cobrança?')) return;
    try { await api.deletePayment(id); load(); toastSuccess('Cobrança removida'); }
    catch (e) { toastError(e.message); }
  };

  const today = new Date().toISOString().split('T')[0];

  if (loading) return <LoadingState />;
  if (error)   return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Cobranças</div>
          <div className="page-subtitle">{payments.length} resultado{payments.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nova cobrança</button>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {STATUS_OPTS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            style={{
              padding: '5px 13px',
              borderRadius: 99,
              border: '1px solid',
              fontSize: 12, fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all .12s',
              borderColor: filter === opt.value ? 'var(--brand)' : 'var(--border-hi)',
              background:  filter === opt.value ? 'var(--brand-muted)' : 'transparent',
              color:       filter === opt.value ? 'var(--brand)' : 'var(--text-3)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {payments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">Nenhuma cobrança encontrada</div>
            <div className="empty-description">
              {filter !== 'all' ? 'Tente outro filtro' : 'Crie sua primeira cobrança'}
            </div>
            {filter === 'all' && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>Criar cobrança</button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th><th>Valor</th><th>Vencimento</th>
                  <th>Status</th><th>Descrição</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const overdue = p.status === 'overdue' || (p.status === 'pending' && p.due_date < today);
                  return (
                    <tr key={p.id} className={overdue ? 'row-overdue' : ''}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.customer_name}</div>
                        <div className="customer-phone">{p.customer_phone}</div>
                      </td>
                      <td style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: 12 }}>
                        {formatCurrency(p.amount)}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: overdue ? 'var(--red)' : 'var(--text-2)' }}>
                        {formatDate(p.due_date)}
                      </td>
                      <td>
                        <select
                          value={p.status}
                          onChange={e => handleStatusChange(p.id, e.target.value)}
                          className={`status-select badge-${p.status}`}
                        >
                          <option value="pending">Pendente</option>
                          <option value="paid">Pago</option>
                          <option value="overdue">Vencido</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </td>
                      <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{p.description || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {p.pix_url && (
                            <a href={p.pix_url} target="_blank" rel="noreferrer" className="pix-link">Pix ↗</a>
                          )}
                          <button className="btn btn-danger" onClick={() => handleDelete(p.id)}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <NewPaymentModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); toastSuccess('Cobrança criada'); }}
        />
      )}
    </div>
  );
}

function NewPaymentModal({ onClose, onSaved }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm]   = useState({ customer_id: '', amount: '', due_date: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = f => e => setForm(x => ({ ...x, [f]: e.target.value }));

  useEffect(() => {
    api.getCustomers()
      .then(d => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => setError('Erro ao carregar clientes'));
  }, []);

  const handleSubmit = async () => {
    if (!form.customer_id) { setError('Selecione um cliente.'); return; }
    if (!form.amount || !form.due_date) { setError('Preencha valor e vencimento.'); return; }
    setSaving(true);
    try { await api.createPayment(form); onSaved(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nova cobrança</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Cliente *</label>
            <select className="form-input" value={form.customer_id} onChange={set('customer_id')}>
              <option value="">Selecione...</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
              ))}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <input className="form-input" type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={set('amount')} />
            </div>
            <div className="form-group">
              <label className="form-label">Vencimento *</label>
              <input className="form-input" type="date" value={form.due_date} onChange={set('due_date')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" placeholder="Ex: Mensalidade março" value={form.description} onChange={set('description')} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 22 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Criar cobrança'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div className="page-header"><div className="page-title">Cobranças</div></div>
      <div className="card" style={{ height: 300, animation: 'pulse 1.5s infinite' }} />
    </div>
  );
}
