const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function getToken() { return localStorage.getItem('token'); }

async function request(endpoint, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login:          (d)     => request('/auth/login', { method:'POST', body:JSON.stringify(d) }),
  me:             ()      => request('/auth/me'),
  getUsers:       ()      => request('/auth/users'),
  createUser:     (d)     => request('/auth/users', { method:'POST', body:JSON.stringify(d) }),
  changePassword: (d)     => request('/auth/password', { method:'PATCH', body:JSON.stringify(d) }),

  // Dashboard
  getDashboard:   ()      => request('/dashboard'),
  getMessages:    ()      => request('/dashboard/messages'),

  // Customers
  getCustomers:   (s)     => request(`/customers${s?`?search=${encodeURIComponent(s)}`:''}` ),
  getCustomer:    (id)    => request(`/customers/${id}`),
  createCustomer: (d)     => request('/customers', { method:'POST', body:JSON.stringify(d) }),
  updateCustomer: (id,d)  => request(`/customers/${id}`, { method:'PATCH', body:JSON.stringify(d) }),
  deleteCustomer: (id)    => request(`/customers/${id}`, { method:'DELETE' }),
  importCustomers:(rows)  => request('/customers/import', { method:'POST', body:JSON.stringify({ rows }) }),

  // Payments
  getPayments:    (p)     => { const q=new URLSearchParams(p||{}).toString(); return request(`/payments${q?`?${q}`:''}`) },
  createPayment:  (d)     => request('/payments', { method:'POST', body:JSON.stringify(d) }),
  updateStatus:   (id,s)  => request(`/payments/${id}/status`, { method:'PATCH', body:JSON.stringify({ status:s }) }),
  updatePaymentStatus:(id,s) => request(`/payments/${id}/status`, { method:'PATCH', body:JSON.stringify({ status:s }) }),
  deletePayment:  (id)    => request(`/payments/${id}`, { method:'DELETE' }),

  // Recurrences
  getRecurrences: ()      => request('/recurrences'),
  createRecurrence:(d)    => request('/recurrences', { method:'POST', body:JSON.stringify(d) }),
  toggleRecurrence:(id)   => request(`/recurrences/${id}/toggle`, { method:'PATCH' }),
  deleteRecurrence:(id)   => request(`/recurrences/${id}`, { method:'DELETE' }),

  // Settings
  getSettings:    ()      => request('/settings'),
  saveSettings:   (d)     => request('/settings', { method:'PATCH', body:JSON.stringify(d) }),

  // Reports
  getReportSummary:(p)    => request(`/reports/summary${p?`?${new URLSearchParams(p)}`:''}` ),
  exportCsv:      (p)     => `${BASE}/reports/export/csv?${new URLSearchParams(p)}&token=${getToken()}`,
  exportPdf:      (p)     => `${BASE}/reports/export/pdf?${new URLSearchParams(p)}&token=${getToken()}`,

  // AI
  getAIStatus:    ()      => request('/ai/status'),
  getAIRisk:      ()      => request('/ai/risk'),
  aiChat:         (msg)   => request('/ai/chat', { method:'POST', body:JSON.stringify({ message:msg }) }),
  generateAIMessage:(id)  => request(`/ai/message/${id}`, { method:'POST' }),
};

export default api;
