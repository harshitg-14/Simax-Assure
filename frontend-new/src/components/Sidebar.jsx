// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

export default function Sidebar({ alertCount = 0 }) {
  const { user, logout, isAdmin, isFinanceManager, isDeptHead, canViewAssurance, canViewReports, selectedYear, changeYear } = useAuth();
  const navigate = useNavigate();
  const [fyOpen, setFyOpen] = useState(false);
  const [fyYear, setFyYear] = useState(selectedYear);
  const years = [2023, 2024, 2025, 2026];

  const selectYear = (yr) => {
    setFyYear(yr); setFyOpen(false); changeYear(yr);
  };

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <div className="logo-mark">
          <div className="logo-hex">◈</div>
          <div className="logo-name">Simax<span className="accent">.</span>Assure</div>
        </div>
        <div className="logo-tag">Financial Control Platform</div>
      </div>

      <nav className="nav-body">
        <div className="nav-section">
          <div className="nav-label">Main</div>
          <NavLink to="/dashboard" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">◈</span> Executive Dashboard
          </NavLink>
          {(isAdmin || isFinanceManager) && (
            <NavLink to="/budgets" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">◉</span> Budget Management
            </NavLink>
          )}
          <NavLink to="/commitments" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">◎</span> Commitments
          </NavLink>
          <NavLink to="/expenditure" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span className="nav-icon">⬡</span> Expenditure
          </NavLink>
        </div>

        {(isAdmin || isFinanceManager) && (
          <div className="nav-section">
            <div className="nav-label">Control</div>
            {canViewAssurance && (
              <NavLink to="/assurance" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">🛡</span> Assurance Monitor
                {alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
              </NavLink>
            )}
            {canViewReports && (
              <NavLink to="/reports" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <span className="nav-icon">▤</span> Reports & Analytics
              </NavLink>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="nav-section">
            <div className="nav-label">Admin</div>
            <NavLink to="/departments" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">⊞</span> Departments
            </NavLink>
          </div>
        )}

        {isDeptHead && (
          <div className="nav-section">
            <div className="nav-label">My Department</div>
            <NavLink to="/expenditure" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">📤</span> Log Expense
            </NavLink>
            <NavLink to="/commitments" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">🔒</span> My Commitments
            </NavLink>
          </div>
        )}
      </nav>

      <div className="sidebar-bottom">
        {/* Role Badge */}
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Role</div>
          <div style={{
            fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: isAdmin ? 'rgba(212,160,23,0.1)' : isFinanceManager ? 'rgba(34,211,160,0.1)' : 'rgba(245,158,11,0.1)',
            color: isAdmin ? 'var(--accent)' : isFinanceManager ? 'var(--success)' : 'var(--warn)',
          }}>
            {user?.role?.replace('_', ' ').toUpperCase()}
          </div>
        </div>

        {/* FY Dropdown */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <div className="fy-selector" onClick={() => setFyOpen(!fyOpen)} style={{ cursor: 'pointer' }}>
            <div>
              <div className="fy-label">Fiscal Year</div>
              <div className="fy-val">FY {fyYear}</div>
            </div>
            <span style={{ color: 'var(--accent)', fontSize: 12, transition: 'transform 0.2s', transform: fyOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
          </div>
          {fyOpen && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', zIndex: 999, boxShadow: '0 -4px 20px rgba(0,0,0,0.4)' }}>
              {years.map(yr => (
                <div key={yr} onClick={() => selectYear(yr)}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--mono)', fontWeight: fyYear === yr ? 700 : 400, color: fyYear === yr ? 'var(--accent)' : 'var(--text2)', background: fyYear === yr ? 'var(--accent-dim)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  onMouseEnter={e => { if (fyYear !== yr) e.currentTarget.style.background = 'var(--surface2)'; }}
                  onMouseLeave={e => { if (fyYear !== yr) e.currentTarget.style.background = 'transparent'; }}
                >
                  FY {yr} {fyYear === yr && <span style={{ fontSize: 10 }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="user-chip">
          <div className="avatar">{user?.username?.slice(0, 2).toUpperCase() || 'U'}</div>
          <div>
            <div className="u-name">{user?.username || 'User'}</div>
            <div className="u-role">{user?.role?.replace('_', ' ').toUpperCase()}</div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{ width: '100%', marginTop: 8, padding: '10px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, color: 'var(--danger)', fontFamily: 'var(--body)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.2)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,0.1)'; e.currentTarget.style.borderColor = 'rgba(244,63,94,0.3)'; }}
        >
          ⏏ Logout
        </button>
      </div>
    </aside>
  );
}
