import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import api from '../lib/api';

const STATUS_LABELS = { confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', noshow: 'No asistió', locked: 'Apartada' };

export default function Agenda() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data, loading, reload } = useApi(`/appointments?date=${date}`, [date]);

  const setStatus = async (id, status) => {
    await api.patch(`/appointments/${id}/status`, { status });
    reload();
  };

  return (
    <div data-testid="agenda-page">
      <div className="page-title">Agenda</div>
      <div className="page-sub">Citas del día</div>

      <div className="toolbar">
        <input className="input" type="date" style={{ width: 200 }} value={date} onChange={(e) => setDate(e.target.value)} data-testid="agenda-date" />
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(today)}>Hoy</button>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando…</div> : (
          <table>
            <thead><tr><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Empleada</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {(data || []).map((a) => (
                <tr key={a.id} data-testid={`appt-row-${a.id}`}>
                  <td>{new Date(a.starts_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{a.client_name || a.client_phone}</td>
                  <td>{a.service_name_snapshot || '—'} {a.service_price_snapshot ? `· $${a.service_price_snapshot}` : ''}</td>
                  <td>{a.employee_name_snapshot || '—'}</td>
                  <td><span className={`badge ${a.status}`}>{STATUS_LABELS[a.status] || a.status}</span></td>
                  <td>
                    {a.status === 'confirmed' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setStatus(a.id, 'completed')} data-testid={`complete-${a.id}`}>Completar</button>{' '}
                        <button className="btn btn-ghost btn-sm" onClick={() => setStatus(a.id, 'noshow')}>No asistió</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {(!data || !data.length) && <tr><td colSpan="6" className="empty">Sin citas este día.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
