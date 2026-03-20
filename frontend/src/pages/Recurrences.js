import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { toastSuccess, toastError } from '../lib/toast';

export default function Recurrences() {
  const [recs, setRecs]       = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.getRecurrences(), api.getCustomers()])
      .then(([r, c]) => { setRecs(r); setCustomers(c); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id) => {
    try { await api.toggleRecurrence(id); load(); toastSuccess('Recorrência atualizada'); }
    catch (e) { toastError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta recorrência? As cobranças já geradas serão mantidas.')) return;
    try { await api.deleteRecurrence(id); load(); toastSuccess('Recorrência removida'); }
    catch (e) { toastError(e.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Recorrências</div>
          <div className="page-subtitle">Cobranças geradas automaticamente todo mês</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nova recorrência</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? <SkeletonRows /> : recs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔄</div>
            <div className="empty-title">Nenhuma recorrência configurada</div>
            <div className="empty-description">Configure cobranças mensais que se criam sozinhas</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowModal(true)}>
              Criar primeira recorrência
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Cliente</th><th>Valor</th><th>Dia do mês</th>
                <th>Descrição</th><th>Status</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {recs.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--brand-muted)', border: '1px solid rgba(0,200,150,.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: 'var(--brand)',
                      }}>{r.customer_name?.charAt(0)}</div>
                      <span style={{ fontWeight: 500 }}>{r.customer_name}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: 12 }}>
                    {formatCurrency(r.amount)}
                  </td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                    Todo dia <strong>{r.day_of_month}</strong>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{r.description || '—'}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                      background: r.active ? 'var(--green-bg)' : 'var(--surface-3)',
                      color: r.active ? 'var(--green)' : 'var(--text-3)',
                    }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                      {r.active ? 'Ativa' : 'Pausada'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(r.id)}>
                        {r.active ? 'Pausar' : 'Ativar'}
                      </button>
                      <button className="btn btn-danger" onClick={() => handleDelete(r.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AddRecurrenceModal
          customers={customers}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); toastSuccess('Recorrência criada — primeira cobrança gerada!'); }}
        />
      )}
    </div>
  );
}

function AddRecurrenceModal({ customers, onClose, onSaved }) {
  const [form, setForm]     = useState({ customer_id:'', amount:'', description:'', day_of_month:'1' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = f => e => setForm(x => ({ ...x, [f]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.customer_id || !form.amount) { setError('Cliente e valor são obrigatórios'); return; }
    setSaving(true);
    try { await api.createRecurrence(form); onSaved(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nova recorrência</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Cliente *</label>
            <select className="form-input" value={form.customer_id} onChange={set('customer_id')}>
              <option value="">Selecione...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Valor (R$) *</label>
              <input className="form-input" type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={set('amount')} />
            </div>
            <div className="form-group">
              <label className="form-label">Dia do mês (1–28)</label>
              <input className="form-input" type="number" min="1" max="28" value={form.day_of_month} onChange={set('day_of_month')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input className="form-input" placeholder="Ex: Mensalidade" value={form.description} onChange={set('description')} />
          </div>
          <div style={{ padding: '10px 14px', background: 'var(--brand-muted)', borderRadius: 'var(--r-md)',
            fontSize: 12, color: 'var(--brand)', border: '1px solid rgba(0,200,150,.2)' }}>
            💡 A primeira cobrança será gerada automaticamente para o mês atual
          </div>
        </div>
        <div className="form-actions" style={{ marginTop: 22 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Criando...' : 'Criar recorrência'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      {[1,2,3].map(i => <div key={i} style={{ height: 36, background: 'var(--surface-3)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />)}
    </div>
  );
}
