// src/pages/Reports.jsx
import React, { useEffect, useState } from 'react';
import { budgetsApi, departmentsApi, expensesApi } from '../api/services';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const REPORT_CARDS = [
  { icon: '', name: 'Budget vs Actual',     desc: 'Department-wise comparison of allocated vs real expenditure',   tag: 'Analytics',  tagClass: 'chip-accent' },
  { icon: '', name: 'Department Analysis',   desc: 'Top spending depts, monthly trends, and category breakdown',   tag: 'Dept',       tagClass: 'chip-blue' },
  { icon: '', name: 'Assurance Report',      desc: 'Budget alerts, overruns, commitment risks, compliance status', tag: 'Compliance', tagClass: 'chip-danger' },
  { icon: '', name: 'Monthly Summary',       desc: 'Month-over-month financial performance and variance analysis', tag: 'Monthly',    tagClass: 'chip-warn' },
  { icon: '', name: 'Commitment Tracker',    desc: 'All active commitments, due dates, and fulfillment status',    tag: 'Commitment', tagClass: 'chip-accent' },
  { icon: '', name: 'Financial Utilization', desc: 'Overall financial health, utilization rates, and forecasting', tag: 'Forecast',   tagClass: 'chip-success' },
];

const monthlyData = [
  { month: 'Jan', spend: 1200000 }, { month: 'Feb', spend: 1850000 },
  { month: 'Mar', spend: 2100000 }, { month: 'Apr', spend: 1600000 },
  { month: 'May', spend: 2400000 }, { month: 'Jun', spend: 2900000 },
  { month: 'Jul', spend: 1750000 }, { month: 'Aug', spend: 3200000 },
  { month: 'Sep', spend: 2600000 }, { month: 'Oct', spend: 3800000 },
  { month: 'Nov', spend: 3400000 }, { month: 'Dec', spend: 2800000 },
];

export default function Reports() {
  const { selectedYear } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([budgetsApi.list(), departmentsApi.list()])
      .then(([b, d]) => { setBudgets(b.data || []); setDepts(d.data || []); })
      .finally(() => setLoading(false));
  }, [selectedYear]);

  const filtered = budgets.filter(b => b.budget_year === selectedYear);
  const totalBudget = filtered.reduce((a, b) => a + +(b.allocated_budget || 0), 0);

  const deptBar = filtered.map(b => {
    const dept = depts.find(d => d.department_id === b.department_id);
    return { name: dept?.department_name?.slice(0, 7) || 'Dept', Budget: +b.allocated_budget };
  });

  const pieData = depts.slice(0, 4).map((d, i) => {
    const dBudgets = filtered.filter(b => b.department_id === d.department_id);
    const total = dBudgets.reduce((a, b) => a + +(b.allocated_budget || 0), 0);
    const colors = ['#d4a017','#22d3a0','#f43f5e','#5b8fff'];
    return { name: d.department_name, value: total, color: colors[i % colors.length] };
  }).filter(d => d.value > 0);

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Reports & Analytics</div>
          <div className="ph-sub">Financial dashboards and analytics — FY {selectedYear}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost">Schedule Report</button>
          <button className="btn btn-primary">⬇ Generate Now</button>
        </div>
      </div>

      {/* Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {REPORT_CARDS.map((r, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ fontSize: 28, marginBottom: 12 }}>{r.icon}</div>
            <div style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 12 }}>{r.desc}</div>
            <span className={`chip ${r.tagClass}`}>{r.tag}</span>
          </div>
        ))}
      </div>

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
          <div className="card">
            <div className="card-head">
              <div className="card-title">Budget Allocation by Department</div>
              <span className="chip chip-accent">FY {selectedYear}</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptBar}>
                  <CartesianGrid stroke="rgba(28,48,80,0.5)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v/100000).toFixed(0)}L`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="Budget" fill="var(--accent)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Monthly Spend Trend {selectedYear}</div>
                <ResponsiveContainer width="100%" height={70}>
                  <LineChart data={monthlyData}>
                    <Line type="monotone" dataKey="spend" stroke="var(--accent)" strokeWidth={2} dot={false} />
                    <XAxis dataKey="month" tick={{ fill: 'var(--text3)', fontSize: 9, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Budget Distribution</div></div>
            <div className="card-body">
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {pieData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text2)' }}>{d.name}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(d.value)}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>Total FY {selectedYear}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>{fmt(totalBudget)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>No data for FY {selectedYear}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
