import { useEffect, useState } from 'react';
import { departmentsApi, budgetsApi } from '../api/services';
import './Dashboard.css';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const ACCENT_COLORS = [
  { bg: 'rgba(220,38,38,0.07)',   accent: 'var(--danger)' },
  { bg: 'rgba(91,143,255,0.08)',  accent: 'var(--accent3)' },
  { bg: 'rgba(201,151,10,0.07)',  accent: 'var(--accent)' },
  { bg: 'rgba(5,150,105,0.07)',   accent: 'var(--success)' },
];

export default function Departments() {
  const [depts, setDepts]       = useState([]);
  const [budgets, setBudgets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [form, setForm]         = useState({ department_name: '', manager_name: '' });

  const [editId, setEditId]     = useState(null);
  const [editForm, setEditForm] = useState({ department_name: '', manager_name: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState('');

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
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (dept) => {
    setEditId(dept.department_id);
    setEditForm({ department_name: dept.department_name, manager_name: dept.manager_name || '' });
    setEditError('');
  };

  const submitEdit = async (e) => {
    e.preventDefault(); setEditSaving(true); setEditError('');
    try {
      await departmentsApi.update(editId, editForm);
      setEditId(null);
      load();
    } catch (err) {
      setEditError(err.response?.data?.detail || 'Failed to update department.');
    } finally {
      setEditSaving(false);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Delete this department? All associated budgets may be affected.')) return;
    await departmentsApi.delete(id);
    load();
  };

  const getDeptBudgets = (deptId) => budgets.filter(b => b.department_id === deptId);
  const getTotalBudget = (deptId) => getDeptBudgets(deptId).reduce((a, b) => a + +b.allocated_budget, 0);

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Departments</div>
          <div className="ph-sub">Organizational units, budget allocation, and financial health</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); }}>
            {showForm ? 'Cancel' : '+ Add Department'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><div className="card-title">New Department</div></div>
          <div className="card-body">
            {error && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
                {error}
              </div>
            )}
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editId && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid var(--accent)' }}>
          <div className="card-head">
            <div className="card-title">Edit Department</div>
            <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setEditId(null)}>Cancel</button>
          </div>
          <div className="card-body">
            {editError && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>
                {editError}
              </div>
            )}
            <form onSubmit={submitEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Department Name</label>
                  <input type="text" required value={editForm.department_name} onChange={e => setEditForm({ ...editForm, department_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Manager Name</label>
                  <input type="text" value={editForm.manager_name} onChange={e => setEditForm({ ...editForm, manager_name: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 24 }}>
        {depts.map((dept, idx) => {
          const colors      = ACCENT_COLORS[idx % ACCENT_COLORS.length];
          const totalBudget = getTotalBudget(dept.department_id);
          const deptBudgets = getDeptBudgets(dept.department_id);
          const initials    = dept.department_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={dept.department_id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ background: colors.bg, borderBottom: '1px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: colors.accent, opacity: 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--bg)', flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{dept.department_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                    {dept.manager_name ? `Manager: ${dept.manager_name}` : 'No manager assigned'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '3px 8px', fontSize: 10 }}
                    onClick={() => { startEdit(dept); setShowForm(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >Edit</button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '3px 8px', fontSize: 10, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                    onClick={() => del(dept.department_id)}
                  >Delete</button>
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
                  {dept.created_date && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--text3)' }}>Created</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{dept.created_date}</span>
                      </div>
                    </>
                  )}
                  {deptBudgets.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                        Budget Lines
                      </div>
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
            </div>
          );
        })}

        {depts.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text3)', padding: '40px 0', fontSize: 13 }}>
            No departments configured.
          </div>
        )}
      </div>
    </div>
  );
}
