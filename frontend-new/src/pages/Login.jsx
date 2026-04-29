import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [form, setForm]   = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy]   = useState(false);
  const { login }         = useAuth();
  const navigate          = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const result = await login(form.username, form.password);
    if (result.ok) navigate('/dashboard');
    else { setError(result.error); setBusy(false); }
  };

  return (
    <div className="login-page">
      <div className="login-box fade-up">
        <div className="login-logo">
          <div className="login-monogram">SA</div>
          <div>
            <div className="login-name">Simax<span>Assure</span></div>
            <div className="login-tag">Financial Intelligence Platform</div>
          </div>
        </div>

        <div className="login-title">Sign In</div>
        <div className="login-sub">Enter your credentials to continue.</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Username</label>
            <input
              type="text" required placeholder="e.g. admin"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Password</label>
            <input
              type="password" required placeholder="Enter password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="login-hint">
          <strong>Demo Credentials</strong><br />
          <code>admin</code> / <code>admin123</code> &mdash; Administrator<br />
          <code>finance_manager</code> / <code>finance123</code> &mdash; Finance Manager<br />
          <code>marketing_head</code> / <code>mkt123</code> &mdash; Department Head
        </div>
      </div>
    </div>
  );
}
