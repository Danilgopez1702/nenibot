import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';

export default function TenantDetail() {
  const { id } = useParams();
  const { data, loading } = useApi(`/tenants/${id}`);

  if (loading) return <div className="loading">Cargando…</div>;
  if (!data) return <div className="empty">No encontrado.</div>;

  const { tenant, config, features, services, employees, templates } = data;

  return (
    <div data-testid="tenant-detail-page">
      <Link to="/tenants" className="nav-link" style={{ display: 'inline-block', marginBottom: 16 }}>← Negocios</Link>
      <div className="page-title">{tenant.business_name}</div>
      <div className="page-sub">{tenant.business_type} · {config?.timezone}</div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Configuración</h3>
        <table>
          <tbody>
            <tr><td>Asistente</td><td>{config?.bot_name}</td></tr>
            <tr><td>Tono / Emojis</td><td>{config?.bot_tone} · {config?.emoji_level}</td></tr>
            <tr><td>Cancelación mínima</td><td>{config?.cancel_min_hours}h</td></tr>
            <tr><td>No-show threshold</td><td>{config?.noshow_threshold}</td></tr>
            <tr><td>Lista de espera</td><td>{config?.waitlist_enabled ? 'sí' : 'no'}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Servicios ({services?.length || 0})</h3>
        <table>
          <thead><tr><th>Nombre</th><th>Duración</th><th>Precio</th></tr></thead>
          <tbody>
            {(services || []).map((s) => (
              <tr key={s.id}><td>{s.name}</td><td>{s.duration_min} min</td><td>${s.price}</td></tr>
            ))}
            {(!services || !services.length) && <tr><td colSpan="3" className="empty">Sin servicios.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Personal ({employees?.length || 0})</h3>
        <table>
          <tbody>
            {(employees || []).map((e) => (
              <tr key={e.id}><td>{e.name}</td><td><span className={`badge ${e.active ? 'on' : 'off'}`}>{e.active ? 'activa' : 'inactiva'}</span></td></tr>
            ))}
            {(!employees || !employees.length) && <tr><td colSpan="2" className="empty">Sin personal.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 16 }}>Templates ({templates?.length || 0})</h3>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>{templates?.length || 0} plantillas de mensajes configuradas.</div>
      </div>
    </div>
  );
}
