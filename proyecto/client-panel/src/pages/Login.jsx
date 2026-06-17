import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Login() {
  const [phoneId, setPhoneId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/login', { phone_number_id: phoneId, password });
      localStorage.setItem('client_token', data.token);
      localStorage.setItem('business_name', data.business_name || 'Mi Negocio');
      nav('/agenda');
    } catch (err) {
      setError(err.response?.data?.message || 'Credenciales inválidas');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Bienvenida 👋</h1>
        <p>Ingresa a tu panel de citas</p>
        {error && <div className="error-msg" data-testid="login-error">{error}</div>}
        <div className="field">
          <label>ID de tu número de WhatsApp</label>
          <input className="input" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} data-testid="client-phoneid-input" placeholder="1234567890" />
        </div>
        <div className="field">
          <label>Contraseña</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="client-password-input" placeholder="••••••••" />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading} data-testid="client-login-btn">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
