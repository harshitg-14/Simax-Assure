import { useEffect, useState } from 'react';
import { budgetsApi, departmentsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Budgets() {
  const { canCreateBudget, selectedYear } = useAuth();
  const [budgets, setBudgets]     = useState([]);
  const [summaries, setSummaries] = useState({});
  const [depts, setDepts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [form, setForm] = useState({ department_id: '', budget_year: selectedYear, allocated_budget: '' });

  const load = async () => {
    try {
      const [bRes, dRes, kpiRes] = await Promise.all([
        budgetsApi.list(),
        departmentsApi.list(),
        budgetsApi.getKPIs(selectedYear),
      ]);
      setBudgets(bRes.data || []);
      setDepts(dRes.data || []);
      const sums = {};
      (kpiRes.data?.departments || []).forEach(d => { sums[d.budget_id] = d; });
      setSummaries(sums);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [selectedYear]);

  const del = async (id) => {
    if (!window.confirm('Delete this budget? This cannot be undone.')) return;
    await budgetsApi.delete(id);
    load();
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await budgetsApi.create({
        ...form,
        department_id:    +form.department_id,
        allocated_budget: +form.allocated_budget,
        budget_year:      +form.budget_year,
      });
      setForm({ department_id: '', budget_year: selectedYear, allocated_budget: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create budget.');
    } finally {
      setSaving(false);
    }
  };

  const getDeptName      = (id) => depts.find(d => d.department_id === id)?.department_name || '—';
  const filteredBudgets  = budgets.filter(b => b.budget_year === selectedYear);
  const totalAllocated   = filteredBudgets.reduce((a, b) => a + +(summaries[b.budget_id]?.allocated_budget || b.allocated_budget || 0), 0);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Budget Management</div>
          <div className="ph-sub">FY {selectedYear} &nbsp;&middot;&nbsp; Department budget allocation and utilization</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Departments</div>
          <div className="kpi-value">{depts.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Allocated</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{fmt(totalAllocated)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Budget Lines</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{filteredBudgets.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: canCreateBudget ? '1.5fr 1fr' : '1fr', gap: 20 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Active Budgets</div>
            <span className="chip chip-accent">FY {selectedYear}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Department</th>
                  <th style={{ textAlign: 'right' }}>Allocated</th>
                  <th style={{ textAlign: 'right' }}>Committed</th>
                  <th style={{ textAlign: 'right' }}>Spent</th>
                  <th style={{ textAlign: 'right' }}>Remaining</th>
                  <th>Utilization</th>
                  {canCreateBudget && <th />}
                </tr>
              </thead>
              <tbody>
                {filteredBudgets.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>
                      No budgets for FY {selectedYear}
                    </td>
                  </tr>
                ) : filteredBudgets.map(b => {
                  const s   = summaries[b.budget_id] || {};
                  const pct = s.allocated_budget > 0
                    ? ((s.spent_amount / s.allocated_budget) * 100).toFixed(1)
                    : 0;
                  const barColor = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : 'var(--accent)';
                  return (
                    <tr key={b.budget_id}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>BDG-{b.budget_id}</td>
                      <td style={{ fontWeight: 600 }}>{getDeptName(b.department_id)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(s.allocated_budget || b.allocated_budget)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(s.committed_amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{fmt(s.spent_amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: s.remaining_amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {fmt(s.remaining_amount)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 64, height: 5, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: barColor }}>{pct}%</span>
                        </div>
                      </td>
                      {canCreateBudget && (
                        <td>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '3px 10px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                            onClick={() => del(b.budget_id)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {canCreateBudget ? (
          <div className="card">
            <div className="card-head">
              <div className="card-title">New Budget</div>
            </div>
            <div className="card-body">
              {error && (
                <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={submit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label>Department</label>
                    <select required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                      <option value="">Select department</option>
                      {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fiscal Year</label>
                    <select value={form.budget_year} onChange={e => setForm({ ...form, budget_year: +e.target.value })}>
                      {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>FY {y}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Allocated Budget (&#8377;)</label>
                    <input
                      type="number" required placeholder="e.g. 5000000"
                      value={form.allocated_budget}
                      onChange={e => setForm({ ...form, allocated_budget: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Creating...' : 'Create Budget'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head"><div className="card-title">Access</div></div>
            <div className="card-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', color: 'var(--text3)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>View Only</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
                Budget creation requires Finance Manager or Administrator role.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
