export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

// Q10 — Handle both ISO 8601 ('2024-02-15T00:00:00Z') and SQLite ('2024-02-15 00:00:00')
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  // Normalize: replace space with T, strip everything after the date part
  const datePart = dateStr.replace(' ', 'T').split('T')[0];
  const [y, m, d] = datePart.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

// Q33 — New: formatDateTime includes time
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const normalized = dateStr.replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date)) return dateStr;
  return date.toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

export function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export function statusLabel(status) {
  const map = { pending: 'Pendente', paid: 'Pago', overdue: 'Vencido', cancelled: 'Cancelado' };
  return map[status] || status;
}

export function messageTypeLabel(type) {
  const map = { reminder_before: 'Lembrete', due_today: 'Vence hoje', overdue: 'Em atraso' };
  return map[type] || type;
}

export function isOverdue(payment) {
  if (payment.status !== 'pending') return false;
  const today = new Date().toISOString().split('T')[0];
  return payment.due_date < today;
}

export function daysUntilDue(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Append time so Date parses it as local, not UTC midnight
  const due = new Date(dateStr.split('T')[0] + 'T00:00:00');
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}
