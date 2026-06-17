import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import api from '../lib/api';

export default function Tenants() {
  const { data, loading, reload } = useApi('/tenants');
  const nav = useNavigate();

  const toggle = async (e, t) => {
    e.stopPropagation();
    await api.patch(`/tenants/${t.id}/active`, { active: !t.active });
    reload();
  };

  return (
    <div data-testid="tenants-page">
      <div className="page-title">Negocios</div>
      <div className="page-sub">Tenants registrados en la plataforma</div>
      <div className="card">
        {loading ? <div className="loading">Cargando…</div> : (
          <table>
            <thead>
              <tr><th>Negocio</th><th>Giro</th><th>Phone ID</th><th>Provisioning</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {(data || []).map((t) => (
                <tr key={t.id} className="clickable" onClick={() => nav(`/tenants/${t.id}`)} data-testid={`tenant-row-${t.id}`}>
                  <td>{t.business_name}</td>
                  <td>{t.business_type}</td>
                  <td style={{ color: 'var(--muted)' }}>{t.wa_phone_id || '—'}</td>
                  <td><span className="badge warn">{t.provisioning_state || 'n/a'}</span></td>
                  <td><span className={`badge ${t.active ? 'on' : 'off'}`}>{t.active ? 'activo' : 'inactivo'}</span></td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={(e) => toggle(e, t)} data-testid={`toggle-${t.id}`}>
                      {t.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan="6" className="empty">Aún no hay negocios.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
