import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Agenda from './pages/Agenda.jsx';
import Clients from './pages/Clients.jsx';
import Config from './pages/Config.jsx';
import Stats from './pages/Stats.jsx';

function RequireAuth({ children }) {
  const token = localStorage.getItem('client_token');
  return token ? children : <Navigate to="/login" replace />;
}

function Shell({ children }) {
  const nav = useNavigate();
  const name = localStorage.getItem('business_name') || 'Mi Negocio';
  const logout = () => { localStorage.removeItem('client_token'); nav('/login'); };
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">{name}</div>
        <div className="brand-sub">Panel del negocio</div>
        <NavLink to="/agenda" className="nav-link" data-testid="nav-agenda">Agenda</NavLink>
        <NavLink to="/clientes" className="nav-link" data-testid="nav-clients">Clientes</NavLink>
        <NavLink to="/config" className="nav-link" data-testid="nav-config">Configuración</NavLink>
        <NavLink to="/stats" className="nav-link" data-testid="nav-stats">Estadísticas</NavLink>
        <div className="logout" onClick={logout} data-testid="logout-btn">Cerrar sesión</div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/agenda" element={<RequireAuth><Shell><Agenda /></Shell></RequireAuth>} />
      <Route path="/clientes" element={<RequireAuth><Shell><Clients /></Shell></RequireAuth>} />
      <Route path="/config" element={<RequireAuth><Shell><Config /></Shell></RequireAuth>} />
      <Route path="/stats" element={<RequireAuth><Shell><Stats /></Shell></RequireAuth>} />
      <Route path="*" element={<Navigate to="/agenda" replace />} />
    </Routes>
  );
}
