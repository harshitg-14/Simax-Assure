import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Dashboard',           section: 'Overview' },
  { to: '/budgets',     label: 'Budget Management',    section: 'Overview', restrict: 'finance' },
  { to: '/commitments', label: 'Commitments',          section: 'Overview' },
  { to: '/expenditure', label: 'Expenditure',          section: 'Overview' },
  { to: '/assurance',   label: 'Assurance Monitor',    section: 'Control',  restrict: 'finance', badge: true },
  { to: '/reports',     label: 'Reports & Analytics',  section: 'Control',  restrict: 'finance' },
  { to: '/departments', label: 'Departments',          section: 'Admin',    restrict: 'admin' },
];

export default function Sidebar({ alertCount = 0 }) {
  const { user, logout, isAdmin, isFinanceManager, selectedYear, changeYear } = useAuth();
  const navigate = useNavigate();
  const [fyOpen, setFyOpen] = useState(false);
  const years = [2023, 2024, 2025, 2026];

  const canSee = (item) => {
    if (!item.restrict) return true;
    if (item.restrict === 'admin')   return isAdmin;
    if (item.restrict === 'finance') return isAdmin || isFinanceManager;
    return true;
  };

  const sections = [...new Set(NAV_ITEMS.map(i => i.section))];

  return (
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
                  {item.badge && alertCount > 0 && (
                    <span className="nav-badge">{alertCount}</span>
                  )}
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
            fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 600,
            padding: '2px 6px', borderRadius: 3,
            background: 'var(--accent-dim)', color: 'var(--accent2)',
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

        {/* User */}
        <div className="user-chip" style={{ marginBottom: 8 }}>
          <div>
            <div className="u-name">{user?.username}</div>
            <div className="u-role">{user?.email || `${user?.username}@simax.com`}</div>
          </div>
        </div>

        <button
          className="signout-btn"
          onClick={() => { logout(); navigate('/login'); }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
