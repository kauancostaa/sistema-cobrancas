import React, { useState } from 'react';
import { api } from '../lib/api';

export default function Login({ onLogin }) {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);
  const set = f => e => setForm(x => ({ ...x, [f]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const data = await api.login(form);
      localStorage.setItem('token', data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #F0F0FF 0%, #F8F8FB 50%, #FFF0F8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        position: 'fixed', top: '-10%', right: '-5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', left: '-5%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: '#fff',
        border: '1px solid rgba(0,0,0,.08)',
        borderRadius: 20,
        padding: '44px 40px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 20px 60px rgba(0,0,0,.08)',
        position: 'relative',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff',
            margin: '0 auto 16px',
            boxShadow: '0 4px 16px rgba(99,102,241,.3)',
          }}>✦</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F0F1A', letterSpacing: '-.03em' }}>
            Cobranças
          </div>
          <div style={{ fontSize: 13, color: '#9898B0', marginTop: 4 }}>
            Entre na sua conta
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="admin@empresa.com"
                value={form.email}
                onChange={set('email')}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4, padding: '11px' }}
            >
              {loading ? 'Entrando...' : 'Entrar →'}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: 24, padding: '12px 14px',
          background: '#F8F8FB', borderRadius: 10,
          fontSize: 11, color: '#9898B0', textAlign: 'center',
          border: '1px solid rgba(0,0,0,.06)',
        }}>
          Acesso padrão: <strong style={{ color: '#5C5C7A' }}>admin@empresa.com</strong> / <strong style={{ color: '#5C5C7A' }}>admin123</strong>
        </div>
      </div>
    </div>
  );
}