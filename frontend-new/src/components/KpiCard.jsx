import './KpiCard.css';

export default function KpiCard({ label, value, sub, subType = '', pct, delay = 0 }) {
  return (
    <div className="kpi-card" style={{ animationDelay: `${delay}s` }}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className={`kpi-sub${subType ? ' ' + subType : ''}`}>{sub}</div>}
      {pct !== undefined && (
        <div className="kpi-prog">
          <div className="kpi-prog-row">
            <span>Utilization</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{pct}%</span>
          </div>
          <div className="kpi-prog-track">
            <div
              className="kpi-prog-fill"
              style={{
                width: `${Math.min(pct, 100)}%`,
                background: pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : 'var(--accent)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
