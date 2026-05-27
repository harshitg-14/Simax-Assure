import { useEffect, useState, useCallback } from 'react';
import { revisionsApi, budgetsApi, departmentsApi } from '../api/services';
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
      padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase',
      background: c.bg, color: c.color }}>
      {s}
    </span>
  );
}

export default function BudgetRevisions() {
  const { isAdmin, isFinanceManager, user } = useAuth();
  const canApprove = isAdmin || isFinanceManager;

  const [revisions,   setRevisions]   = useState([]);
  const [budgets,     setBudgets]     = useState([]);
  const [depts,       setDepts]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('pending');
  const [busy,        setBusy]        = useState(null);
  const [rejectItem,  setRejectItem]  = useState(null);
  const [rejectReason,setRejectReason]= useState('');
  const [toast,       setToast]       = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({ budget_id: '', requested_amount: '', reason: '' });
  const [formErr,     setFormErr]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [r, b, d] = await Promise.all([
        revisionsApi.list(),
        budgetsApi.list(),
        departmentsApi.list(),
      ]);
      setRevisions(r.data || []);
      setBudgets(b.data  || []);
      setDepts(d.data    || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending  = revisions.filter(r => r.status === 'pending');
  const history  = revisions.filter(r => r.status !== 'pending');

  const approve = async (id) => {
    setBusy(id);
    try {
      await revisionsApi.approve(id);
      showToast('Budget revision approved — budget updated');
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to approve');
    } finally { setBusy(null); }
  };

  const confirmReject = async () => {
    if (!rejectItem) return;
    setBusy(rejectItem);
    try {
      await revisionsApi.reject(rejectItem, rejectReason);
      showToast('Revision rejected');
      setRejectItem(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to reject');
    } finally { setBusy(null); }
  };

  const submitRequest = async () => {
    setFormErr('');
    if (!form.budget_id)        return setFormErr('Please select a budget.');
    if (!form.requested_amount) return setFormErr('Please enter the requested amount.');
    if (+form.requested_amount <= 0) return setFormErr('Amount must be greater than 0.');
    if (!form.reason.trim())    return setFormErr('Please provide a reason.');

    setSubmitting(true);
    try {
      await revisionsApi.create({
        budget_id:        +form.budget_id,
        requested_amount: +form.requested_amount,
        reason:           form.reason.trim(),
      });
      showToast('Revision request submitted — finance team notified');
      setShowForm(false);
      setForm({ budget_id: '', requested_amount: '', reason: '' });
      load();
    } catch (e) {
      setFormErr(e.response?.data?.detail || 'Submission failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  const myBudgets = budgets.filter(b => {
    if (isAdmin || isFinanceManager) return true;
    const dept = depts.find(d => d.department_id === user?.department_id);
    return dept && b.department_id === dept.department_id;
  });

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div className="page fade-in">

      {/* Header */}
      <div className="ph">
        <div>
          <div className="ph-title">Budget Revisions</div>
          <div className="ph-sub">
            {canApprove
              ? 'Review and action budget revision requests from departments'
              : 'Request a budget increase for your department'}
          </div>
        </div>
        <div className="ph-actions">
          {!canApprove && (
            <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormErr(''); }}>
              + Request Revision
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Pending</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{revisions.filter(r => r.status === 'pending').length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Approved</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{revisions.filter(r => r.status === 'approved').length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rejected</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{revisions.filter(r => r.status === 'rejected').length}</div>
        </div>
      </div>

      {/* Request form (dept head) */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div className="card-title">New Revision Request</div>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
              onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label>Budget</label>
                <select value={form.budget_id}
                  onChange={e => setForm({ ...form, budget_id: e.target.value })}>
                  <option value="">Select budget</option>
                  {myBudgets.map(b => {
                    const dept = depts.find(d => d.department_id === b.department_id);
                    return (
                      <option key={b.budget_id} value={b.budget_id}>
                        BDG-{b.budget_id} · {dept?.department_name} · FY {b.budget_year} · {fmt(b.allocated_budget)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label>Requested Amount (INR)</label>
                <input type="number" placeholder="New total budget amount"
                  value={form.requested_amount}
                  onChange={e => setForm({ ...form, requested_amount: e.target.value })} />
              </div>
            </div>
            {form.budget_id && form.requested_amount && (() => {
              const b = budgets.find(b => b.budget_id === +form.budget_id);
              if (!b) return null;
              const diff = +form.requested_amount - +b.allocated_budget;
              const color = diff >= 0 ? 'var(--success)' : 'var(--danger)';
              return (
                <div style={{ marginBottom: 14, padding: '8px 14px', background: 'var(--surface2)',
                  borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                  Current: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(b.allocated_budget)}</span>
                  <span style={{ margin: '0 10px', color: 'var(--text3)' }}>→</span>
                  Requested: <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(form.requested_amount)}</span>
                  <span style={{ marginLeft: 12, fontFamily: 'var(--mono)', fontWeight: 700, color }}>
                    {diff >= 0 ? '+' : ''}{fmt(diff)}
                  </span>
                </div>
              );
            })()}
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label>Reason for Revision</label>
              <textarea rows={3} placeholder="Explain why this budget increase is needed..."
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
                  borderRadius: 6, color: 'var(--text)', fontSize: 13, padding: '9px 11px',
                  fontFamily: 'var(--sans)', resize: 'vertical', outline: 'none' }} />
            </div>
            {formErr && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{formErr}</div>}
            <button className="btn btn-primary" onClick={submitRequest} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20,
        background: 'var(--surface2)', borderRadius: 8, padding: 4,
        border: '1px solid var(--border)', width: 'fit-content' }}>
        {['pending', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', border: 'none', fontFamily: 'var(--sans)',
            background: tab === t ? 'var(--surface)' : 'transparent',
            color: tab === t ? 'var(--text)' : 'var(--text3)',
            boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
            transition: 'all 0.15s',
          }}>
            {t === 'pending' ? `Pending${pending.length > 0 ? ` (${pending.length})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Pending Revision Requests</div>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              {pending.length} pending
            </span>
          </div>
          {pending.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              No pending revision requests
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Department</th>
                    <th>FY</th>
                    <th style={{ textAlign: 'right' }}>Current Budget</th>
                    <th style={{ textAlign: 'right' }}>Requested</th>
                    <th style={{ textAlign: 'right' }}>Difference</th>
                    <th>Requested By</th>
                    <th>Reason</th>
                    {canApprove && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pending.map(r => (
                    <>
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{r.ref}</td>
                        <td><span className="chip chip-blue">{r.department_name}</span></td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{r.budget_year}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmt(r.current_amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(r.requested_amount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700,
                          color: r.difference >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {r.difference >= 0 ? '+' : ''}{fmt(r.difference)}
                        </td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{r.requested_by}</td>
                        <td style={{ fontSize: 11, color: 'var(--text2)', maxWidth: 180,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={r.reason}>{r.reason}</td>
                        {canApprove && (
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {rejectItem === r.id ? null : (
                              <>
                                <button className="btn btn-primary"
                                  style={{ padding: '3px 12px', fontSize: 11, marginRight: 6 }}
                                  disabled={busy === r.id}
                                  onClick={() => approve(r.id)}>
                                  Approve
                                </button>
                                <button className="btn btn-ghost"
                                  style={{ padding: '3px 12px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                  onClick={() => { setRejectItem(r.id); setRejectReason(''); }}>
                                  Reject
                                </button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                      {rejectItem === r.id && (
                        <tr key={`rej-${r.id}`}>
                          <td colSpan={canApprove ? 9 : 8}
                            style={{ background: 'rgba(220,38,38,0.04)', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <textarea rows={2} placeholder="Reason for rejection (optional)"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)',
                                  borderRadius: 5, color: 'var(--text)', fontSize: 12, padding: '7px 10px',
                                  resize: 'none', fontFamily: 'var(--sans)', outline: 'none' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <button className="btn btn-ghost"
                                  style={{ fontSize: 11, padding: '4px 14px', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                  disabled={busy === r.id} onClick={confirmReject}>
                                  {busy === r.id ? 'Rejecting...' : 'Confirm Reject'}
                                </button>
                                <button className="btn btn-ghost"
                                  style={{ fontSize: 11, padding: '4px 14px' }}
                                  onClick={() => setRejectItem(null)}>Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Revision History</div>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              {history.length} records
            </span>
          </div>
          {history.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              No revision history yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Department</th>
                    <th>FY</th>
                    <th style={{ textAlign: 'right' }}>Old Budget</th>
                    <th style={{ textAlign: 'right' }}>New Budget</th>
                    <th style={{ textAlign: 'right' }}>Difference</th>
                    <th>Status</th>
                    <th>Reviewed By</th>
                    <th>Rejection Reason</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r, i) => (
                    <tr key={`${r.id}-${i}`}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{r.ref}</td>
                      <td><span className="chip chip-blue">{r.department_name}</span></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{r.budget_year}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{fmt(r.current_amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 }}>{fmt(r.requested_amount)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700,
                        color: r.difference >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {r.difference >= 0 ? '+' : ''}{fmt(r.difference)}
                      </td>
                      <td><StatusPill status={r.status} /></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{r.reviewed_by || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 150,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.rejection_reason || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {r.reviewed_at ? r.reviewed_at.slice(0, 10) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: 'var(--surface)', border: '1px solid var(--success)',
          borderRadius: 10, padding: '12px 20px', fontSize: 13,
          color: 'var(--success)', fontWeight: 700,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)', animation: 'fadeUp 0.3s ease' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
