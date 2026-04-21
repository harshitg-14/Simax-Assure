// src/pages/Departments.jsx
import React, { useEffect, useState } from 'react';
import { departmentsApi, budgetsApi } from '../api/services';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const DEPT_ICONS   = { 'Marketing': '📣', 'Information Technology': '💻', 'IT': '💻', 'Operations': '⚙️' };
const DEPT_COLORS  = [
  { bg: 'rgba(244,63,94,0.12)',  accent: 'var(--danger)' },
  { bg: 'rgba(91,143,255,0.12)', accent: 'var(--accent3)' },
  { bg: 'rgba(212,160,23,0.10)', accent: 'var(--accent)' },
  { bg: 'rgba(34,211,160,0.10)', accent: 'var(--success)' },
];

const DB_TABLES = [
  { name: 'departments', color: 'var(--accent)',  fields: ['department_id (PK)', 'department_name', 'manager_name', 'created_date'] },
  { name: 'budgets',     color: 'var(--accent3)', fields: ['budget_id (PK)', 'department_id (FK)', 'budget_year', 'allocated_budget', 'created_date'] },
  { name: 'commitments', color: 'var(--warn)',    fields: ['commitment_id (PK)', 'budget_id (FK)', 'department_id (FK)', 'description', 'amount', 'commitment_date'] },
  { name: 'expenses',    color: 'var(--success)', fields: ['expense_id (PK)', 'budget_id (FK)', 'commitment_id (FK)', 'department_id (FK)', 'vendor', 'amount', 'expense_date', 'category'] },
  { name: 'alerts',      color: 'var(--danger)',  fields: ['alert_id (PK)', 'department_id (FK)', 'alert_code', 'severity', 'title', 'message', 'status', 'owner_role', 'due_date'] },
];

export default function Departments() {
  const [depts, setDepts]     = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm] = useState({ department_name: '', manager_name: '' });

  const load = () => {
    Promise.all([departmentsApi.list(), budgetsApi.list()])
      .then(([d, b]) => { setDepts(d.data || []); setBudgets(b.data || []); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await departmentsApi.create(form);
      setForm({ department_name: '', manager_name: '' });
      setShowForm(false); load();
    } catch (err) { setError(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const getDeptBudgets = (deptId) => budgets.filter(b => b.department_id === deptId);
  const getTotalBudget = (deptId) => getDeptBudgets(deptId).reduce((a, b) => a + +b.allocated_budget, 0);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Department Management</div>
          <div className="ph-sub">Manage departments, budgets, and financial health</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Department'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><div className="card-title">New Department</div></div>
          <div className="card-body">
            {error && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 14 }}>{error}</div>}
            <form onSubmit={submit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Department Name</label>
                  <input type="text" required placeholder="e.g. Finance" value={form.department_name} onChange={e => setForm({ ...form, department_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Manager Name</label>
                  <input type="text" placeholder="e.g. R. Mehta" value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Department'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 24 }}>
        {depts.map((dept, idx) => {
          const colors     = DEPT_COLORS[idx % DEPT_COLORS.length];
          const icon       = DEPT_ICONS[dept.department_name] || '🏢';
          const totalBudget = getTotalBudget(dept.department_id);
          const deptBudgets = getDeptBudgets(dept.department_id);

          return (
            <div key={dept.department_id} className="card">
              <div style={{ background: colors.bg, borderBottom: '1px solid var(--border)', padding: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 17, fontWeight: 800 }}>{dept.department_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 3 }}>
                  Manager: {dept.manager_name || '—'}
                </div>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text3)' }}>Total Budget</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: colors.accent }}>{fmt(totalBudget)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text3)' }}>Budget Lines</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{deptBudgets.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text3)' }}>Dept ID</span>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)' }}>#{dept.department_id}</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text3)' }}>Created</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{dept.created_date || '—'}</span>
                  </div>
                </div>
                {deptBudgets.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>Budgets</div>
                    {deptBudgets.slice(0, 3).map(b => (
                      <div key={b.budget_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4, fontFamily: 'var(--mono)' }}>
                        <span style={{ color: 'var(--text3)' }}>FY {b.budget_year}</span>
                        <span style={{ color: colors.accent }}>{fmt(b.allocated_budget)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DB Schema */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">SQLite Database Schema</div>
          <span className="chip chip-accent">5 Tables</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
            {DB_TABLES.map(table => (
              <div key={table.name} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontFamily: 'var(--mono)', fontSize: 11 }}>
                <div style={{ color: table.color, fontWeight: 700, marginBottom: 10, fontSize: 12 }}>{table.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {table.fields.map(f => (
                    <div key={f} style={{ color: f.includes('(PK)') ? 'var(--accent)' : f.includes('(FK)') ? 'var(--accent3)' : 'var(--text3)', lineHeight: 1.4 }}>{f}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
