import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toastSuccess, toastError } from '../lib/toast';

export default function Settings({ user }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [pwForm, setPwForm]     = useState({ current_password:'', new_password:'', confirm:'' });
  const [pwError, setPwError]   = useState(null);
  const set = f => e => setSettings(x => ({ ...x, [f]: e.target.value }));

  useEffect(() => {
    api.getSettings().then(s => { setSettings(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try { await api.saveSettings(settings); toastSuccess('Configurações salvas'); }
    catch (e) { toastError(e.message); } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Senhas não coincidem'); return; }
    if (pwForm.new_password.length < 6) { setPwError('Mínimo 6 caracteres'); return; }
    try {
      await api.changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      toastSuccess('Senha alterada com sucesso');
      setPwForm({ current_password:'', new_password:'', confirm:'' });
      setPwError(null);
    } catch (e) { setPwError(e.message); }
  };

  if (loading) return <div style={{ color: 'var(--text-3)', padding: 32 }}>Carregando...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Configurações</div>
          <div className="page-subtitle">Dados da empresa e preferências do sistema</div>
        </div>
      </div>

      {/* Company Settings */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 18 }}>Dados da empresa</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Nome da empresa</label>
            <input className="form-input" value={settings.company_name||''} onChange={set('company_name')} placeholder="Minha Empresa" />
          </div>
          <div className="form-group">
            <label className="form-label">Chave Pix</label>
            <input className="form-input" value={settings.pix_key||''} onChange={set('pix_key')} placeholder="email, CPF ou CNPJ" />
          </div>
          <div className="form-group">
            <label className="form-label">Email da empresa</label>
            <input className="form-input" type="email" value={settings.company_email||''} onChange={set('company_email')} placeholder="contato@empresa.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Telefone da empresa</label>
            <input className="form-input" value={settings.company_phone||''} onChange={set('company_phone')} placeholder="(11) 99999-9999" />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div className="form-group" style={{ maxWidth: 300 }}>
            <label className="form-label">Avisar quando vencer em X dias</label>
            <input className="form-input" type="number" min="1" max="30" value={settings.overdue_days_to_notify||'1'} onChange={set('overdue_days_to_notify')} />
          </div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ marginBottom: 18 }}>Alterar senha</div>
        {pwError && <div className="alert alert-error">{pwError}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 }}>
          <div className="form-group">
            <label className="form-label">Senha atual</label>
            <input className="form-input" type="password" value={pwForm.current_password}
              onChange={e => setPwForm(x=>({...x,current_password:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Nova senha</label>
            <input className="form-input" type="password" value={pwForm.new_password}
              onChange={e => setPwForm(x=>({...x,new_password:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar nova senha</label>
            <input className="form-input" type="password" value={pwForm.confirm}
              onChange={e => setPwForm(x=>({...x,confirm:e.target.value}))} />
          </div>
          <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={handleChangePassword}>
            Alterar senha
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 14 }}>Sua conta</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--brand-muted)', border: '1px solid rgba(0,200,150,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--brand)',
          }}>{user?.name?.charAt(0)?.toUpperCase()}</div>
          <div>
            <div style={{ fontWeight: 500 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.email} · {user?.role}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
