import { useEffect, useState } from 'react';
import { budgetsApi, departmentsApi, expensesApi, commitmentsApi, alertsApi } from '../api/services';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const PIE_COLORS  = ['#c9970a','#5b8fff','#dc2626','#059669','#d97706','#a855f7'];

const REPORT_CARDS = [
  { name: 'Budget vs Actual',      desc: 'Allocated vs real expenditure per department', tag: 'Analytics',  tagClass: 'chip-accent',   color: 'var(--accent)',  section: 'section-variance' },
  { name: 'Top Vendors',           desc: 'Highest spending vendors ranked by total amount', tag: 'Spend',   tagClass: 'chip-blue',     color: 'var(--accent3)', section: 'section-vendors' },
  { name: 'Category Breakdown',    desc: 'Expense distribution across spend categories', tag: 'Analytics', tagClass: 'chip-accent',   color: 'var(--accent)',  section: 'section-category' },
  { name: 'Commitment Tracker',    desc: 'Commitment utilization and fulfillment status', tag: 'Commitment',tagClass: 'chip-warn',     color: 'var(--warn)',    section: 'section-commitments' },
  { name: 'Assurance Report',      desc: 'Alert frequency and compliance status by dept', tag: 'Compliance',tagClass: 'chip-danger',  color: 'var(--danger)',  section: 'section-alerts' },
  { name: 'Monthly Trend',         desc: 'Month-over-month financial performance',        tag: 'Monthly',   tagClass: 'chip-success', color: 'var(--success)', section: 'section-monthly' },
];

