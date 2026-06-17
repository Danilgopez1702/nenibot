import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';
import api from '../lib/api';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function ServicesTab() {
  const { data, loading, reload } = useApi('/config/services');
  const [form, setForm] = useState({ name: '', duration_min: 30, price: 0 });

  const add = async () => {
    if (!form.name) return;
    await api.post('/config/services', form);
    setForm({ name: '', duration_min: 30, price: 0 });
    reload();
  };
  const remove = async (id) => { await api.delete(`/config/services/${id}`); reload(); };

  if (loading) return <div className="loading">Cargando…</div>;
  return (
    <div className="card">
      <div className="toolbar">
        <input className="input" style={{ width: 200 }} placeholder="Servicio" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="service-name" />
        <input className="input" style={{ width: 110 }} type="number" placeholder="min" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: +e.target.value })} data-testid="service-duration" />
        <input className="input" style={{ width: 110 }} type="number" placeholder="precio" value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} data-testid="service-price" />
        <button className="btn btn-primary btn-sm" onClick={add} data-testid="service-add">Agregar</button>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Duración</th><th>Precio</th><th></th></tr></thead>
        <tbody>
          {(data || []).filter((s) => s.active).map((s) => (
            <tr key={s.id}><td>{s.name}</td><td>{s.duration_min} min</td><td>${s.price}</td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => remove(s.id)}>Eliminar</button></td></tr>
          ))}
          {(!data || !data.length) && <tr><td colSpan="4" className="empty">Sin servicios.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function HoursTab() {
  const { data, loading, reload } = useApi('/config/hours');
  const save = async (h) => {
    await api.put(`/config/hours/${h.weekday}`, h);
    reload();
  };
  if (loading) return <div className="loading">Cargando…</div>;
  return (
    <div className="card">
      <table>
        <thead><tr><th>Día</th><th>Abierto</th><th>Apertura</th><th>Cierre</th><th></th></tr></thead>
        <tbody>
          {[...(data || [])].sort((a, b) => a.weekday - b.weekday).map((h) => (
            <HourRow key={h.weekday} h={h} onSave={save} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HourRow({ h, onSave }) {
  const [row, setRow] = useState(h);
  return (
    <tr>
      <td>{DAYS[row.weekday]}</td>
      <td><input type="checkbox" checked={!!row.is_open} onChange={(e) => setRow({ ...row, is_open: e.target.checked })} /></td>
      <td><input className="input" style={{ width: 110 }} type="time" value={row.open_time?.slice(0, 5) || ''} onChange={(e) => setRow({ ...row, open_time: e.target.value })} /></td>
      <td><input className="input" style={{ width: 110 }} type="time" value={row.close_time?.slice(0, 5) || ''} onChange={(e) => setRow({ ...row, close_time: e.target.value })} /></td>
      <td><button className="btn btn-ghost btn-sm" onClick={() => onSave(row)}>Guardar</button></td>
    </tr>
  );
}

function StaffTab() {
  const { data, loading, reload } = useApi('/config/employees');
  const toggle = async (e) => { await api.put(`/config/employees/${e.id}`, { active: !e.active }); reload(); };
  if (loading) return <div className="loading">Cargando…</div>;
  return (
    <div className="card">
      <table>
        <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {(data || []).map((e) => (
            <tr key={e.id}><td>{e.name}</td>
              <td><span className={`badge ${e.active ? 'confirmed' : 'cancelled'}`}>{e.active ? 'Activa' : 'Inactiva'}</span></td>
              <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(e)}>{e.active ? 'Desactivar' : 'Activar'}</button></td></tr>
          ))}
          {(!data || !data.length) && <tr><td colSpan="3" className="empty">Sin personal.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function Config() {
  const [tab, setTab] = useState('services');
  return (
    <div data-testid="config-page">
      <div className="page-title">Configuración</div>
      <div className="page-sub">Servicios, horarios y personal</div>
      <div className="tabs">
        <div className={`tab ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')} data-testid="tab-services">Servicios</div>
        <div className={`tab ${tab === 'hours' ? 'active' : ''}`} onClick={() => setTab('hours')} data-testid="tab-hours">Horarios</div>
        <div className={`tab ${tab === 'staff' ? 'active' : ''}`} onClick={() => setTab('staff')} data-testid="tab-staff">Personal</div>
      </div>
      {tab === 'services' && <ServicesTab />}
      {tab === 'hours' && <HoursTab />}
      {tab === 'staff' && <StaffTab />}
    </div>
  );
}
