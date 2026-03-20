import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatPhone } from '../lib/utils';
import { toastSuccess, toastError } from '../lib/toast';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected]   = useState(null);
  const [search, setSearch]       = useState('');

  const load = useCallback((q) => {
    setLoading(true);
    api.getCustomers(q || '')
      .then(setCustomers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Server-side search with debounce
  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remover "${name}" e todas as cobranças?`)) return;
    try { await api.deleteCustomer(id); setCustomers(c => c.filter(x => x.id !== id)); toastSuccess('Cliente removido'); }
    catch (e) { toastError(e.message); }
  };

  if (selected) {
    return <CustomerDetail customerId={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-subtitle">{customers.length} cadastrado{customers.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>↑ Importar CSV</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo cliente</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ marginBottom:16 }}>
        <input className="form-input" style={{ maxWidth:320 }}
          placeholder="Buscar por nome, telefone, email..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card" style={{ padding:0 }}>
        {loading ? <Skeleton /> : customers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">◎</div>
            <div className="empty-title">{search ? 'Nenhum resultado' : 'Nenhum cliente ainda'}</div>
            {!search && (
              <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={() => setShowModal(true)}>
                Adicionar primeiro cliente
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Cliente</th><th>Telefone</th><th>Cobranças</th><th>Total</th><th>Recebido</th><th>Em atraso</th><th>Cadastro</th><th></th></tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => setSelected(c.id)}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{
                          width:30, height:30, borderRadius:'50%', flexShrink:0,
                          background: c.overdue_amount > 0 ? 'rgba(255,77,77,.15)' : 'var(--brand-muted)',
                          border: `1px solid ${c.overdue_amount > 0 ? 'rgba(255,77,77,.3)' : 'rgba(0,200,150,.2)'}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:11, fontWeight:700,
                          color: c.overdue_amount > 0 ? 'var(--red)' : 'var(--brand)',
                        }}>{c.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="customer-name">{c.name}</div>
                          {c.email && <div className="customer-phone">{c.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="customer-phone">{formatPhone(c.phone)}</td>
                    <td style={{ color:'var(--text-2)' }}>{c.total_payments}</td>
                    <td style={{ fontWeight:600, fontFamily:'var(--mono)', fontSize:12 }}>{formatCurrency(c.total_amount)}</td>
                    <td style={{ color:'var(--green)', fontWeight:600, fontFamily:'var(--mono)', fontSize:12 }}>{formatCurrency(c.paid_amount)}</td>
                    <td style={{ color: c.overdue_amount > 0 ? 'var(--red)' : 'var(--text-3)', fontFamily:'var(--mono)', fontSize:12, fontWeight: c.overdue_amount > 0 ? 600 : 400 }}>
                      {c.overdue_amount > 0 ? formatCurrency(c.overdue_amount) : '—'}
                    </td>
                    <td className="customer-phone">{formatDate(c.created_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn btn-danger" onClick={() => handleDelete(c.id, c.name)}>Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AddCustomerModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); toastSuccess('Cliente criado com sucesso'); }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSaved={(n) => { setShowImport(false); load(); toastSuccess(`${n} clientes importados`); }}
        />
      )}
    </div>
  );
}

// ── Import CSV Modal ──────────────────────────────────────────────────────────
function ImportModal({ onClose, onSaved }) {
  const [rows, setRows]   = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState([]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) { setError('Arquivo vazio ou sem dados'); return; }
      const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/['"]/g,''));
      const parsed = lines.slice(1).map(line => {
        const vals = line.split(/[;,]/).map(v => v.trim().replace(/^["']|["']$/g,''));
        const obj = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
        return {
          name:  obj.nome || obj.name || '',
          phone: obj.telefone || obj.phone || obj.whatsapp || '',
          email: obj.email || '',
          document: obj.cpf || obj.cnpj || obj.documento || obj.document || '',
        };
      }).filter(r => r.name && r.phone);
      setRows(parsed);
      setPreview(parsed.slice(0,5));
      setError(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (rows.length === 0) { setError('Nenhum dado válido encontrado'); return; }
    setSaving(true);
    try {
      const result = await api.importCustomers(rows);
      if (result.errors.length > 0) console.warn('Import errors:', result.errors);
      onSaved(result.created);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:580 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Importar clientes via CSV</div>

        <div style={{ padding:'12px 14px', background:'var(--surface-3)', borderRadius:'var(--r-md)', fontSize:12, color:'var(--text-2)', marginBottom:16, lineHeight:1.6 }}>
          <strong style={{ color:'var(--text-1)' }}>Formato esperado do CSV:</strong><br/>
          Colunas: <code style={{ fontFamily:'var(--mono)', background:'var(--surface-4)', padding:'1px 5px', borderRadius:3 }}>nome, telefone, email, cpf</code><br/>
          Separador: ponto-e-vírgula (;) ou vírgula (,)<br/>
          Primeira linha deve ser o cabeçalho
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-group" style={{ marginBottom:16 }}>
          <label className="form-label">Selecionar arquivo .csv</label>
          <input type="file" accept=".csv,.txt" onChange={handleFile}
            style={{ fontSize:13, color:'var(--text-1)', padding:'8px 0' }} />
        </div>

        {preview.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8, textTransform:'uppercase', letterSpacing:'.06em' }}>
              Preview — {rows.length} cliente{rows.length !== 1 ? 's' : ''} encontrado{rows.length !== 1 ? 's' : ''}
            </div>
            <div style={{ background:'var(--surface-3)', borderRadius:'var(--r-md)', overflow:'hidden' }}>
              {preview.map((r, i) => (
                <div key={i} style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', fontSize:12, display:'flex', gap:12 }}>
                  <span style={{ fontWeight:500, flex:1, color:'var(--text-1)' }}>{r.name}</span>
                  <span style={{ fontFamily:'var(--mono)', color:'var(--text-3)' }}>{r.phone}</span>
                  <span style={{ color:'var(--text-3)' }}>{r.email}</span>
                </div>
              ))}
              {rows.length > 5 && (
                <div style={{ padding:'8px 12px', fontSize:11, color:'var(--text-3)' }}>
                  + {rows.length - 5} mais...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleImport} disabled={saving || rows.length === 0}>
            {saving ? 'Importando...' : `Importar ${rows.length} cliente${rows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name:'', phone:'', email:'', document:'', notes:'', amount:'', due_date:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [addPayment, setAddPayment] = useState(true);
  const set = f => e => setForm(x => ({ ...x, [f]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError('Nome e telefone são obrigatórios.'); return; }
    if (addPayment && (!form.amount || !form.due_date)) { setError('Informe valor e vencimento.'); return; }
    setSaving(true); setError(null);
    try {
      const p = { name:form.name, phone:form.phone, email:form.email, document:form.document, notes:form.notes };
      if (addPayment) { p.amount=form.amount; p.due_date=form.due_date; p.description=form.description; }
      await api.createCustomer(p);
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Novo cliente</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Nome *</label>
              <input className="form-input" placeholder="João Silva" value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp *</label>
              <input className="form-input" placeholder="(11) 99999-9999" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="joao@email.com" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">CPF / CNPJ</label>
              <input className="form-input" placeholder="000.000.000-00" value={form.document} onChange={set('document')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <input className="form-input" placeholder="Notas internas sobre o cliente" value={form.notes} onChange={set('notes')} />
          </div>
          <div className="divider" />
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13, color:'var(--text-2)' }}>
            <input type="checkbox" checked={addPayment} onChange={e => setAddPayment(e.target.checked)} />
            Criar cobrança agora
          </label>
          {addPayment && (
            <>
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
            </>
          )}
        </div>
        <div className="form-actions" style={{ marginTop:22 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer Detail ───────────────────────────────────────────────────────────
function CustomerDetail({ customerId, onBack }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [editForm, setEditForm] = useState({});

  const load = useCallback(() => {
    api.getCustomer(customerId).then(c => { setCustomer(c); setLoading(false); });
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (pid, status) => {
    try { await api.updateStatus(pid, status); load(); toastSuccess('Status atualizado'); }
    catch (e) { toastError(e.message); }
  };

  const handleDeletePayment = async (pid) => {
    if (!window.confirm('Remover esta cobrança?')) return;
    try { await api.deletePayment(pid); load(); toastSuccess('Cobrança removida'); }
    catch (e) { toastError(e.message); }
  };

  const handleSaveEdit = async () => {
    try { await api.updateCustomer(customerId, editForm); load(); setEditing(false); toastSuccess('Cliente atualizado'); }
    catch (e) { toastError(e.message); }
  };

  if (loading) return <Skeleton />;
  if (!customer) return null;

  const today    = new Date().toISOString().split('T')[0];
  const received = customer.payments.filter(p => p.status==='paid').reduce((a,p) => a+p.amount, 0);
  const pending  = customer.payments.filter(p => p.status==='pending'||p.status==='overdue').reduce((a,p) => a+p.amount, 0);
  const total    = customer.payments.filter(p => p.status!=='cancelled').reduce((a,p) => a+p.amount, 0);

  return (
    <div>
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>← Voltar</button>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:40, height:40, borderRadius:'50%',
              background:'var(--brand-muted)', border:'1px solid rgba(0,200,150,.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, fontWeight:700, color:'var(--brand)',
            }}>{customer.name.charAt(0).toUpperCase()}</div>
            <div>
              <div className="page-title">{customer.name}</div>
              <div className="page-subtitle">
                {formatPhone(customer.phone)}
                {customer.email ? ` · ${customer.email}` : ''}
                {customer.document ? ` · ${customer.document}` : ''}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(!editing); setEditForm({ name:customer.name, phone:customer.phone, email:customer.email||'', document:customer.document||'', notes:customer.notes||'' }); }}>
            {editing ? 'Cancelar edição' : '✏ Editar'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Nova cobrança</button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="section-title" style={{ marginBottom:14 }}>Editar cliente</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            {[['Nome','name'],['Telefone','phone'],['Email','email'],['CPF/CNPJ','document']].map(([label,field]) => (
              <div className="form-group" key={field}>
                <label className="form-label">{label}</label>
                <input className="form-input" value={editForm[field]||''} onChange={e => setEditForm(x=>({...x,[field]:e.target.value}))} />
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginTop:14 }}>
            <label className="form-label">Observações</label>
            <input className="form-input" value={editForm.notes||''} onChange={e => setEditForm(x=>({...x,notes:e.target.value}))} />
          </div>
          {customer.notes && !editing && (
            <div style={{ marginTop:10, fontSize:12, color:'var(--text-3)', padding:'8px 12px', background:'var(--surface-2)', borderRadius:'var(--r-sm)' }}>
              {customer.notes}
            </div>
          )}
          <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Salvar</button>
          </div>
        </div>
      )}

      {customer.notes && !editing && (
        <div style={{ marginBottom:16, padding:'10px 14px', background:'var(--surface-2)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', fontSize:12, color:'var(--text-2)' }}>
          📝 {customer.notes}
        </div>
      )}

      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(3,1fr)', marginBottom:20 }}>
        <div className="stat-card blue">
          <div className="stat-label">Total cobrado</div>
          <div className="stat-value" style={{ fontSize:20 }}>{formatCurrency(total)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Recebido</div>
          <div className="stat-value" style={{ fontSize:20 }}>{formatCurrency(received)}</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Pendente / Atrasado</div>
          <div className="stat-value" style={{ fontSize:20 }}>{formatCurrency(pending)}</div>
        </div>
      </div>

      <div className="card" style={{ padding:0 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
          <div className="section-title" style={{ marginBottom:0 }}>Cobranças ({customer.payments.length})</div>
        </div>
        {customer.payments.length === 0 ? (
          <div className="empty-state"><div className="empty-title">Nenhuma cobrança</div></div>
        ) : (
          <table>
            <thead>
              <tr><th>Descrição</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>Link Pix</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {customer.payments.map(p => (
                <tr key={p.id} className={p.status==='overdue'||(p.status==='pending'&&p.due_date<today)?'row-overdue':''}>
                  <td style={{ color:'var(--text-2)' }}>{p.description||'—'}</td>
                  <td style={{ fontWeight:600, fontFamily:'var(--mono)', fontSize:12 }}>{formatCurrency(p.amount)}</td>
                  <td style={{ fontFamily:'var(--mono)', fontSize:12 }}>{formatDate(p.due_date)}</td>
                  <td>
                    <select value={p.status} onChange={e => handleStatusChange(p.id, e.target.value)} className={`status-select badge-${p.status}`}>
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="overdue">Vencido</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </td>
                  <td>{p.pix_url ? <a href={p.pix_url} target="_blank" rel="noreferrer" className="pix-link">Abrir ↗</a> : <span style={{ color:'var(--text-3)', fontSize:11 }}>—</span>}</td>
                  <td><button className="btn btn-danger" onClick={() => handleDeletePayment(p.id)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <AddPaymentModal customerId={customerId} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); toastSuccess('Cobrança adicionada'); }} />
      )}
    </div>
  );
}

function AddPaymentModal({ customerId, onClose, onSaved }) {
  const [form, setForm] = useState({ amount:'', due_date:'', description:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = f => e => setForm(x => ({ ...x, [f]: e.target.value }));
  const handleSubmit = async () => {
    if (!form.amount || !form.due_date) { setError('Preencha valor e vencimento.'); return; }
    setSaving(true);
    try { await api.createPayment({ customer_id:customerId, ...form }); onSaved(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Nova cobrança</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
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
            <input className="form-input" placeholder="Ex: Mensalidade abril" value={form.description} onChange={set('description')} />
          </div>
        </div>
        <div className="form-actions" style={{ marginTop:22 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving?'Salvando...':'Adicionar'}</button>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10, padding:16 }}>
      {[1,2,3].map(i => <div key={i} style={{ height:36, background:'var(--surface-3)', borderRadius:6, animation:'pulse 1.5s infinite' }} />)}
    </div>
  );
}
