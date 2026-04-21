// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { budgetsApi, alertsApi, expensesApi, departmentsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import KpiCard from '../components/KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="ct-label">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="ct-row">
          <span style={{ color: p.color }}>{p.name}</span>
          <span>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { selectedYear } = useAuth();
  const [budgets, setBudgets]       = useState([]);
  const [summaries, setSummaries]   = useState([]);
  const [depts, setDepts]           = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [expenses, setExpenses]     = useState([]);
  const [loading, setLoading]       = useState(true);

  const monthlyData = [
    { month: 'Jan', spend: 1200000 }, { month: 'Feb', spend: 1850000 },
    { month: 'Mar', spend: 2100000 }, { month: 'Apr', spend: 1600000 },
    { month: 'May', spend: 2400000 }, { month: 'Jun', spend: 2900000 },
    { month: 'Jul', spend: 1750000 }, { month: 'Aug', spend: 3200000 },
    { month: 'Sep', spend: 2600000 }, { month: 'Oct', spend: 3800000 },
    { month: 'Nov', spend: 3400000 }, { month: 'Dec', spend: 2800000 },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const [budgetsRes, deptsRes, alertsRes, expensesRes] = await Promise.all([
          budgetsApi.list(),
          departmentsApi.list(),
          alertsApi.listOpen(),
          expensesApi.list(),
        ]);

        const allBudgets = budgetsRes.data || [];
        const allDepts   = deptsRes.data || [];
        const allAlerts  = alertsRes.data || [];
        const allExp     = expensesRes.data || [];

        setBudgets(allBudgets);
        setDepts(allDepts);
        setAlerts(allAlerts.slice(0, 3));
        setExpenses(allExp.slice(0, 5));

        // Get budget summaries for each budget
        const filteredBudgets = allBudgets.filter(b => b.budget_year === selectedYear);
        const sumRes = await Promise.all(filteredBudgets.map(b => budgetsApi.summary(b.budget_id)));
        setSummaries(sumRes.map(r => r.data));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  // Global KPIs from summaries
  const totalBudget      = summaries.reduce((a, s) => a + (s?.allocated_budget || 0), 0);
  const totalCommitted   = summaries.reduce((a, s) => a + (s?.committed_amount || 0), 0);
  const totalSpent       = summaries.reduce((a, s) => a + (s?.spent_amount || 0), 0);
  const totalRemaining   = summaries.reduce((a, s) => a + (s?.remaining_amount || 0), 0);
  const utilizationPct   = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(2) : 0;

  // Department chart data
  const deptChartData = summaries.map(s => {
    const budget = budgets.find(b => b.budget_id === s?.budget_id);
    const dept   = depts.find(d => d.department_id === budget?.department_id);
    return {
      name:   dept?.department_name?.slice(0, 7) || 'Dept',
      Budget: s?.allocated_budget || 0,
      Spent:  s?.spent_amount || 0,
    };
  });

  const sevColor = (sev) => sev === 'critical' ? 'var(--danger)' : sev === 'high' ? 'var(--danger)' : sev === 'medium' ? 'var(--warn)' : 'var(--success)';
  const sevIcon  = (sev) => sev === 'critical' || sev === 'high' ? '' : sev === 'medium' ? '' : '';

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Executive Overview</div>
          <div className="ph-sub">FY {selectedYear} · All Departments · Live data</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost">⬇ Export</button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alert-strip">
          <div className="pulse-dot" />
          <div>
            <strong>{alerts.length} Active Alerts</strong>
            {' — '}{alerts[0]?.title} — {alerts[0]?.message?.slice(0, 60)}...
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <a href="/assurance" className="chip chip-danger" style={{ textDecoration: 'none' }}>View Alerts →</a>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <KpiCard icon="" label="Total Budget"     value={fmt(totalBudget)}    sub={`FY ${selectedYear} — All departments`} delay={0} />
        <KpiCard icon="" label="Commitments"      value={fmt(totalCommitted)} sub={`${totalBudget > 0 ? ((totalCommitted/totalBudget)*100).toFixed(1) : 0}% of budget`} subType="warn" delay={0.06} />
        <KpiCard icon="" label="Expenditure"      value={fmt(totalSpent)}     sub="Total actual spend" subType="up" pct={parseFloat(utilizationPct)} delay={0.12} />
        <KpiCard icon="" label="Remaining Budget" value={fmt(totalRemaining)} sub="After expenses + commitments" subType="warn" delay={0.18} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-head">
            <div className="card-title">Department Budget vs Actual</div>
            <span className="chip chip-accent">FY {selectedYear}</span>
          </div>
          <div className="card-body">
            {deptChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptChartData} barGap={4}>
                  <CartesianGrid stroke="rgba(28,48,80,0.5)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${(v/100000).toFixed(0)}L`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Budget" fill="rgba(28,48,80,0.8)" radius={[4,4,0,0]} />
                  <Bar dataKey="Spent"  fill="var(--accent)"      radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>
                No budget data for FY {selectedYear}
              </div>
            )}

            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Monthly Spend Trend</span>
                <span className="chip chip-accent">{selectedYear}</span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={monthlyData}>
                  <Line type="monotone" dataKey="spend" stroke="var(--accent)" strokeWidth={2} dot={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text3)', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="dash-right">
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div className="card-title">Assurance Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--danger)' }}>
                <div className="pulse-dot" />LIVE
              </div>
            </div>
            <div className="card-body" style={{ padding: 16 }}>
              <div className="mini-stat-grid">
                {[
                  { icon: '', label: 'Critical',  val: alerts.filter(a => a.severity === 'critical').length, color: 'var(--danger)', bg: 'rgba(244,63,94,0.1)' },
                  { icon: '', label: 'High',      val: alerts.filter(a => a.severity === 'high').length,     color: 'var(--danger)', bg: 'rgba(244,63,94,0.08)' },
                  { icon: '', label: 'Medium',    val: alerts.filter(a => a.severity === 'medium').length,   color: 'var(--warn)',   bg: 'rgba(245,158,11,0.1)' },
                  { icon: '', label: 'Open',      val: alerts.length,                                        color: 'var(--accent)', bg: 'var(--accent-dim)' },
                ].map(s => (
                  <div key={s.label} className="mini-stat">
                    <div className="ms-icon" style={{ background: s.bg }}>{s.icon}</div>
                    <div>
                      <div className="ms-label">{s.label}</div>
                      <div className="ms-val" style={{ color: s.color }}>{s.val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Recent Alerts</div>
              <span className="chip chip-danger">{alerts.length} Open</span>
            </div>
            <div className="card-body" style={{ padding: 14 }}>
              <div className="alerts-list">
                {alerts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '16px 0' }}>✅ No active alerts</div>
                ) : alerts.map(a => (
                  <div key={a.alert_id} className="alert-item" style={{ '--alc': sevColor(a.severity) }}>
                    <div className="alert-ico">{sevIcon(a.severity)}</div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{a.message?.slice(0, 60)}...</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3 }}>
                        {a.alert_code} · {a.category}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Recent Transactions</div>
          <span className="chip chip-accent">Last {expenses.length}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr>
              <th>ID</th><th>Budget ID</th><th>Vendor</th><th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th><th>Date</th>
            </tr></thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No expenses yet</td></tr>
              ) : expenses.map(e => (
                <tr key={e.expense_id}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>EXP-{String(e.expense_id).padStart(4,'0')}</td>
                  <td><span className="chip chip-blue">BDG-{e.budget_id}</span></td>
                  <td>{e.vendor || '—'}</td>
                  <td style={{ color: 'var(--text2)' }}>{e.category || '—'}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--mono)' }}>{e.expense_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
