// src/pages/Expenditure.jsx
import React, { useEffect, useState } from 'react';
import { expensesApi, departmentsApi, budgetsApi, commitmentsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const CATEGORIES = ['Cloud Infrastructure','Software License','Digital Marketing','Logistics','Utilities','Travel','Other'];

export default function Expenditure() {
  const { canViewAllDepts } = useAuth();
  const [expenses, setExpenses]       = useState([]);
  const [depts, setDepts]             = useState([]);
  const [budgets, setBudgets]         = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm] = useState({
    department_id: '', budget_id: '', commitment_id: '',
    vendor: '', amount: '', expense_date: '',
    category: 'Cloud Infrastructure',
  });

  const load = () => {
    Promise.all([
      expensesApi.list(), departmentsApi.list(),
      budgetsApi.list(), commitmentsApi.list()
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

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await expensesApi.create({
        department_id:  +form.department_id,
        budget_id:      +form.budget_id,
        commitment_id:  form.commitment_id ? +form.commitment_id : null,
        vendor:         form.vendor,
        amount:         +form.amount,
        expense_date:   form.expense_date || undefined,
        category:       form.category,
      });
      setForm({ department_id: '', budget_id: '', commitment_id: '', vendor: '', amount: '', expense_date: '', category: 'Cloud Infrastructure' });
      load();
    } catch (err) { setError(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const getDeptName   = (id) => depts.find(d => d.department_id === id)?.department_name || '—';
  const totalSpent    = expenses.reduce((a, e) => a + +(e.amount || 0), 0);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Expenditure Tracking</div>
          <div className="ph-sub">Real-time actual expenses across all departments</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost">⬇ Export CSV</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Total Spent</div><div className="kpi-value">{fmt(totalSpent)}</div></div>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Total Records</div><div className="kpi-value" style={{ color: 'var(--accent)' }}>{expenses.length}</div></div>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Departments</div><div className="kpi-value" style={{ color: 'var(--accent3)' }}>{depts.length}</div></div>
        <div className="kpi-card"><div className="kpi-icon"></div><div className="kpi-label">Budgets Active</div><div className="kpi-value" style={{ color: 'var(--warn)' }}>{budgets.length}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">{canViewAllDepts ? 'All Expenses' : 'My Expenses'}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>
                <th>ID</th><th>Dept</th><th>Vendor</th><th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th><th>Date</th><th>Budget</th>
              </tr></thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 24 }}>No expenses yet</td></tr>
                ) : expenses.map(e => (
                  <tr key={e.expense_id}>
                    <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>EXP-{String(e.expense_id).padStart(4,'0')}</td>
                    <td><span className="chip chip-blue">{getDeptName(e.department_id)}</span></td>
                    <td>{e.vendor || '—'}</td>
                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>{e.category || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.expense_date || '—'}</td>
                    <td><span className="chip chip-accent" style={{ fontSize: 9 }}>BDG-{e.budget_id}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">Log New Expense</div>
            <span className="chip chip-warn">Triggers Alerts</span>
          </div>
          <div className="card-body">
            {error && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</div>}
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Department</label>
                  <select required value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value, budget_id: '', commitment_id: '' })}>
                    <option value="">Select...</option>
                    {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Budget</label>
                  <select required value={form.budget_id} onChange={e => setForm({ ...form, budget_id: e.target.value, commitment_id: '' })}>
                    <option value="">Select budget...</option>
                    {filteredBudgets.map(b => <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} (FY {b.budget_year})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Commitment (optional)</label>
                  <select value={form.commitment_id} onChange={e => setForm({ ...form, commitment_id: e.target.value })}>
                    <option value="">No commitment (will trigger alert)</option>
                    {filteredCommitments.map(c => <option key={c.commitment_id} value={c.commitment_id}>CMT-{c.commitment_id}: {c.description}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Vendor</label>
                  <input type="text" placeholder="e.g. AWS" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Amount (₹)</label>
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
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--warn)' }}>
                ⚡ Submitting triggers automatic assurance checks and alert generation
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Submit Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
