import { useEffect, useState, useRef } from 'react';
import { expensesApi, departmentsApi, budgetsApi, commitmentsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const STATUS_STYLE = {
  pending:  { bg: 'rgba(217,119,6,0.1)',  color: '#d97706' },
  approved: { bg: 'rgba(5,150,105,0.1)', color: '#059669' },
  rejected: { bg: 'rgba(220,38,38,0.1)', color: '#dc2626' },
};
function StatusPill({ status }) {
  const s = status || 'pending';
  const c = STATUS_STYLE[s] || STATUS_STYLE.pending;
  return (
    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700,
      padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase',
      background: c.bg, color: c.color }}>
      {s}
    </span>
  );
}

const CATEGORIES = ['Cloud Infrastructure', 'Software License', 'Digital Marketing', 'Logistics', 'Utilities', 'Travel', 'Professional Services', 'Other'];

export default function Expenditure() {
  const { canViewAllDepts, isDeptHead, userDeptId } = useAuth();
  const [expenses, setExpenses]       = useState([]);
  const [depts, setDepts]             = useState([]);
  const [budgets, setBudgets]         = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [filterDept, setFilterDept]   = useState('');
  const [importOpen,    setImportOpen]    = useState(false);
  const [importFile,    setImportFile]    = useState(null);
  const [importResult,  setImportResult]  = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const importRef = useRef();
  const [form, setForm] = useState({
    department_id: isDeptHead && userDeptId ? String(userDeptId) : '',
    budget_id: '', commitment_id: '',
    vendor: '', amount: '', expense_date: '',
    category: 'Cloud Infrastructure',
  });

  const load = () => {
    Promise.all([
      expensesApi.list(), departmentsApi.list(),
      budgetsApi.list(), commitmentsApi.list(),
    ]).then(([e, d, b, c]) => {
      setExpenses(e.data || []);
      setDepts(d.data || []);
      setBudgets(b.data || []);
      setCommitments(c.data || []);
    }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filteredBudgets     = form.department_id ? budgets.filter(b => b.department_id === +form.department_id) : budgets;
  const filteredCommitments = form.budget_id ? commitments.filter(c => c.budget_id === +form.budget_id) : [];
  const displayedExpenses   = filterDept ? expenses.filter(e => e.department_id === +filterDept) : expenses;

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await expensesApi.create({
        department_id: +form.department_id,
        budget_id:     +form.budget_id,
        commitment_id: form.commitment_id ? +form.commitment_id : null,
        vendor:        form.vendor,
        amount:        +form.amount,
        expense_date:  form.expense_date || undefined,
        category:      form.category,
      });
      setForm({ department_id: isDeptHead && userDeptId ? String(userDeptId) : '', budget_id: '', commitment_id: '', vendor: '', amount: '', expense_date: '', category: 'Cloud Infrastructure' });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this expense record?')) return;
    await expensesApi.delete(id);
    load();
  };

  const getDeptName = (id) => depts.find(d => d.department_id === id)?.department_name || '—';

  const downloadTemplate = () => {
    const csv = 'department,vendor,amount,category,expense_date\nMarketing,Acme Ltd,50000,Digital Marketing,2026-05-01\nIT,AWS,120000,Cloud Infrastructure,2026-05-15\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'expense_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    if (!importFile) return;
    setImportLoading(true); setImportResult(null);
    try {
      const res = await expensesApi.bulkImport(importFile);
      setImportResult(res.data);
      if (res.data.imported > 0) load();
    } catch (e) {
      setImportResult({ error: e.response?.data?.detail || 'Import failed' });
    } finally { setImportLoading(false); }
  };
  const totalSpent  = expenses.reduce((a, e) => a + +(e.amount || 0), 0);

  const exportCSV = () => {
    const headers = ['Ref', 'Department', 'Vendor', 'Category', 'Amount (INR)', 'Date', 'Budget'];
    const rows = expenses.map(e => [
      `EXP-${String(e.expense_id).padStart(4, '0')}`,
      getDeptName(e.department_id),
      e.vendor || '',
      e.category || '',
      e.amount,
      e.expense_date || '',
      `BDG-${e.budget_id}`,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <>
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Expenditure</div>
          <div className="ph-sub">Actual expenses recorded across all departments</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost" onClick={() => { setImportOpen(true); setImportFile(null); setImportResult(null); }}>Import CSV</button>
          <button className="btn btn-ghost" onClick={exportCSV} disabled={expenses.length === 0}>Export CSV</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Spent</div>
          <div className="kpi-value">{fmt(totalSpent)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Expense Records</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{expenses.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Departments</div>
          <div className="kpi-value" style={{ color: 'var(--accent3)' }}>{depts.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Budgets Active</div>
          <div className="kpi-value" style={{ color: 'var(--warn)' }}>{budgets.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">{canViewAllDepts ? 'All Expenses' : 'My Expenses'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                style={{ fontSize: 11, padding: '4px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text2)', fontFamily: 'var(--mono)' }}
              >
                <option value="">All Departments</option>
                {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>
              <span className="chip chip-accent">{displayedExpenses.length} Records</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Ref</th><th>Department</th><th>Vendor</th><th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th><th>Date</th><th>Budget</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {displayedExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>
                      No expenses recorded
                    </td>
                  </tr>
                ) : displayedExpenses.map(e => (
                  <tr key={e.expense_id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                      EXP-{String(e.expense_id).padStart(4, '0')}
                    </td>
                    <td><span className="chip chip-blue">{getDeptName(e.department_id)}</span></td>
                    <td style={{ fontWeight: 500 }}>{e.vendor || '—'}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{e.category || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.expense_date || '—'}</td>
                    <td><span className="chip chip-accent" style={{ fontSize: 9 }}>BDG-{e.budget_id}</span></td>
                    <td><StatusPill status={e.status} /></td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 10px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                        onClick={() => del(e.expense_id)}
                      >Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Log Expense</div>
          </div>
          <div className="card-body">
            {error && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
                {error}
              </div>
            )}
            <form onSubmit={submit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label>Department</label>
                  <select
                    required
                    disabled={isDeptHead && !!userDeptId}
                    value={form.department_id}
                    onChange={e => setForm({ ...form, department_id: e.target.value, budget_id: '', commitment_id: '' })}
                  >
                    <option value="">Select department</option>
                    {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Budget</label>
                  <select required value={form.budget_id} onChange={e => setForm({ ...form, budget_id: e.target.value, commitment_id: '' })}>
                    <option value="">Select budget</option>
                    {filteredBudgets.map(b => (
                      <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} &middot; FY {b.budget_year}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Commitment <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional)</span></label>
                  <select value={form.commitment_id} onChange={e => setForm({ ...form, commitment_id: e.target.value })}>
                    <option value="">No commitment linked</option>
                    {filteredCommitments.map(c => (
                      <option key={c.commitment_id} value={c.commitment_id}>CMT-{c.commitment_id}: {c.description}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Vendor</label>
                    <input type="text" placeholder="e.g. AWS" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Amount (&#8377;)</label>
                    <input type="number" required placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date</label>
                    <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14, padding: '9px 12px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.18)', borderRadius: 6, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
                Submission triggers the rules engine. Assurance alerts are generated automatically where thresholds are breached.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    {importOpen && (
      <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:99999,backdropFilter:'blur(4px)' }}>
        <div style={{ background:'var(--surface)',border:'1px solid var(--border2)',borderRadius:14,padding:32,width:480,boxShadow:'0 24px 64px rgba(0,0,0,0.6)',animation:'fadeUp 0.2s ease' }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20 }}>
            <div>
              <div style={{ fontSize:15,fontWeight:700 }}>Bulk Import Expenses</div>
              <div style={{ fontSize:12,color:'var(--text3)',marginTop:3 }}>Upload a CSV file to add multiple expenses at once</div>
            </div>
            <button className="btn btn-ghost" style={{ padding:'4px 10px',fontSize:12 }} onClick={() => setImportOpen(false)}>&#x2715;</button>
          </div>

          <div style={{ background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:18,fontSize:12,color:'var(--text2)' }}>
            <div style={{ fontWeight:600,marginBottom:6 }}>Required CSV columns:</div>
            <div style={{ fontFamily:'var(--mono)',fontSize:11,color:'var(--text3)',lineHeight:1.8 }}>
              department &nbsp;·&nbsp; vendor &nbsp;·&nbsp; amount &nbsp;·&nbsp; category &nbsp;·&nbsp; expense_date (YYYY-MM-DD)
            </div>
            <button className="btn btn-ghost" style={{ marginTop:10,fontSize:11,padding:'4px 12px' }} onClick={downloadTemplate}>
              Download Template
            </button>
          </div>

          <div
            onClick={() => importRef.current?.click()}
            style={{ border:`2px dashed ${importFile ? 'var(--success)' : 'var(--border2)'}`,borderRadius:8,padding:'20px',textAlign:'center',cursor:'pointer',marginBottom:18,transition:'border-color 0.2s' }}
          >
            <input ref={importRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={e => { setImportFile(e.target.files[0] || null); setImportResult(null); }} />
            {importFile
              ? <div style={{ fontSize:13,color:'var(--success)',fontWeight:600 }}>&#x2713; {importFile.name}</div>
              : <div style={{ fontSize:12,color:'var(--text3)' }}>Click to select a CSV file</div>}
          </div>

          {importResult && !importResult.error && (
            <div style={{ marginBottom:16,fontSize:12 }}>
              <div style={{ display:'flex',gap:16,marginBottom:8 }}>
                <span style={{ color:'var(--success)',fontWeight:700 }}>&#x2713; {importResult.imported} imported</span>
                {importResult.failed?.length > 0 && <span style={{ color:'var(--danger)',fontWeight:700 }}>&#x2715; {importResult.failed.length} failed</span>}
              </div>
              {importResult.failed?.length > 0 && (
                <div style={{ background:'rgba(220,38,38,0.06)',border:'1px solid rgba(220,38,38,0.2)',borderRadius:6,padding:'8px 12px',maxHeight:120,overflowY:'auto' }}>
                  {importResult.failed.map((f,i) => (
                    <div key={i} style={{ fontSize:11,fontFamily:'var(--mono)',color:'var(--danger)',marginBottom:2 }}>Row {f.row}: {f.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {importResult?.error && (
            <div style={{ marginBottom:16,fontSize:12,color:'var(--danger)',padding:'8px 12px',background:'rgba(220,38,38,0.06)',borderRadius:6,border:'1px solid rgba(220,38,38,0.2)' }}>{importResult.error}</div>
          )}

          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setImportOpen(false)}>Close</button>
            <button className="btn btn-primary" onClick={runImport} disabled={!importFile || importLoading}>
              {importLoading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
