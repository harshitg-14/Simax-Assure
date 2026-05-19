import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/services';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',           section: 'Overview', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { to: '/budgets',     label: 'Budget Management',    section: 'Overview', restrict: 'finance', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { to: '/commitments', label: 'Commitments',          section: 'Overview', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
  { to: '/expenditure', label: 'Expenditure',          section: 'Overview', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { to: '/assurance',   label: 'Assurance Monitor',    section: 'Control',  restrict: 'finance', badge: 'alerts', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
  { to: '/approvals',   label: 'Approvals',            section: 'Control',  restrict: 'finance', badge: 'approvals', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
  { to: '/reports',     label: 'Reports & Analytics',  section: 'Control',  restrict: 'finance', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { to: '/departments', label: 'Departments',          section: 'Admin',    restrict: 'admin', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { to: '/users',       label: 'User Management',      section: 'Admin',    restrict: 'admin', icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
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
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label-text">{item.label}</span>
                  {item.badge === 'alerts'    && alertCount > 0        && <span className="nav-badge">{alertCount}</span>}
                  {item.badge === 'approvals' && pendingApprovals > 0   && <span className="nav-badge">{pendingApprovals}</span>}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
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
          <div className="u-avatar">{user?.username?.[0] || 'U'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="u-name">{user?.username}</div>
            <div className="u-role">{user?.role?.replace(/_/g, ' ')}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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
