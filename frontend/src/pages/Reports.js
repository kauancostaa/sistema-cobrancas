import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [byMonth, setByMonth] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to)   params.to   = to;
      const data = await api.getReportSummary(Object.keys(params).length ? params : undefined);
      setSummary(data.summary);
      setByMonth(data.byMonth || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const maxReceived = Math.max(...byMonth.map(m => m.received), 1);

  const handleExportCsv = () => {
    const params = {};
    if (from) params.from = from;
    if (to)   params.to   = to;
    window.open(api.exportCsv(params), '_blank');
  };

  const handleExportPdf = () => {
    const params = {};
    if (from) params.from = from;
    if (to)   params.to   = to;
    window.open(api.exportPdf(params), '_blank');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-subtitle">Análise financeira e exportações</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleExportCsv}>↓ CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={handleExportPdf}>↓ PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="form-group">
          <label className="form-label">De</label>
          <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Até</label>
          <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" onClick={load}>Filtrar</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); setTimeout(load, 50); }}>Limpar</button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card blue">
            <div className="stat-label">Total cobranças</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{summary.total_payments}</div>
          </div>
          <div className="stat-card green">
            <div className="stat-label">Total recebido</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{formatCurrency(summary.total_received)}</div>
            <div className="stat-count">{summary.count_paid} pagas</div>
          </div>
          <div className="stat-card amber">
            <div className="stat-label">Pendente</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{formatCurrency(summary.total_pending)}</div>
          </div>
          <div className="stat-card red">
            <div className="stat-label">Em atraso</div>
            <div className="stat-value" style={{ fontSize: 22 }}>{formatCurrency(summary.total_overdue)}</div>
            <div className="stat-count">{summary.count_overdue} cobranças</div>
          </div>
        </div>
      )}

      {/* Monthly chart */}
      {byMonth.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Recebimentos por mês</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 4px' }}>
            {byMonth.map(m => {
              const pct = Math.round((m.received / maxReceived) * 100);
              const [year, month] = m.month.split('-');
              const label = new Date(year, month-1).toLocaleDateString('pt-BR', { month:'short' });
              return (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>
                    {formatCurrency(m.received).replace('R$\u00a0','').replace(',00','')}
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 100 }}>
                    <div style={{
                      width: '100%', height: `${Math.max(pct, 4)}%`,
                      background: 'var(--brand)',
                      borderRadius: '4px 4px 0 0',
                      opacity: .85,
                      transition: 'height .4s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'capitalize' }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 14 }}>Exportar dados</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 200,
            padding: '16px 20px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Exportar CSV</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
              Planilha compatível com Excel e Google Sheets. Ideal para contabilidade.
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleExportCsv}>Baixar .csv</button>
          </div>
          <div style={{
            flex: 1, minWidth: 200,
            padding: '16px 20px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Exportar PDF</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
              Relatório formatado para impressão. Abre no browser e imprime.
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleExportPdf}>Baixar PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
}
