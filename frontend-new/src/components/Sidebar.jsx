import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/services';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',           section: 'Overview' },
  { to: '/budgets',     label: 'Budget Management',    section: 'Overview', restrict: 'finance' },
  { to: '/commitments', label: 'Commitments',          section: 'Overview' },
  { to: '/expenditure', label: 'Expenditure',          section: 'Overview' },
  { to: '/assurance',   label: 'Assurance Monitor',    section: 'Control',  restrict: 'finance', badge: 'alerts' },
  { to: '/approvals',   label: 'Approvals',            section: 'Control',  restrict: 'finance', badge: 'approvals' },
  { to: '/reports',     label: 'Reports & Analytics',  section: 'Control',  restrict: 'finance' },
  { to: '/departments', label: 'Departments',          section: 'Admin',    restrict: 'admin' },
  { to: '/users',       label: 'User Management',      section: 'Admin',    restrict: 'admin' },
];

export default function Sidebar({ alertCount = 0, pendingApprovals = 0 }) {
  const { user, logout, isAdmin, isFinanceManager, selectedYear, changeYear } = useAuth();
  const navigate = useNavigate();
  const [fyOpen, setFyOpen]     = useState(false);
  const [pwOpen, setPwOpen]     = useState(false);
  const [pwForm, setPwForm]     = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]       = useState('');
  const [pwOk, setPwOk]         = useState(false);
  const [pwBusy, setPwBusy]     = useState(false);
  const years = [2023, 2024, 2025, 2026];

  const submitPw = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwMsg('Passwords do not match.'); return; }
    if (pwForm.next.length < 4)         { setPwMsg('Min 4 characters.');        return; }
    setPwBusy(true); setPwMsg('');
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwOk(true);
      setPwForm({ current: '', next: '', confirm: '' });
      setTimeout(() => { setPwOpen(false); setPwOk(false); }, 1500);
    } catch (err) {
      setPwMsg(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setPwBusy(false);
    }
  };

  const canSee = (item) => {
    if (!item.restrict) return true;
    if (item.restrict === 'admin')   return isAdmin;
    if (item.restrict === 'finance') return isAdmin || isFinanceManager;
    return true;
  };

  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];

  return (
    <>
    <aside className="sidebar">
      <div className="logo-area">
        <div className="logo-mark">
          <div className="logo-text">
            <div className="logo-name">  Simax<span className="accent">  Assure</span></div>
            <div className="logo-tag">Financial Intelligence</div>
          </div>
        </div>
      </div>

      <nav className="nav-body">
        {sections.map(section => {
          const items = NAV_ITEMS.filter(i => i.section === section && canSee(i));
          if (!items.length) return null;
          return (
            <div className="nav-section" key={section}>
              <div className="nav-label">{section}</div>
              {items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="nav-dot" />
                  {item.label}
                  {item.badge === 'alerts'    && alertCount > 0        && <span className="nav-badge">{alertCount}</span>}
                  {item.badge === 'approvals' && pendingApprovals > 0   && <span className="nav-badge">{pendingApprovals}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        {/* Role */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 10px', marginBottom: 8,
          background: 'var(--surface2)', borderRadius: 6, border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>ROLE</span>
          <span style={{
            fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 500,
            padding: '2px 6px', borderRadius: 3,
            background: 'var(--surface3)', color: 'var(--text2)',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {user?.role?.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Fiscal Year */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div className="fy-selector" onClick={() => setFyOpen(!fyOpen)} style={{ cursor: 'pointer' }}>
            <div>
              <div className="fy-label">Fiscal Year</div>
              <div className="fy-val">FY {selectedYear}</div>
            </div>
            <span className="fy-caret" style={{ transform: fyOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>
              &#9660;
            </span>
          </div>
          {fyOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 6, overflow: 'hidden', zIndex: 999,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
            }}>
              {years.map(yr => (
                <div
                  key={yr}
                  onClick={() => { changeYear(yr); setFyOpen(false); }}
                  style={{
                    padding: '9px 14px', cursor: 'pointer', fontSize: 12,
                    fontFamily: 'var(--mono)', fontWeight: yr === selectedYear ? 600 : 400,
                    color: yr === selectedYear ? 'var(--accent2)' : 'var(--text2)',
                    background: yr === selectedYear ? 'var(--accent-dim)' : 'transparent',
                    display: 'flex', justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  FY {yr}
                  {yr === selectedYear && <span style={{ fontSize: 10 }}>&#10003;</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User chip — click to open change password */}
        <div
          className="user-chip"
          style={{ marginBottom: 8, cursor: 'pointer' }}
          onClick={() => { setPwOpen(true); setPwMsg(''); setPwOk(false); }}
          title="Change password"
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u-name">{user?.username}</div>
            <div className="u-role">{user?.email || `${user?.username}@simax.com`}</div>
          </div>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </div>

        <button
          className="signout-btn"
          onClick={() => { logout(); navigate('/login'); }}
        >
          Sign Out
        </button>
      </div>
    </aside>

    {/* Change Password Modal */}
    {pwOpen && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, backdropFilter: 'blur(3px)',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 12, padding: 32, width: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'fadeUp 0.2s ease',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Change Password</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 22 }}>
            Signed in as <span style={{ color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{user?.username}</span>
          </div>

          {pwOk ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--success)', fontWeight: 600, fontSize: 13 }}>
              Password changed successfully
            </div>
          ) : (
            <form onSubmit={submitPw}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 20 }}>
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" required placeholder="Enter current password"
                    value={pwForm.current}
                    onChange={e => setPwForm({ ...pwForm, current: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" required placeholder="Min 4 characters"
                    value={pwForm.next}
                    onChange={e => setPwForm({ ...pwForm, next: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" required placeholder="Repeat new password"
                    value={pwForm.confirm}
                    onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })} />
                </div>
              </div>

              {pwMsg && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{pwMsg}</div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setPwOpen(false); setPwForm({ current: '', next: '', confirm: '' }); setPwMsg(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={pwBusy}>
                  {pwBusy ? 'Saving...' : 'Change Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )}
    </>
  );
}
