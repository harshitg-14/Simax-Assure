import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const DEMO_USERS = [
  { username: 'admin',           password: 'admin123',   role: 'Administrator',   color: 'var(--danger)'  },
  { username: 'finance_manager', password: 'finance123', role: 'Finance Manager', color: 'var(--accent2)' },
  { username: 'marketing_head',  password: 'mkt123',     role: 'Dept Head',       color: 'var(--accent3)' },
];

export default function Login() {
  const [form, setForm]         = useState({ username: '', password: '' });
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const result = await login(form.username, form.password);
    if (result.ok) navigate('/dashboard');
    else { setError(result.error); setBusy(false); }
  };

  const fillDemo = (u) => {
    setForm({ username: u.username, password: u.password });
    setError('');
  };

  return (
    <div className="login-page">
      <div className="login-bg" />

      <div className="login-box fade-up">

        {/* Brand */}
        <div className="login-logo">
          <div className="login-name">Simax<span>Assure</span></div>
          <div className="login-tag">Financial Intelligence Platform</div>
        </div>

        <div className="login-divider" />

        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to your account to continue.</div>

        {error && (
          <div className="login-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input
              type="text" required placeholder="Enter username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              autoComplete="username"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24, position: 'relative' }}>
            <label>Password</label>
            <input
              type={showPass ? 'text' : 'password'} required placeholder="Enter password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              autoComplete="current-password"
              style={{ paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              className="login-eye"
              tabIndex={-1}
            >
              {showPass ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
            {busy ? (
              <>
                <div className="login-spinner" />
                Signing in...
              </>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Clickable demo credentials */}
        <div className="login-hint">
          <div className="login-hint-label">Quick Access &nbsp;&middot;&nbsp; Click to fill</div>
          <div className="login-hint-list">
            {DEMO_USERS.map(u => (
              <button
                key={u.username}
                type="button"
                className="login-demo-btn"
                onClick={() => fillDemo(u)}
              >
                <span className="login-demo-dot" style={{ background: u.color }} />
                <span className="login-demo-user">{u.username}</span>
                <span className="login-demo-sep">/</span>
                <span className="login-demo-pass">{u.password}</span>
                <span className="login-demo-role">{u.role}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
