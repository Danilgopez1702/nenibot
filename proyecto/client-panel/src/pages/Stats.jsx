import React from 'react';
import { useApi } from '../hooks/useApi';

export default function Stats() {
  const { data, loading } = useApi('/stats');
  if (loading) return <div className="loading">Cargando…</div>;
  const k = data?.kpis || {};
  const byDay = data?.by_day || [];
  const maxDay = Math.max(1, ...byDay.map((d) => Number(d.total)));

  return (
    <div data-testid="stats-page">
      <div className="page-title">Estadísticas</div>
      <div className="page-sub">Resumen del mes en curso</div>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">{k.confirmed || 0}</div><div className="l">Confirmadas</div></div>
        <div className="kpi"><div className="v">{k.completed || 0}</div><div className="l">Completadas</div></div>
        <div className="kpi"><div className="v">${Number(k.revenue || 0).toLocaleString('es-MX')}</div><div className="l">Ingresos</div></div>
        <div className="kpi"><div className="v">{k.cancelled || 0}</div><div className="l">Canceladas</div></div>
        <div className="kpi"><div className="v">{k.noshows || 0}</div><div className="l">No-shows</div></div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Destacados</h3>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          Top empleada: <b style={{ color: 'var(--ink)' }}>{data?.top_employee?.name || '—'}</b> ·
          Top servicio: <b style={{ color: 'var(--ink)' }}>{data?.top_service?.name || '—'}</b>
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Citas por día</h3>
        {byDay.length === 0 ? <div className="empty">Sin datos.</div> : byDay.map((d) => (
          <div className="bar-row" key={d.day}>
            <div className="name">Día {d.day}</div>
            <div className="bar" style={{ width: `${(Number(d.total) / maxDay) * 100}%` }} />
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{d.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
