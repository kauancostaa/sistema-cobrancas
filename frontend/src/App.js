import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Dashboard    from './pages/Dashboard';
import Customers    from './pages/Customers';
import Payments     from './pages/Payments';
import Messages     from './pages/Messages';
import Recurrences  from './pages/Recurrences';
import Reports      from './pages/Reports';
import Settings     from './pages/Settings';
import Users        from './pages/Users';
import Login        from './pages/Login';
import { registerToastSetter } from './lib/toast';
import { api } from './lib/api';
import { formatCurrency } from './lib/utils';
import './App.css';

const NAV = [
  { path: '/',            label: 'Dashboard',    icon: '▦' },
  { path: '/customers',   label: 'Clientes',     icon: '◎' },
  { path: '/payments',    label: 'Cobranças',    icon: '⬡' },
  { path: '/recurrences', label: 'Recorrências', icon: '↻' },
  { path: '/reports',     label: 'Relatórios',   icon: '◈' },
  { path: '/messages',    label: 'Mensagens',    icon: '◉' },
];

const NAV_BOTTOM = [
  { path: '/users',    label: 'Usuários',       icon: '👥' },
  { path: '/settings', label: 'Configurações',  icon: '⚙' },
];

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [user, setUser]     = useState(null);
  const [checking, setChecking] = useState(true);

  registerToastSetter(setToasts);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setChecking(false); return; }
    api.me()
      .then(u => { setUser(u); setChecking(false); })
      .catch(() => { localStorage.removeItem('token'); setChecking(false); });
  }, []);

  if (checking) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--text-3)', fontFamily:'var(--mono)', fontSize:12 }}>...</div>
    </div>
  );

  if (!user) return <Login onLogin={setUser} />;

  const handleLogout = () => { localStorage.removeItem('token'); setUser(null); };

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">✦</div>
            <div>
              <div className="logo-name">Cobranças</div>
              <div className="logo-sub">v4.0</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            {NAV.map(item => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span style={{ fontSize:13, width:16, textAlign:'center' }}>{item.icon}</span>
                <span>{item.label}</span>
                <span className="nav-dot" />
              </NavLink>
            ))}
            <div style={{ height:1, background:'var(--border)', margin:'8px 4px' }} />
            {NAV_BOTTOM.map(item => (
              <NavLink key={item.path} to={item.path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span style={{ fontSize:13, width:16, textAlign:'center' }}>{item.icon}</span>
                <span>{item.label}</span>
                <span className="nav-dot" />
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{
                width:28, height:28, borderRadius:'50%',
                background:'var(--brand-muted)', border:'1px solid rgba(0,200,150,.2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:'var(--brand)', flexShrink:0,
              }}>{user?.name?.charAt(0)?.toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:500, color:'var(--text-2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.04em' }}>{user?.role}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:11 }}>
              Sair
            </button>
          </div>
        </aside>

        <main className="main-content">
          {/* Global search bar */}
          <GlobalSearch />
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/customers"   element={<Customers />} />
            <Route path="/payments"    element={<Payments />} />
            <Route path="/recurrences" element={<Recurrences />} />
            <Route path="/reports"     element={<Reports />} />
            <Route path="/messages"    element={<Messages />} />
            <Route path="/settings"    element={<Settings user={user} />} />
            <Route path="/users"       element={<Users user={user} />} />
            <Route path="*"            element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <span>{t.type === 'success' ? '✓' : '✕'}</span>
              {t.message}
            </div>
          ))}
        </div>
      </div>
    </BrowserRouter>
  );
}

function GlobalSearch() {
  const [query, setQuery]   = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults(null); setOpen(false); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const customers = await api.getCustomers(query);
        setResults({ customers: customers.slice(0, 6) });
        setOpen(true);
      } catch {} finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(debounce.current);
  }, [query]);

  const clear = () => { setQuery(''); setResults(null); setOpen(false); };

  return (
    <div ref={ref} style={{ position:'relative', marginBottom:24 }}>
      <div style={{ position:'relative' }}>
        <span style={{
          position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
          color:'var(--text-3)', fontSize:13, pointerEvents:'none',
        }}></span>
        <input
          className="form-input"
          style={{ paddingLeft:34, width:'100%', maxWidth:420 }}
          placeholder="Buscar cliente, telefone, email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
        />
        {query && (
          <button onClick={clear} style={{
            position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
            background:'none', border:'none', color:'var(--text-3)', cursor:'pointer', fontSize:14,
          }}>✕</button>
        )}
      </div>

      {open && results && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, width:420,
          background:'var(--surface-2)', border:'1px solid var(--border-hi)',
          borderRadius:'var(--r-lg)', zIndex:500, overflow:'hidden',
          boxShadow:'0 8px 32px rgba(0,0,0,.4)',
        }}>
          {results.customers.length === 0 ? (
            <div style={{ padding:'16px', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
              Nenhum resultado para "{query}"
            </div>
          ) : (
            <>
              <div style={{ padding:'8px 12px 4px', fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.06em' }}>
                Clientes
              </div>
              {results.customers.map(c => (
                <div key={c.id} onClick={clear} style={{
                  display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  cursor:'pointer', transition:'background .1s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width:30, height:30, borderRadius:'50%', flexShrink:0,
                    background:'var(--brand-muted)', border:'1px solid rgba(0,200,150,.2)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:11, fontWeight:700, color:'var(--brand)',
                  }}>{c.name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:500, fontSize:13, color:'var(--text-1)' }}>{c.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-3)', fontFamily:'var(--mono)' }}>{c.phone}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11, color:'var(--green)', fontFamily:'var(--mono)' }}>{formatCurrency(c.paid_amount)}</div>
                    <div style={{ fontSize:10, color:'var(--text-3)' }}>{c.total_payments} cobranças</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
