import { useEffect, useState } from 'react';
import { commitmentsApi, departmentsApi, budgetsApi } from '../api/services';
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

export default function Commitments() {
  const { isDeptHead, userDeptId } = useAuth();

  const [commitments, setCommitments] = useState([]);
  const [depts, setDepts]             = useState([]);
  const [budgets, setBudgets]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm] = useState({
    budget_id: '', department_id: isDeptHead && userDeptId ? String(userDeptId) : '',
    description: '', amount: '',
  });

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

  const del = async (id) => {
    if (!window.confirm('Delete this commitment?')) return;
    await commitmentsApi.delete(id);
    load();
  };

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await commitmentsApi.create({
        budget_id:     +form.budget_id,
        department_id: +form.department_id,
        description:   form.description,
        amount:        +form.amount,
      });
      setForm({ budget_id: '', department_id: isDeptHead && userDeptId ? String(userDeptId) : '', description: '', amount: '' });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create commitment.');
    } finally {
      setSaving(false);
    }
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
          <div className="ph-sub">Funds reserved against approved budgets &mdash; contracts, purchase orders, and licenses</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Reserved</div>
          <div className="kpi-value" style={{ color: 'var(--accent)' }}>{fmt(totalCommitted)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Commitment Records</div>
          <div className="kpi-value">{commitments.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Departments</div>
          <div className="kpi-value">{depts.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">All Commitments</div>
            <span className="chip chip-accent">{commitments.length} Records</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Department</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>FY</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {commitments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 28, fontSize: 12 }}>
                      No commitments recorded
                    </td>
                  </tr>
                ) : commitments.map(c => (
                  <tr key={c.commitment_id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                      CMT-{String(c.commitment_id).padStart(3, '0')}
                    </td>
                    <td><span className="chip chip-blue">{getDeptName(c.department_id)}</span></td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {c.description}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(c.amount)}</td>
                    <td style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', fontSize: 11 }}>{getBudgetYear(c.budget_id)}</td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{c.commitment_date || '—'}</td>
                    <td><StatusPill status={c.status} /></td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '3px 10px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                        onClick={() => del(c.commitment_id)}
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
            <div className="card-title">New Commitment</div>
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
                  <select
                    required
                    disabled={isDeptHead && !!userDeptId}
                    value={form.department_id}
                    onChange={e => setForm({ ...form, department_id: e.target.value, budget_id: '' })}
                  >
                    <option value="">Select department</option>
                    {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Budget</label>
                  <select required value={form.budget_id} onChange={e => setForm({ ...form, budget_id: e.target.value })}>
                    <option value="">Select budget</option>
                    {filteredBudgets.map(b => (
                      <option key={b.budget_id} value={b.budget_id}>
                        BDG-{b.budget_id} &middot; FY {b.budget_year}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text" required placeholder="e.g. Annual software license"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Reserved Amount (&#8377;)</label>
                  <input
                    type="number" required placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Reserve Commitment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
