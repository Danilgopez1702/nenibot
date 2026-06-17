import React from 'react';
import { useApi } from '../hooks/useApi';

export default function Costs() {
  const { data, loading } = useApi('/costs');

  const totalAi = (data || []).reduce((s, r) => s + Number(r.ai_cost_usd || 0), 0);
  const totalConv = (data || []).reduce((s, r) => s + Number(r.wa_conversations || 0), 0);

  return (
    <div data-testid="costs-page">
      <div className="page-title">Costos</div>
      <div className="page-sub">Uso de IA (Claude) y conversaciones de WhatsApp por tenant</div>

      <div className="kpi-grid">
        <div className="kpi"><div className="v">${totalAi.toFixed(2)}</div><div className="l">Costo IA total (mes)</div></div>
        <div className="kpi"><div className="v">{totalConv}</div><div className="l">Conversaciones WhatsApp</div></div>
        <div className="kpi"><div className="v">{(data || []).length}</div><div className="l">Tenants con actividad</div></div>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando…</div> : (
          <table>
            <thead>
              <tr><th>Negocio</th><th>Mes</th><th>Costo IA</th><th>Tokens in/out</th><th>Conversaciones</th></tr>
            </thead>
            <tbody>
              {(data || []).map((r, i) => (
                <tr key={i}>
                  <td>{r.business_name}</td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(r.month).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })}</td>
                  <td>${Number(r.ai_cost_usd).toFixed(4)}</td>
                  <td style={{ color: 'var(--muted)' }}>{r.total_input_tokens} / {r.total_output_tokens}</td>
                  <td>{r.wa_conversations}</td>
                </tr>
              ))}
              {(!data || !data.length) && <tr><td colSpan="5" className="empty">Sin datos de costos aún.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
