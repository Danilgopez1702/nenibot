import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/login', { password });
      localStorage.setItem('admin_token', data.token);
      nav('/tenants');
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Citas<span style={{ color: 'var(--accent)' }}>.</span>OS</h1>
        <p>Panel del operador</p>
        {error && <div className="error-msg" data-testid="login-error">{error}</div>}
        <div className="field">
          <label>Contraseña de operador</label>
          <input
            className="input" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} data-testid="admin-password-input"
            placeholder="••••••••"
          />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading} data-testid="admin-login-btn">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
