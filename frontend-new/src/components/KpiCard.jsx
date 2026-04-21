// src/components/KpiCard.jsx
import React from 'react';
import './KpiCard.css';

export default function KpiCard({ icon, label, value, sub, subType = '', pct, delay = 0 }) {
  return (
    <div className="kpi-card fade-up" style={{ animationDelay: `${delay}s` }}>
      {icon && <div className="kpi-icon">{icon}</div>}
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={`kpi-sub${subType ? ' ' + subType : ''}`}>{sub}</div>}
      {pct !== undefined && (
        <div className="kpi-prog">
          <div className="kpi-prog-row">
            <span>Utilized</span><span>{pct}%</span>
          </div>
          <div className="kpi-prog-track">
            <div
              className="kpi-prog-fill"
              style={{
                width: `${Math.min(pct, 100)}%`,
                background: pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : 'var(--accent)'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