function buildMonthlyTrend(expenses, year) {
  const totals = {};
  expenses.forEach(e => {
    if (!e.expense_date) return;
    const d = new Date(e.expense_date);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    totals[m] = (totals[m] || 0) + parseFloat(e.amount || 0);
  });
  return MONTH_NAMES.map((month, i) => ({ month, spend: totals[i] || 0 }));
}

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Reports() {
  const { selectedYear } = useAuth();
  const [budgets,     setBudgets]     = useState([]);
  const [depts,       setDepts]       = useState([]);
  const [expenses,    setExpenses]    = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [alerts,      setAlerts]      = useState([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      budgetsApi.list(), departmentsApi.list(),
      expensesApi.list(), commitmentsApi.list(), alertsApi.list(),
    ]).then(([b, d, e, c, a]) => {
      setBudgets(b.data || []);
      setDepts(d.data || []);
      setExpenses(e.data || []);
      setCommitments(c.data || []);
      setAlerts(a.data || []);
    }).finally(() => setLoading(false));
  }, [selectedYear]);

  const filtered     = budgets.filter(b => b.budget_year === selectedYear);
  const totalBudget  = filtered.reduce((a, b) => a + +(b.allocated_budget || 0), 0);
  const monthlyData  = buildMonthlyTrend(expenses, selectedYear);

  // ── Variance table ──────────────────────────────────────────────────────────
  const varianceData = filtered.map(b => {
    const dept    = depts.find(d => d.department_id === b.department_id);
    const spent   = expenses.filter(e => e.budget_id === b.budget_id).reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const alloc   = parseFloat(b.allocated_budget || 0);
    const variance = spent - alloc;
    const pct     = alloc > 0 ? ((spent / alloc) * 100).toFixed(1) : 0;
    return { dept: dept?.department_name || '—', alloc, spent, variance, pct };
  });

  // ── Summary stats ────────────────────────────────────────────────────────────
  const avgUtil         = varianceData.length ? (varianceData.reduce((a, v) => a + +v.pct, 0) / varianceData.length).toFixed(1) : 0;
  const withCommitment  = expenses.filter(e => e.commitment_id).length;
  const coveragePct     = expenses.length > 0 ? ((withCommitment / expenses.length) * 100).toFixed(0) : 0;
  const openAlerts      = alerts.filter(a => a.status === 'open').length;
  const compliancePct   = alerts.length > 0 ? (((alerts.length - openAlerts) / alerts.length) * 100).toFixed(0) : 100;
  const overBudgetDepts = varianceData.filter(v => v.variance > 0).length;

  // ── Top vendors ──────────────────────────────────────────────────────────────
  const vendorMap = {};
  expenses.forEach(e => {
    if (!e.vendor) return;
    vendorMap[e.vendor] = (vendorMap[e.vendor] || 0) + parseFloat(e.amount || 0);
  });
  const vendorData = Object.entries(vendorMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, total]) => ({ name, total }));

  // ── Category breakdown ───────────────────────────────────────────────────────
  const catMap = {};
  expenses.forEach(e => {
    const cat = e.category || 'Other';
    catMap[cat] = (catMap[cat] || 0) + parseFloat(e.amount || 0);
  });
  const categoryData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: PIE_COLORS[i % PIE_COLORS.length] }));
  const totalCatSpend = categoryData.reduce((a, c) => a + c.value, 0);

  // ── Dept bar chart ───────────────────────────────────────────────────────────
  const deptBar = filtered.map(b => {
    const dept  = depts.find(d => d.department_id === b.department_id);
    const spent = expenses.filter(e => e.budget_id === b.budget_id).reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    return { name: (dept?.department_name || 'Dept').slice(0, 8), Budget: +b.allocated_budget, Spent: spent };
  });

  // ── Commitment utilization ───────────────────────────────────────────────────
  const commitmentUtil = commitments.map(c => {
    const spent = expenses.filter(e => e.commitment_id === c.commitment_id).reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const reserved = parseFloat(c.amount || 0);
    const pct = reserved > 0 ? Math.min(((spent / reserved) * 100), 100).toFixed(1) : 0;
    return { ...c, spent, reserved, pct };
  });

  // ── Alert frequency by dept ──────────────────────────────────────────────────
  const alertsByDept = depts.map(d => {
    const da       = alerts.filter(a => a.department_id === d.department_id);
    const critical = da.filter(a => (a.severity || '').toLowerCase() === 'critical').length;
    const high     = da.filter(a => (a.severity || '').toLowerCase() === 'high').length;
    return { name: d.department_name, total: da.length, critical, high };
  }).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

  // ── Generate Now export ──────────────────────────────────────────────────────
  const generateCSV = () => {
    const lines = [];
    lines.push('SIMAX ASSURE — FINANCIAL REPORT');
    lines.push(`FY ${selectedYear} | Generated ${new Date().toLocaleDateString('en-IN')}`);
    lines.push('');
    lines.push('BUDGET VS ACTUAL VARIANCE');
    lines.push('"Department","Allocated (INR)","Spent (INR)","Variance (INR)","Utilization %"');
    varianceData.forEach(v => lines.push(`"${v.dept}","${v.alloc}","${v.spent}","${v.variance}","${v.pct}%"`));
    lines.push('');
    lines.push('TOP VENDORS BY SPEND');
    lines.push('"Vendor","Total Spend (INR)"');
    vendorData.forEach(v => lines.push(`"${v.name}","${v.total}"`));
    lines.push('');
    lines.push('CATEGORY BREAKDOWN');
    lines.push('"Category","Amount (INR)","Share %"');
    categoryData.forEach(c => lines.push(`"${c.name}","${c.value}","${totalCatSpend > 0 ? ((c.value / totalCatSpend) * 100).toFixed(1) : 0}%"`));
    const csv  = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `simax-assure-report-fy${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="ph">
        <div>
          <div className="ph-title">Reports &amp; Analytics</div>
          <div className="ph-sub">Financial dashboards and analytics &mdash; FY {selectedYear}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost" disabled title="Scheduled delivery — coming soon">Schedule Report</button>
          <button className="btn btn-primary" onClick={generateCSV}>Generate Now</button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        {[
          { label: 'Avg Utilization',       val: `${avgUtil}%`,           color: +avgUtil > 80 ? 'var(--danger)' : +avgUtil > 60 ? 'var(--warn)' : 'var(--success)' },
          { label: 'Commitment Coverage',   val: `${coveragePct}%`,       color: +coveragePct < 60 ? 'var(--danger)' : 'var(--success)' },
          { label: 'Compliance Rate',       val: `${compliancePct}%`,     color: +compliancePct < 70 ? 'var(--danger)' : 'var(--success)' },
          { label: 'Over-Budget Depts',     val: `${overBudgetDepts} / ${varianceData.length}`, color: overBudgetDepts > 0 ? 'var(--danger)' : 'var(--success)' },
        ].map(s => (
          <div key={s.label} className="kpi-card">
            <div className="kpi-label">{s.label}</div>
            <div className="kpi-value" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Report Cards — clickable, scroll to section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 28 }}>
        {REPORT_CARDS.map((r, i) => (
          <div
            key={i}
            onClick={() => scrollTo(r.section)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: 18, cursor: 'pointer',
              transition: 'border-color 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.color, marginBottom: 12 }} />
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{r.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 }}>{r.desc}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className={`chip ${r.tagClass}`}>{r.tag}</span>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>↓ scroll</span>
            </div>
          </div>
        ))}
      </div>

      {/* Budget vs Actual Variance Table */}
      <div id="section-variance" className="card" style={{ marginBottom: 20, scrollMarginTop: 80 }}>
        <div className="card-head">
          <div className="card-title">Budget vs Actual Variance</div>
          <span className="chip chip-accent">FY {selectedYear}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Department</th>
                <th style={{ textAlign: 'right' }}>Allocated</th>
                <th style={{ textAlign: 'right' }}>Spent</th>
                <th style={{ textAlign: 'right' }}>Variance</th>
                <th>Utilization</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {varianceData.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>No budget data for FY {selectedYear}</td></tr>
              ) : varianceData.map((v, i) => {
                const over     = v.variance > 0;
                const nearLimit = !over && +v.pct >= 80;
                const barColor  = over ? 'var(--danger)' : nearLimit ? 'var(--warn)' : 'var(--success)';
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{v.dept}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(v.alloc)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{fmt(v.spent)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: over ? 'var(--danger)' : 'var(--success)' }}>
                      {over ? '+' : ''}{fmt(v.variance)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, height: 5, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(v.pct, 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: barColor }}>{v.pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="pill" style={{
                        background: over ? 'rgba(220,38,38,0.1)' : nearLimit ? 'rgba(217,119,6,0.1)' : 'rgba(5,150,105,0.1)',
                        color: barColor,
                      }}>
                        {over ? 'Over Budget' : nearLimit ? 'Near Limit' : 'Healthy'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Vendors + Category Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Top Vendors */}
        <div id="section-vendors" className="card" style={{ scrollMarginTop: 80 }}>
          <div className="card-head">
            <div className="card-title">Top Vendors by Spend</div>
            <span className="chip chip-blue">{vendorData.length} Vendors</span>
          </div>
          <div className="card-body">
            {vendorData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0', fontSize: 13 }}>No expense data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vendorData} layout="vertical" barCategoryGap="25%">
                  <CartesianGrid stroke="rgba(24,37,64,0.6)" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text2)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="total" fill="var(--accent3)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div id="section-category" className="card" style={{ scrollMarginTop: 80 }}>
          <div className="card-head"><div className="card-title">Expense by Category</div></div>
          <div className="card-body">
            {categoryData.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0', fontSize: 13 }}>No expense data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={44} outerRadius={72} dataKey="value" paddingAngle={3}>
                      {categoryData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
                  {categoryData.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: c.fill, flexShrink: 0 }} />
                      <span style={{ flex: 1, color: 'var(--text2)' }}>{c.name}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                        {totalCatSpend > 0 ? ((c.value / totalCatSpend) * 100).toFixed(0) : 0}%
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trend + Budget Allocation */}
      <div id="section-monthly" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 20, scrollMarginTop: 80 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Budget Allocation by Department</div>
            <span className="chip chip-accent">FY {selectedYear}</span>
          </div>
          <div className="card-body">
            {deptBar.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptBar} barGap={3} barCategoryGap="30%">
                  <CartesianGrid stroke="rgba(28,48,80,0.5)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="Budget" fill="rgba(91,143,255,0.35)" radius={[4,4,0,0]} />
                  <Bar dataKey="Spent"  fill="var(--accent)"          radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px 0' }}>No budgets for FY {selectedYear}</div>
            )}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text2)' }}>Monthly Spend Trend</div>
              <ResponsiveContainer width="100%" height={65}>
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
            {filtered.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={depts.slice(0, 4).map((d, i) => {
                        const total = filtered.filter(b => b.department_id === d.department_id).reduce((a, b) => a + +(b.allocated_budget || 0), 0);
                        return { name: d.department_name, value: total, fill: PIE_COLORS[i] };
                      }).filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3}
                    >
                      {depts.slice(0, 4).map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
                  {depts.slice(0, 4).map((d, i) => {
                    const total = filtered.filter(b => b.department_id === d.department_id).reduce((a, b) => a + +(b.allocated_budget || 0), 0);
                    if (!total) return null;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i], flexShrink: 0 }} />
                        <span style={{ flex: 1, color: 'var(--text2)' }}>{d.department_name}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(total)}</span>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
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

      {/* Commitment Utilization */}
      <div id="section-commitments" className="card" style={{ marginBottom: 20, scrollMarginTop: 80 }}>
        <div className="card-head">
          <div className="card-title">Commitment Utilization</div>
          <span className="chip chip-warn">{commitmentUtil.length} Records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Ref</th><th>Description</th>
                <th style={{ textAlign: 'right' }}>Reserved</th>
                <th style={{ textAlign: 'right' }}>Spent</th>
                <th>Utilized</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {commitmentUtil.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>No commitments recorded</td></tr>
              ) : commitmentUtil.map(c => {
                const pctNum   = +c.pct;
                const barColor = pctNum >= 100 ? 'var(--danger)' : pctNum >= 70 ? 'var(--warn)' : 'var(--success)';
                return (
                  <tr key={c.commitment_id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      CMT-{String(c.commitment_id).padStart(3, '0')}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{c.description}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(c.reserved)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{fmt(c.spent)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 72, height: 5, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(pctNum, 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: barColor }}>{c.pct}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="pill" style={{
                        background: pctNum >= 100 ? 'rgba(220,38,38,0.1)' : pctNum >= 70 ? 'rgba(217,119,6,0.1)' : 'rgba(5,150,105,0.1)',
                        color: barColor,
                      }}>
                        {pctNum >= 100 ? 'Fully Used' : pctNum >= 70 ? 'High Use' : 'Available'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alert Frequency by Department */}
      {alertsByDept.length > 0 && (
        <div id="section-alerts" className="card" style={{ scrollMarginTop: 80 }}>
          <div className="card-head">
            <div className="card-title">Alert Frequency by Department</div>
            <span className="chip chip-danger">{alerts.filter(a => a.status === 'open').length} Open</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alertsByDept.map((d, i) => {
              const maxTotal = alertsByDept[0]?.total || 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 100, fontSize: 12, fontWeight: 500, color: 'var(--text2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.name}
                  </div>
                  <div style={{ flex: 1, height: 7, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.total / maxTotal) * 100}%`, height: '100%', background: d.critical > 0 ? 'var(--danger)' : 'var(--warn)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ width: 60, textAlign: 'right', fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color: d.critical > 0 ? 'var(--danger)' : 'var(--warn)', flexShrink: 0 }}>
                    {d.total} alerts
                  </div>
                  <div style={{ width: 80, flexShrink: 0 }}>
                    {d.critical > 0 && <span className="pill pill-danger">{d.critical} critical</span>}
                    {d.critical === 0 && d.high > 0 && <span className="pill pill-warn">{d.high} high</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
