import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { toastSuccess, toastError } from '../lib/toast';

const ROLE_LABELS = { admin: 'Administrador', operator: 'Operador' };

export default function Users({ user }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(() => {
    api.getUsers()
      .then(setUsers)
      .catch(e => { if (e.message.includes('403')) setUsers([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== 'admin') {
    return (
      <div>
        <div className="page-header"><div className="page-title">Usuários</div></div>
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🔒</div>
            <div className="empty-title">Acesso restrito</div>
            <div className="empty-description">Apenas administradores podem gerenciar usuários</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-subtitle">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo usuário</button>
      </div>

      <div className="card" style={{ padding:0 }}>
        {loading ? <Skeleton /> : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">Nenhum usuário encontrado</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Usuário</th><th>Email</th><th>Perfil</th><th>Cadastro</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{
                        width:30, height:30, borderRadius:'50%',
                        background: u.role === 'admin' ? 'var(--brand-muted)' : 'var(--surface-3)',
                        border: `1px solid ${u.role === 'admin' ? 'rgba(0,200,150,.2)' : 'var(--border)'}`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:11, fontWeight:700,
                        color: u.role === 'admin' ? 'var(--brand)' : 'var(--text-2)',
                      }}>{u.name.charAt(0).toUpperCase()}</div>
                      <span style={{ fontWeight:500 }}>{u.name}</span>
                      {u.id === user.id && (
                        <span style={{ fontSize:10, padding:'1px 6px', background:'var(--brand-muted)', color:'var(--brand)', borderRadius:99 }}>você</span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontSize:13, fontFamily:'var(--mono)', color:'var(--text-2)' }}>{u.email}</td>
                  <td>
                    <span style={{
                      fontSize:10, fontWeight:600, padding:'3px 9px', borderRadius:99,
                      background: u.role === 'admin' ? 'var(--brand-muted)' : 'var(--surface-3)',
                      color: u.role === 'admin' ? 'var(--brand)' : 'var(--text-2)',
                    }}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ fontSize:12, color:'var(--text-3)' }}>
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Roles explanation */}
      <div className="card" style={{ marginTop:16 }}>
        <div className="section-title" style={{ marginBottom:14 }}>Perfis de acesso</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            { role:'Administrador', desc:'Acesso total: clientes, cobranças, relatórios, configurações, usuários', color:'var(--brand)' },
            { role:'Operador', desc:'Pode criar e visualizar clientes e cobranças. Não acessa usuários nem configurações', color:'var(--text-2)' },
          ].map(r => (
            <div key={r.role} style={{
              padding:'14px 16px', background:'var(--surface-2)',
              border:'1px solid var(--border)', borderRadius:'var(--r-md)',
            }}>
              <div style={{ fontWeight:600, fontSize:13, color:r.color, marginBottom:6 }}>{r.role}</div>
              <div style={{ fontSize:12, color:'var(--text-3)', lineHeight:1.5 }}>{r.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <AddUserModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); toastSuccess('Usuário criado com sucesso'); }}
        />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ name:'', email:'', password:'', role:'operator' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const set = f => e => setForm(x => ({ ...x, [f]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.password) { setError('Todos os campos são obrigatórios'); return; }
    if (form.password.length < 6) { setError('Senha deve ter mínimo 6 caracteres'); return; }
    setSaving(true);
    try { await api.createUser(form); onSaved(); }
    catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Novo usuário</div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div className="form-group">
            <label className="form-label">Nome *</label>
            <input className="form-input" placeholder="João Silva" value={form.name} onChange={set('name')} />
          </div>
          <div className="form-group">
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" placeholder="joao@empresa.com" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-group">
            <label className="form-label">Senha *</label>
            <input className="form-input" type="password" placeholder="mínimo 6 caracteres" value={form.password} onChange={set('password')} />
          </div>
          <div className="form-group">
            <label className="form-label">Perfil</label>
            <select className="form-input" value={form.role} onChange={set('role')}>
              <option value="operator">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
        </div>
        <div className="form-actions" style={{ marginTop:22 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Criando...' : 'Criar usuário'}
          </button>
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
