// src/pages/Commitments.jsx
import React, { useEffect, useState } from 'react';
import { commitmentsApi, departmentsApi, budgetsApi } from '../api/services';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function Commitments() {
  const [commitments, setCommitments] = useState([]);
  const [depts, setDepts]             = useState([]);
  const [budgets, setBudgets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm] = useState({ budget_id: '', department_id: '', description: '', amount: '', commitment_date: '' });

  const load = () => {
    Promise.all([commitmentsApi.list(), departmentsApi.list(), budgetsApi.list()])
      .then(([c, d, b]) => {
        setCommitments(c.data || []);
        setDepts(d.data || []);
        setBudgets(b.data || []);
      }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filteredBudgets = form.department_id
    ? budgets.filter(b => b.department_id === +form.department_id)
    : budgets;

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await commitmentsApi.create({
        budget_id:     +form.budget_id,
        department_id: +form.department_id,
        description:   form.description,
        amount:        +form.amount,
      });
      setForm({ budget_id: '', department_id: '', description: '', amount: '', commitment_date: '' });
      load();
    } catch (err) { setError(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const getDeptName   = (id) => depts.find(d => d.department_id === id)?.department_name || '—';
  const getBudgetYear = (id) => budgets.find(b => b.budget_id === id)?.budget_year || '—';
  const totalCommitted = commitments.reduce((a, c) => a + +(c.amount || 0), 0);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Commitment Tracking</div>
          <div className="ph-sub">Money reserved but not yet spent — contracts, POs, licenses</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Total Committed</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmt(totalCommitted)}</div></div>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Total Records</div><div className="kpi-value">{commitments.length}</div></div>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Departments</div><div className="kpi-value">{depts.length}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-head"><div className="card-title">All Commitments</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>
                <th>ID</th><th>Department</th><th>Description</th>
                <th style={{ textAlign: 'right' }}>Amount</th><th>FY</th><th>Date</th>
              </tr></thead>
              <tbody>
                {commitments.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No commitments yet</td></tr>
                ) : commitments.map(c => (
                  <tr key={c.commitment_id}>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>CMT-{String(c.commitment_id).padStart(3,'0')}</td>
                    <td><span className="chip chip-blue">{getDeptName(c.department_id)}</span></td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.description}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(c.amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>{getBudgetYear(c.budget_id)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{c.commitment_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><div className="card-title">Add New Commitment</div></div>
          <div className="card-body">
            {error && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</div>}
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Department</label>
                  <select required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value, budget_id: '' })}>
                    <option value="">Select...</option>
                    {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Budget</label>
                  <select required value={form.budget_id} onChange={e => setForm({ ...form, budget_id: e.target.value })}>
                    <option value="">Select budget...</option>
                    {filteredBudgets.map(b => <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} (FY {b.budget_year})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description</label>
                  <input type="text" required placeholder="e.g. Software license purchase" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Amount (₹)</label>
                  <input type="number" required placeholder="Reserved amount" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Reserve Commitment'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
