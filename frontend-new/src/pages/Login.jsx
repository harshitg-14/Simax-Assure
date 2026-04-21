// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault(); setError('');
    const result = await login(form.username, form.password);
    if (result.ok) navigate('/dashboard');
    else setError(result.error);
  };

  return (
    <div className="login-page">
      <div className="login-box fade-up">
        <div className="login-logo">
          <div className="login-hex">◈</div>
          <div>
            <div className="login-name">Simax<span>.</span>Assure</div>
            <div className="login-tag">Financial Control Platform</div>
          </div>
        </div>

        <div className="login-title">Sign In</div>
        <div className="login-sub">Enter your credentials to access the platform</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input type="text" required placeholder="e.g. admin" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input type="password" required placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In →'}
          </button>
        </form>

        <div className="login-hint">
          <strong>Credentials:</strong><br/>
          <code>admin</code> / <code>admin123</code> — Admin<br/>
          <code>finance_manager</code> / <code>finance123</code> — Finance Manager<br/>
          <code>marketing_head</code> / <code>mkt123</code> — Dept Head
        </div>
      </div>
    </div>
  );
}
