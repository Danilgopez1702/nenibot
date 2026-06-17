import React from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Tenants from './pages/Tenants.jsx';
import TenantDetail from './pages/TenantDetail.jsx';
import Costs from './pages/Costs.jsx';

function RequireAuth({ children }) {
  const token = localStorage.getItem('admin_token');
  return token ? children : <Navigate to="/login" replace />;
}

function Shell({ children }) {
  const nav = useNavigate();
  const logout = () => { localStorage.removeItem('admin_token'); nav('/login'); };
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Citas<span>.</span>OS</div>
        <div className="brand-sub">Panel Operador</div>
        <NavLink to="/tenants" className="nav-link" data-testid="nav-tenants">Negocios</NavLink>
        <NavLink to="/costs" className="nav-link" data-testid="nav-costs">Costos</NavLink>
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
      <Route path="/tenants" element={<RequireAuth><Shell><Tenants /></Shell></RequireAuth>} />
      <Route path="/tenants/:id" element={<RequireAuth><Shell><TenantDetail /></Shell></RequireAuth>} />
      <Route path="/costs" element={<RequireAuth><Shell><Costs /></Shell></RequireAuth>} />
      <Route path="*" element={<Navigate to="/tenants" replace />} />
    </Routes>
  );
}
