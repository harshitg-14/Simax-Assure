import { useEffect, useState } from 'react';
import { budgetsApi, departmentsApi, expensesApi, commitmentsApi, alertsApi, reportsApi, schedulesApi } from '../api/services';
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
  { name: 'Year-over-Year',        desc: 'Side-by-side comparison across two fiscal years', tag: 'YoY',      tagClass: 'chip-blue',    color: 'var(--accent3)', section: 'section-yoy' },
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

  const [yoyYearA,  setYoyYearA]  = useState(selectedYear - 1);
  const [yoyYearB,  setYoyYearB]  = useState(selectedYear);
  const [yoyData,   setYoyData]   = useState(null);
  const [yoyLoad,   setYoyLoad]   = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);

  const [schedOpen,    setSchedOpen]    = useState(false);
  const [schedConfig,  setSchedConfig]  = useState({ enabled: false, frequency: 'weekly', day_of_week: 0, day_of_month: 1, hour: 8, recipients: [] });
  const [schedRecipStr, setSchedRecipStr] = useState('');
  const [schedSaving,  setSchedSaving]  = useState(false);
  const [schedSending, setSchedSending] = useState(false);
  const [schedMsg,     setSchedMsg]     = useState({ text: '', ok: true });

  const openSchedModal = () => {
    schedulesApi.get().then(r => {
      setSchedConfig(r.data);
      setSchedRecipStr((r.data.recipients || []).join(', '));
      setSchedMsg({ text: '', ok: true });
    }).catch(() => {}).finally(() => setSchedOpen(true));
  };

  const saveSchedule = async () => {
    setSchedSaving(true); setSchedMsg({ text: '', ok: true });
    const recipients = schedRecipStr.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await schedulesApi.update({ ...schedConfig, recipients });
      setSchedMsg({ text: 'Schedule saved.', ok: true });
    } catch (e) {
      setSchedMsg({ text: e.response?.data?.detail || 'Failed to save.', ok: false });
    } finally { setSchedSaving(false); }
  };

  const sendNow = async () => {
    setSchedSending(true); setSchedMsg({ text: '', ok: true });
    const recipients = schedRecipStr.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await schedulesApi.update({ ...schedConfig, recipients });
      const r = await schedulesApi.sendNow();
      setSchedMsg({ text: r.data.detail, ok: true });
    } catch (e) {
      setSchedMsg({ text: e.response?.data?.detail || 'Failed to send.', ok: false });
    } finally { setSchedSending(false); }
  };

  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  useEffect(() => {
    setYoyLoad(true);
    reportsApi.yoy(yoyYearA, yoyYearB)
      .then(r => setYoyData(r.data))
      .catch(() => setYoyData(null))
      .finally(() => setYoyLoad(false));
  }, [yoyYearA, yoyYearB]);

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

  // ── PDF export ────────────────────────────────────────────────────────────────
  const downloadPDF = async () => {
    setPdfLoading(true);
    try {
      const res = await reportsApi.downloadPdf(selectedYear);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `simax-assure-fy${selectedYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────────
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
    <>
    <div className="page fade-in">

      {/* Header */}
      <div className="ph">
        <div>
          <div className="ph-title">Reports &amp; Analytics</div>
          <div className="ph-sub">Financial dashboards and analytics &mdash; FY {selectedYear}</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={openSchedModal}>Schedule Report</button>
          <button className="btn btn-ghost" onClick={generateCSV}>Export CSV</button>
          <button className="btn btn-primary" onClick={downloadPDF} disabled={pdfLoading}>
            {pdfLoading ? 'Generating PDF…' : 'Export PDF'}
          </button>
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
      {/* ── Year-over-Year Comparison ────────────────────────────────────── */}
      <div id="section-yoy" className="card" style={{ marginTop: 20, scrollMarginTop: 80 }}>
        <div className="card-head">
          <div className="card-title">Year-over-Year Comparison</div>
          {/* Year selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={yoyYearA}
              onChange={e => setYoyYearA(+e.target.value)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border2)',
                background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)' }}
            >
              {[2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>FY {y}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>vs</span>
            <select
              value={yoyYearB}
              onChange={e => setYoyYearB(+e.target.value)}
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border2)',
                background: 'var(--surface2)', color: 'var(--text)', fontSize: 12, fontFamily: 'var(--mono)' }}
            >
              {[2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>FY {y}</option>)}
            </select>
          </div>
        </div>

        {yoyLoad ? (
          <div style={{ padding: '32px', textAlign: 'center' }}><div className="spinner" /></div>
        ) : !yoyData ? (
          <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>No data</div>
        ) : (
          <div className="card-body">

            {/* Summary KPI comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total Budget',      a: yoyData.summary_a.budget,      b: yoyData.summary_b.budget },
                { label: 'Total Spent',       a: yoyData.summary_a.spent,       b: yoyData.summary_b.spent },
                { label: 'Utilization',       a: yoyData.summary_a.utilization, b: yoyData.summary_b.utilization, isPct: true },
              ].map(({ label, a, b, isPct }) => {
                const change = a > 0 ? (((b - a) / a) * 100).toFixed(1) : null;
                const up     = b >= a;
                const changeColor = label === 'Utilization'
                  ? (up ? 'var(--danger)' : 'var(--success)')
                  : (up ? 'var(--success)' : 'var(--danger)');
                return (
                  <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase',
                      letterSpacing: '0.5px', fontFamily: 'var(--mono)' }}>{label}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>FY {yoyYearA}</div>
                        <div style={{ fontSize: 13, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text2)' }}>
                          {isPct ? `${a}%` : fmt(a)}
                        </div>
                      </div>
                      <div style={{ fontSize: 18, color: 'var(--border2)' }}>→</div>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>FY {yoyYearB}</div>
                        <div style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text)' }}>
                          {isPct ? `${b}%` : fmt(b)}
                        </div>
                      </div>
                      {change !== null && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)', color: changeColor }}>
                            {up ? '▲' : '▼'} {Math.abs(change)}%
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--text3)' }}>vs prior year</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Department comparison table */}
            <div style={{ overflowX: 'auto', marginBottom: 24 }}>
              <table>
                <thead>
                  <tr>
                    <th>Department</th>
                    <th style={{ textAlign: 'right' }}>FY {yoyYearA} Budget</th>
                    <th style={{ textAlign: 'right' }}>FY {yoyYearA} Spent</th>
                    <th style={{ textAlign: 'right' }}>FY {yoyYearB} Budget</th>
                    <th style={{ textAlign: 'right' }}>FY {yoyYearB} Spent</th>
                    <th style={{ textAlign: 'center' }}>Budget Change</th>
                    <th style={{ textAlign: 'center' }}>Spend Change</th>
                  </tr>
                </thead>
                <tbody>
                  {yoyData.departments.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24, fontSize: 12 }}>
                      No department data for these years
                    </td></tr>
                  ) : yoyData.departments.map((d, i) => {
                    const budgetUp = (d.budget_change_pct || 0) >= 0;
                    const spendUp  = (d.spend_change_pct  || 0) >= 0;
                    const ChgPill  = ({ pct, up }) => pct === null ? (
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>
                    ) : (
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', fontWeight: 700,
                        color: up ? 'var(--success)' : 'var(--danger)' }}>
                        {up ? '▲' : '▼'} {Math.abs(pct)}%
                      </span>
                    );
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{d.department}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{fmt(d.year_a.budget)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{fmt(d.year_a.spent)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{fmt(d.year_b.budget)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{fmt(d.year_b.spent)}</td>
                        <td style={{ textAlign: 'center' }}><ChgPill pct={d.budget_change_pct} up={budgetUp} /></td>
                        <td style={{ textAlign: 'center' }}><ChgPill pct={d.spend_change_pct}  up={!spendUp} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Side-by-side grouped bar chart */}
            {yoyData.departments.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>
                  Budget & Spend by Department
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={yoyData.departments.map(d => ({
                      name: d.department.slice(0, 8),
                      [`${yoyYearA} Budget`]: d.year_a.budget,
                      [`${yoyYearA} Spent`]:  d.year_a.spent,
                      [`${yoyYearB} Budget`]: d.year_b.budget,
                      [`${yoyYearB} Spent`]:  d.year_b.spent,
                    }))}
                    barGap={2} barCategoryGap="25%"
                  >
                    <CartesianGrid stroke="rgba(24,37,64,0.5)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                    <Bar dataKey={`${yoyYearA} Budget`} fill="rgba(91,143,255,0.4)"  radius={[3,3,0,0]} />
                    <Bar dataKey={`${yoyYearA} Spent`}  fill="rgba(91,143,255,0.85)" radius={[3,3,0,0]} />
                    <Bar dataKey={`${yoyYearB} Budget`} fill="rgba(201,151,10,0.4)"  radius={[3,3,0,0]} />
                    <Bar dataKey={`${yoyYearB} Spent`}  fill="rgba(201,151,10,0.9)"  radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
                  {[
                    { color: 'rgba(91,143,255,0.4)',  label: `FY ${yoyYearA} Budget` },
                    { color: 'rgba(91,143,255,0.85)', label: `FY ${yoyYearA} Spent` },
                    { color: 'rgba(201,151,10,0.4)',  label: `FY ${yoyYearB} Budget` },
                    { color: 'rgba(201,151,10,0.9)',  label: `FY ${yoyYearB} Spent` },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text3)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color }} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly spend overlay line chart */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>
                Monthly Spend Trend — FY {yoyYearA} vs FY {yoyYearB}
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={MONTH_NAMES.map((month, i) => ({
                  month,
                  [yoyYearA]: yoyData.monthly_a[i]?.total || 0,
                  [yoyYearB]: yoyData.monthly_b[i]?.total || 0,
                }))}>
                  <CartesianGrid stroke="rgba(24,37,64,0.5)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}K`} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey={yoyYearA} stroke="#5b8fff" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                  <Line type="monotone" dataKey={yoyYearB} stroke="#c9970a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 20, marginTop: 8, justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ width: 20, height: 2, background: '#5b8fff', borderRadius: 1 }} />
                  FY {yoyYearA}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ width: 20, height: 2, background: '#c9970a', borderRadius: 1 }} />
                  FY {yoyYearB}
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

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

    {schedOpen && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 14, padding: 32, width: 440,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          animation: 'fadeUp 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Schedule Report</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Auto-email PDF to finance team</div>
            </div>
            <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={() => setSchedOpen(false)}>&#x2715;</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
            background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Scheduled Delivery</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {schedConfig.enabled ? 'Active — reports will be emailed automatically' : 'Disabled'}
              </div>
            </div>
            <div
              onClick={() => setSchedConfig(c => ({ ...c, enabled: !c.enabled }))}
              style={{
                width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                background: schedConfig.enabled ? 'var(--success)' : 'var(--border2)',
                position: 'relative', transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute', top: 3,
                left: schedConfig.enabled ? 23 : 3,
                width: 18, height: 18, borderRadius: 9,
                background: 'white', transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
            <div className="form-group">
              <label>Frequency</label>
              <select value={schedConfig.frequency}
                onChange={e => setSchedConfig(c => ({ ...c, frequency: e.target.value }))}
                style={{ width: '100%' }}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {schedConfig.frequency === 'weekly' ? (
              <div className="form-group">
                <label>Day of Week</label>
                <select value={schedConfig.day_of_week}
                  onChange={e => setSchedConfig(c => ({ ...c, day_of_week: +e.target.value }))}
                  style={{ width: '100%' }}>
                  {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Day of Month</label>
                <select value={schedConfig.day_of_month}
                  onChange={e => setSchedConfig(c => ({ ...c, day_of_month: +e.target.value }))}
                  style={{ width: '100%' }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Send Time</label>
              <select value={schedConfig.hour}
                onChange={e => setSchedConfig(c => ({ ...c, hour: +e.target.value }))}
                style={{ width: '100%' }}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Recipients <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(comma-separated emails)</span></label>
              <textarea
                rows={3}
                placeholder="finance@company.com, cfo@company.com"
                value={schedRecipStr}
                onChange={e => setSchedRecipStr(e.target.value)}
                style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 12 }}
              />
            </div>
          </div>

          {schedMsg.text && (
            <div style={{ fontSize: 12, marginBottom: 14, padding: '8px 12px', borderRadius: 6,
              background: schedMsg.ok ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)',
              color: schedMsg.ok ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${schedMsg.ok ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}>
              {schedMsg.text}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={sendNow} disabled={schedSending}>
              {schedSending ? 'Sending...' : 'Send Now'}
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setSchedOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveSchedule} disabled={schedSaving}>
                {schedSaving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
