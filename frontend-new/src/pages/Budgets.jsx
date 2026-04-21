// src/pages/Budgets.jsx
import React, { useEffect, useState } from 'react';
import { budgetsApi, departmentsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Budgets() {
  const { canCreateBudget, canDeleteBudget, selectedYear } = useAuth();
  const [budgets, setBudgets]     = useState([]);
  const [summaries, setSummaries] = useState({});
  const [depts, setDepts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [form, setForm] = useState({ department_id: '', budget_year: selectedYear, allocated_budget: '' });

  const load = async () => {
    try {
      const [bRes, dRes] = await Promise.all([budgetsApi.list(), departmentsApi.list()]);
      const allBudgets = bRes.data || [];
      const allDepts   = dRes.data || [];
      setBudgets(allBudgets);
      setDepts(allDepts);
      // Load summaries for each budget
      const sums = {};
      await Promise.all(allBudgets.map(async b => {
        try {
          const r = await budgetsApi.summary(b.budget_id);
          sums[b.budget_id] = r.data;
        } catch {}
      }));
      setSummaries(sums);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [selectedYear]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await budgetsApi.create({ ...form, department_id: +form.department_id, allocated_budget: +form.allocated_budget, budget_year: +form.budget_year });
      setForm({ department_id: '', budget_year: selectedYear, allocated_budget: '' });
      load();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create budget'); }
    finally { setSaving(false); }
  };

  const getDeptName = (dept_id) => depts.find(d => d.department_id === dept_id)?.department_name || '—';

  const filteredBudgets = budgets.filter(b => b.budget_year === selectedYear);
  const totalAllocated  = filteredBudgets.reduce((a, b) => a + +(summaries[b.budget_id]?.allocated_budget || b.allocated_budget || 0), 0);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Budget Management</div>
          <div className="ph-sub">FY {selectedYear} — Create and manage department budgets</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi-card"><div className="kpi-label">Departments</div><div className="kpi-value">{depts.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Budgeted</div><div className="kpi-value" style={{ color: 'var(--success)' }}>{fmt(totalAllocated)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Budget Lines</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{filteredBudgets.length}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: canCreateBudget ? '1.5fr 1fr' : '1fr', gap: 20 }}>

        {/* Budget Table */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Active Budgets</div>
            <span className="chip chip-accent">FY {selectedYear}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>
                <th>ID</th><th>Department</th>
                <th style={{ textAlign: 'right' }}>Allocated</th>
                <th style={{ textAlign: 'right' }}>Committed</th>
                <th style={{ textAlign: 'right' }}>Spent</th>
                <th style={{ textAlign: 'right' }}>Remaining</th>
                <th>Utilization</th>
              </tr></thead>
              <tbody>
                {filteredBudgets.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No budgets for FY {selectedYear}</td></tr>
                ) : filteredBudgets.map(b => {
                  const s = summaries[b.budget_id] || {};
                  const pct = s.allocated_budget > 0 ? ((s.spent_amount / s.allocated_budget) * 100).toFixed(1) : 0;
                  const pillClass = pct >= 100 ? 'pill-danger' : pct >= 80 ? 'pill-warn' : 'pill-ok';
                  return (
                    <tr key={b.budget_id}>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>BDG-{b.budget_id}</td>
                      <td style={{ fontWeight: 700 }}>{getDeptName(b.department_id)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(s.allocated_budget || b.allocated_budget)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmt(s.committed_amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--warn)' }}>{fmt(s.spent_amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: s.remaining_amount < 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(s.remaining_amount)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 70, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warn)' : 'var(--accent)', borderRadius: 3 }} />
                          </div>
                          <span className={`pill ${pillClass}`}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create Form */}
        {canCreateBudget ? (
          <div className="card">
            <div className="card-head"><div className="card-title">Create New Budget</div></div>
            <div className="card-body">
              {error && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</div>}
              <form onSubmit={submit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Department</label>
                    <select required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })}>
                      <option value="">Select...</option>
                      {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fiscal Year</label>
                    <select value={form.budget_year} onChange={e => setForm({ ...form, budget_year: +e.target.value })}>
                      <option value={2024}>FY 2024</option>
                      <option value={2025}>FY 2025</option>
                      <option value={2026}>FY 2026</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Allocated Budget (₹)</label>
                    <input type="number" required placeholder="e.g. 1000000" value={form.allocated_budget} onChange={e => setForm({ ...form, allocated_budget: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Budget'}</button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head"><div className="card-title">Access Info</div></div>
            <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>View Only Access</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Budget creation requires Finance Manager or Admin role.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
