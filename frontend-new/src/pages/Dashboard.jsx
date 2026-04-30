import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { budgetsApi, alertsApi, expensesApi, dashboardApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import KpiCard from '../components/KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import './Dashboard.css';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt    = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const SEV_COLOR = { critical: 'var(--danger)', high: 'var(--warn)', medium: 'var(--accent2)', low: 'var(--success)' };
const RISK_COLOR = { High: 'var(--danger)', Medium: 'var(--warn)', Low: 'var(--success)' };
const RISK_BG    = { High: 'rgba(220,38,38,0.10)', Medium: 'rgba(217,119,6,0.10)', Low: 'rgba(5,150,105,0.10)' };

function buildMonthly(expenses, year) {
  const t = {};
  (expenses || []).forEach(e => {
    if (!e.expense_date) return;
    const d = new Date(e.expense_date);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    t[m] = (t[m] || 0) + parseFloat(e.amount || 0);
  });
  return MONTHS.map((month, i) => ({ month, spend: t[i] || 0 }));
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="ct-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { selectedYear } = useAuth();
  const [kpis, setKpis]             = useState(null);
  const [alerts, setAlerts]         = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [alertSummary, setAlertSummary] = useState(null);
  const [deptRisk, setDeptRisk]     = useState([]);
  const [anomalies, setAnomalies]   = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      budgetsApi.getKPIs(selectedYear),
      alertsApi.listOpen(),
      expensesApi.list(),
      dashboardApi.alertsSummary(),
      dashboardApi.departmentRisk(),
    ]).then(([k, a, e, s, r]) => {
      const kpiData = k.data;
      setKpis(kpiData);
      setAlerts((a.data || []).slice(0, 5));
      setExpenses(e.data || []);
      setAlertSummary(s.data || null);
      setDeptRisk(r.data || []);
      const budgetIds = (kpiData?.departments || []).map(d => d.budget_id).filter(Boolean);
      Promise.all(budgetIds.map(id => dashboardApi.anomalies(id).then(r => r.data || []).catch(() => [])))
        .then(results => setAnomalies(results.flat()));
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedYear]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const totalBudget    = kpis?.total_budget       || 0;
  const totalCommitted = kpis?.total_commitments  || 0;
  const totalSpent     = kpis?.total_expenses     || 0;
  const remaining      = kpis?.remaining_budget   || 0;
  const utilPct        = kpis?.utilization_pct    || 0;
  const departments    = kpis?.departments        || [];
  const monthlyData    = buildMonthly(expenses, selectedYear);

  const deptChart = departments.map(d => ({
    name:   (d.department_name || 'Dept').slice(0, 8),
    Budget: d.allocated_budget || 0,
    Spent:  d.spent_amount     || 0,
  }));

  // Accurate counts from the dedicated summary endpoint (all alerts, not just 5)
  const exportReport = () => {
    const headers = ['Department', 'Allocated (INR)', 'Committed (INR)', 'Spent (INR)', 'Remaining (INR)', 'Utilization %'];
    const rows = departments.map(d => [
      d.department_name,
      d.allocated_budget || 0,
      d.committed_amount || 0,
      d.spent_amount     || 0,
      d.remaining_amount || 0,
      d.allocated_budget > 0 ? ((d.spent_amount / d.allocated_budget) * 100).toFixed(1) : '0.0',
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `budget-report-fy${selectedYear}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCount     = kpis?.active_alerts         || 0;
  const criticalCount = alertSummary?.critical       || 0;
  const highCount     = alertSummary?.high           || 0;
  const mediumCount   = alertSummary?.medium         || 0;
  const lowCount      = alertSummary?.low            || 0;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Dashboard</div>
          <div className="ph-sub">FY {selectedYear} &nbsp;&middot;&nbsp; All Departments</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={exportReport} disabled={departments.length === 0}>Export Report</button>
        </div>
      </div>

      {openCount > 0 && (
        <div className="alert-strip">
          <div className="pulse-dot" />
          <span>
            <strong>{openCount} open alert{openCount !== 1 ? 's' : ''}</strong> require attention &mdash; {alerts[0]?.title}
          </span>
          <Link to="/assurance" style={{ marginLeft: 'auto', textDecoration: 'none', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: '0.3px' }}>
            View in Assurance &rarr;
          </Link>
        </div>
      )}

      <div className="kpi-grid">
        <KpiCard label="Total Budget"     value={fmt(totalBudget)}    sub={`FY ${selectedYear} · All departments`} delay={0} />
        <KpiCard label="Commitments"      value={fmt(totalCommitted)} sub={`${totalBudget > 0 ? ((totalCommitted/totalBudget)*100).toFixed(1) : 0}% of allocated budget`} subType="warn" delay={0.06} />
        <KpiCard label="Expenditure"      value={fmt(totalSpent)}     sub="Total actual spend to date" subType="up" pct={parseFloat(utilPct)} delay={0.12} />
        <KpiCard label="Remaining Budget" value={fmt(remaining)}      sub="Net of expenses and commitments" delay={0.18} />
      </div>

      <div className="dash-grid">
        {/* Main chart */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Budget vs. Expenditure by Department</div>
            <span className="chip chip-accent">FY {selectedYear}</span>
          </div>
          <div className="card-body">
            {deptChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={deptChart} barGap={3} barCategoryGap="30%">
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v/100000).toFixed(0)}L`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="Budget" fill="rgba(91,143,255,0.35)" radius={[3,3,0,0]} />
                  <Bar dataKey="Spent"  fill="var(--accent)"   radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '48px 0', fontSize: 13 }}>
                No budget data for FY {selectedYear}
              </div>
            )}

            <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Monthly Spend Trend</span>
                <span className="chip chip-accent">FY {selectedYear}</span>
              </div>
              <ResponsiveContainer width="100%" height={70}>
                <LineChart data={monthlyData}>
                  <Line type="monotone" dataKey="spend" stroke="var(--accent)" strokeWidth={1.5} dot={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text3)', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="dash-right">
          <div className="card">
            <div className="card-head">
              <div className="card-title">Risk Overview</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>
                <div className="pulse-dot" style={{ width: 6, height: 6 }} />
                LIVE
              </div>
            </div>
            <div className="card-body" style={{ padding: 14 }}>
              <div className="mini-stat-grid">
                {[
                  { label: 'Critical', val: criticalCount, color: 'var(--danger)' },
                  { label: 'High',     val: highCount,     color: 'var(--warn)' },
                  { label: 'Medium',   val: mediumCount,   color: 'var(--accent2)' },
                  { label: 'Low',      val: lowCount,      color: 'var(--success)' },
                ].map(s => (
                  <div key={s.label} className="mini-stat">
                    <div className="ms-label">{s.label}</div>
                    <div className="ms-val" style={{ color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <div className="card-head">
              <div className="card-title">Active Alerts</div>
              <span className="chip chip-danger">{openCount} Open</span>
            </div>
            <div className="card-body" style={{ padding: 12 }}>
              <div className="alerts-list">
                {alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px 0', fontSize: 12 }}>
                    No active alerts
                  </div>
                ) : alerts.map(a => (
                  <div
                    key={a.alert_id}
                    className="alert-item"
                    style={{ '--alc': SEV_COLOR[(a.severity||'').toLowerCase()] || 'var(--warn)' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>
                        {a.message?.slice(0, 72)}{a.message?.length > 72 ? '...' : ''}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                        {a.alert_code} &middot; {a.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {openCount > 5 && (
                <Link to="/assurance" style={{ textDecoration: 'none' }}>
                  <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--accent2)', fontFamily: 'var(--mono)', paddingTop: 10, marginTop: 8, borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                    +{openCount - 5} more &rarr; View all
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Department Risk Ranking */}
      {deptRisk.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-head">
            <div className="card-title">Department Risk Ranking</div>
            <span className="chip chip-accent">{deptRisk.length} Departments</span>
          </div>
          <div className="card-body" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deptRisk.map((d, i) => {
                const rc = RISK_COLOR[d.risk] || 'var(--text3)';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 20, textAlign: 'right', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: '0 0 140px', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.department}
                    </div>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(d.usage_percent, 100)}%`,
                        height: '100%',
                        background: rc,
                        borderRadius: 3,
                        transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <div style={{ width: 48, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: rc, flexShrink: 0 }}>
                      {d.usage_percent}%
                    </div>
                    <div style={{
                      width: 60, textAlign: 'center', flexShrink: 0,
                      fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)',
                      padding: '2px 8px', borderRadius: 4,
                      background: RISK_BG[d.risk] || 'var(--surface2)',
                      color: rc,
                    }}>
                      {d.risk.toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Spending Anomalies */}
      {anomalies.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-head">
            <div className="card-title">Spending Anomalies</div>
            <span className="chip chip-danger">{anomalies.length} Detected</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Expense Ref</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Amount</th><th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((a, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>EXP-{String(a.expense_id).padStart(4, '0')}</td>
                    <td style={{ fontWeight: 500 }}>{a.vendor || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--danger)' }}>{fmt(a.amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{a.reason?.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-head">
          <div className="card-title">Recent Transactions</div>
          <Link to="/expenditure" style={{ textDecoration: 'none', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: '0.3px' }}>
            View all &rarr;
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Ref</th><th>Budget</th><th>Vendor</th><th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>No transactions recorded</td></tr>
              ) : expenses.slice(0, 5).map(e => (
                <tr key={e.expense_id}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>EXP-{String(e.expense_id).padStart(4, '0')}</td>
                  <td><span className="chip chip-blue">BDG-{e.budget_id}</span></td>
                  <td style={{ fontWeight: 500 }}>{e.vendor || '—'}</td>
                  <td style={{ color: 'var(--text2)', fontSize: 12 }}>{e.category || '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.expense_date || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
