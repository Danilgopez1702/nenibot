import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import api from '../lib/api';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, loading, reload } = useApi(`/clients?search=${encodeURIComponent(q)}`, [q]);

  const toggleBlock = async (c) => {
    await api.patch(`/clients/${c.id}/blocked`, { blocked: !c.blocked });
    reload();
  };

  return (
    <div data-testid="clients-page">
      <div className="page-title">Clientes</div>
      <div className="page-sub">Directorio de clientes</div>

      <div className="toolbar">
        <input className="input" style={{ width: 280 }} placeholder="Buscar por nombre o teléfono…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="client-search" />
        <button className="btn btn-primary btn-sm" onClick={() => setQ(search)}>Buscar</button>
      </div>

      <div className="card">
        {loading ? <div className="loading">Cargando…</div> : (
          <table>
            <thead><tr><th>Nombre</th><th>Teléfono</th><th>Citas</th><th>No-shows</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {(data?.clients || []).map((c) => (
                <tr key={c.id} data-testid={`client-row-${c.id}`}>
                  <td>{c.name || '—'}</td>
                  <td>{c.phone}</td>
                  <td>{c.total_bookings}</td>
                  <td>{c.noshow_count}</td>
                  <td><span className={`badge ${c.blocked ? 'cancelled' : 'confirmed'}`}>{c.blocked ? 'Bloqueado' : 'Activo'}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => toggleBlock(c)} data-testid={`block-${c.id}`}>{c.blocked ? 'Desbloquear' : 'Bloquear'}</button></td>
                </tr>
              ))}
              {(!data?.clients || !data.clients.length) && <tr><td colSpan="6" className="empty">Sin clientes.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
