// src/components/Topbar.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import './Topbar.css';

const PAGE_LABELS = {
  '/dashboard':   'Executive Dashboard',
  '/budgets':     'Budget Management',
  '/commitments': 'Commitments',
  '/expenditure': 'Expenditure',
  '/assurance':   'Assurance Monitor',
  '/reports':     'Reports & Analytics',
  '/departments': 'Departments',
};

export default function Topbar({ onNewEntry }) {
  const { pathname } = useLocation();
  const label = PAGE_LABELS[pathname] || 'Simax Assure';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb">Simax Assure / <span>{label}</span></div>
      </div>
      <div className="topbar-right">
        <div className="search-box">🔍 Search budgets, vendors...</div>
        <div className="icon-btn" title="Notifications">🔔<span className="notif-dot" /></div>
        <div className="icon-btn" title="Settings">⚙</div>
        {onNewEntry && (
          <button className="btn btn-primary" onClick={onNewEntry}>+ New Entry</button>
        )}
      </div>
    </header>
  );
}
