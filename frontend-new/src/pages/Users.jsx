import { useEffect, useState } from 'react';
import { usersApi, departmentsApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const ROLES = ['admin', 'finance_manager', 'department_head', 'viewer'];

const ROLE_META = {
  admin:            { label: 'Admin'           },
  finance_manager:  { label: 'Finance Manager' },
  department_head:  { label: 'Dept Head'       },
  viewer:           { label: 'Viewer'          },
};

function RolePill({ role }) {
  const m = ROLE_META[role] || { label: role };
  return (
    <span style={{
      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 500,
      padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: 'var(--surface3)', color: 'var(--text2)',
    }}>
      {m.label}
    </span>
  );
}

const BLANK_FORM = { username: '', email: '', password: '', role: 'viewer', department_id: '' };

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers]     = useState([]);
  const [depts, setDepts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm]       = useState(BLANK_FORM);

  const [editId, setEditId]       = useState(null);
  const [editRole, setEditRole]   = useState('');
  const [editDept, setEditDept]   = useState('');

  const load = async () => {
    try {
      const [ur, dr] = await Promise.all([usersApi.list(), departmentsApi.list()]);
      setUsers(ur.data || []);
      setDepts(dr.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getDeptName = (id) => depts.find(d => d.department_id === id)?.department_name || null;

  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      await usersApi.create({
        ...form,
        department_id: form.role === 'department_head' && form.department_id ? +form.department_id : null,
      });
      setForm(BLANK_FORM);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create user.');
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async (id) => {
    try {
      await usersApi.update(id, {
        role: editRole,
        department_id: editRole === 'department_head' && editDept ? +editDept : null,
      });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update.');
    }
  };

  const del = async (id, username) => {
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await usersApi.delete(id);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete user.');
    }
  };

  const counts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">

      <div className="ph">
        <div>
          <div className="ph-title">User Management</div>
          <div className="ph-sub">{users.length} total accounts &nbsp;&middot;&nbsp; Admin access only</div>
        </div>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
        {[
          { label: 'Total Users',      value: users.length,           color: 'var(--accent2)' },
          { label: 'Admins',           value: counts.admin,           color: 'var(--danger)'  },
          { label: 'Finance Managers', value: counts.finance_manager, color: 'var(--warn)'    },
          { label: 'Dept Heads',       value: counts.department_head, color: 'var(--accent3)' },
        ].map((k, i) => (
          <div className="kpi-card" key={i}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        <div className="card">
          <div className="card-head">
            <div className="card-title">All Users</div>
            <span className="chip chip-accent">{users.length} accounts</span>
          </div>

          {error && (
            <div style={{ margin: '12px 20px 0', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '9px 14px', fontSize: 12, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                      USR-{u.user_id}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 7,
                          background: 'var(--surface2)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                          color: 'var(--accent2)', flexShrink: 0,
                        }}>
                          {u.username[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.username}</span>
                        {u.user_id === me?.user_id && (
                          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>YOU</span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{u.email}</td>
                    <td>
                      {editId === u.user_id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={editRole}
                            onChange={e => { setEditRole(e.target.value); if (e.target.value !== 'department_head') setEditDept(''); }}
                            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 7px' }}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, color: 'var(--success)', borderColor: 'rgba(5,150,105,0.3)' }} onClick={() => saveRole(u.user_id)}>Save</button>
                          <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setEditId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <RolePill role={u.role} />
                      )}
                    </td>
                    <td>
                      {editId === u.user_id && editRole === 'department_head' ? (
                        <select
                          value={editDept}
                          onChange={e => setEditDept(e.target.value)}
                          style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 7px', width: '100%' }}
                        >
                          <option value="">— no dept —</option>
                          {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                        </select>
                      ) : u.role === 'department_head' ? (
                        getDeptName(u.department_id)
                          ? <span style={{ fontSize: 11, color: 'var(--text2)' }}>{getDeptName(u.department_id)}</span>
                          : <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--danger)' }}>Unassigned</span>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '3px 9px', fontSize: 11 }}
                          onClick={() => { setEditId(u.user_id); setEditRole(u.role); setEditDept(u.department_id ? String(u.department_id) : ''); }}
                          disabled={editId === u.user_id}
                        >
                          Edit Role
                        </button>
                        {u.user_id !== me?.user_id && (
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '3px 9px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.25)' }}
                            onClick={() => del(u.user_id, u.username)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div className="card-title">New User</div>
          </div>
          <div className="card-body">
            <form onSubmit={submit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div className="form-group">
                  <label>Username</label>
                  <input required placeholder="e.g. john_doe" value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input required type="email" placeholder="user@simax.com" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input required type="password" placeholder="Min 4 characters" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, department_id: '' })}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>)}
                  </select>
                </div>
                {form.role === 'department_head' && (
                  <div className="form-group">
                    <label>Department</label>
                    <select
                      value={form.department_id}
                      onChange={e => setForm({ ...form, department_id: e.target.value })}
                    >
                      <option value="">— select department —</option>
                      {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
