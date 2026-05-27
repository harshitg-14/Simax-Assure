import { useEffect, useState, useCallback } from 'react';
import { approvalsApi, expensesApi } from '../api/services';
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

const CB_STYLE = {
  width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent2)',
};

export default function Approvals() {
  const { isAdmin, isFinanceManager } = useAuth();
  const canApprove = isAdmin || isFinanceManager;

  const [tab, setTab]           = useState('pending');
  const [pending, setPending]   = useState({ commitments: [], expenses: [] });
  const [history, setHistory]   = useState({ commitments: [], expenses: [] });
  const [summary, setSummary]   = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [toast, setToast]       = useState('');

  // Bulk selection
  const [selC, setSelC] = useState(new Set());
  const [selE, setSelE] = useState(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    try {
      const [s, p, h] = await Promise.all([
        approvalsApi.summary(),
        approvalsApi.pending(),
        approvalsApi.history(),
      ]);
      setSummary(s.data || { pending: 0, approved: 0, rejected: 0 });
      setPending(p.data || { commitments: [], expenses: [] });
      setHistory(h.data || { commitments: [], expenses: [] });
      setSelC(new Set());
      setSelE(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (type, id) => {
    setBusy(`${type}-${id}`);
    try {
      if (type === 'commitment') await approvalsApi.approveCommitment(id);
      else                       await approvalsApi.approveExpense(id);
      showToast('Approved successfully');
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to approve');
    } finally {
      setBusy(null);
    }
  };

  const startReject = (type, id) => { setRejectItem({ type, id }); setRejectReason(''); };

  const confirmReject = async () => {
    if (!rejectItem) return;
    setBusy(`${rejectItem.type}-${rejectItem.id}`);
    try {
      if (rejectItem.type === 'commitment')
        await approvalsApi.rejectCommitment(rejectItem.id, rejectReason);
      else
        await approvalsApi.rejectExpense(rejectItem.id, rejectReason);
      showToast('Rejected');
      setRejectItem(null);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Failed to reject');
    } finally {
      setBusy(null);
    }
  };

  // Bulk helpers
  const toggleC = (id) => setSelC(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleE = (id) => setSelE(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllC = () => setSelC(s => s.size === pending.commitments.length ? new Set() : new Set(pending.commitments.map(c => c.id)));
  const toggleAllE = () => setSelE(s => s.size === pending.expenses.length    ? new Set() : new Set(pending.expenses.map(e => e.id)));

  const bulkApprove = async () => {
    if (selC.size + selE.size === 0) return;
    setBulkBusy(true);
    try {
      const r = await approvalsApi.bulkAction({
        action: 'approve',
        commitment_ids: [...selC],
        expense_ids: [...selE],
      });
      showToast(r.data.detail);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Bulk approve failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkReject = async () => {
    setBulkBusy(true);
    try {
      const r = await approvalsApi.bulkAction({
        action: 'reject',
        commitment_ids: [...selC],
        expense_ids: [...selE],
        reason: bulkRejectReason,
      });
      showToast(r.data.detail);
      setBulkRejectOpen(false);
      setBulkRejectReason('');
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Bulk reject failed');
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) return <div className="page-loading"><div className="spinner" /></div>;

  const pendingTotal = pending.commitments.length + pending.expenses.length;
  const selectedTotal = selC.size + selE.size;
  const historyAll = [
    ...history.commitments,
    ...history.expenses,
  ].sort((a, b) => (b.approved_at || '').localeCompare(a.approved_at || ''));

  return (
    <>
    <div className="page fade-in">

      {/* Header */}
      <div className="ph">
        <div>
          <div className="ph-title">Approval Workflow</div>
          <div className="ph-sub">Review and approve or reject pending commitments and expenses</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="kpi-card">
          <div className="kpi-label">Awaiting Review</div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{summary.pending}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Approved</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{summary.approved}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rejected</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>{summary.rejected}</div>
        </div>
      </div>

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
            {t === 'pending' ? `Pending${pendingTotal > 0 ? ` (${pendingTotal})` : ''}` : 'History'}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {tab === 'pending' && canApprove && selectedTotal > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--surface)', border: '1px solid var(--accent2)',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          boxShadow: '0 2px 12px rgba(201,151,10,0.15)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)', flex: 1 }}>
            {selectedTotal} item{selectedTotal > 1 ? 's' : ''} selected
          </span>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '5px 16px' }}
            disabled={bulkBusy}
            onClick={bulkApprove}
          >
            {bulkBusy ? 'Processing...' : `Approve All (${selectedTotal})`}
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '5px 16px', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
            disabled={bulkBusy}
            onClick={() => { setBulkRejectOpen(true); setBulkRejectReason(''); }}
          >
            Reject All ({selectedTotal})
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => { setSelC(new Set()); setSelE(new Set()); }}
          >
            Clear
          </button>
        </div>
      )}

      {/* Pending tab */}
      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Commitments */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Commitments</div>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                {pending.commitments.length} pending
              </span>
            </div>
            {pending.commitments.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                No pending commitments
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {canApprove && (
                        <th style={{ width: 36 }}>
                          <input type="checkbox" style={CB_STYLE}
                            checked={selC.size === pending.commitments.length && pending.commitments.length > 0}
                            onChange={toggleAllC} />
                        </th>
                      )}
                      <th>Ref</th>
                      <th>Description</th>
                      <th>Department</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>FY</th>
                      <th>Date</th>
                      <th>Submitted By</th>
                      {canApprove && <th style={{ textAlign: 'center' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.commitments.map(c => (
                      <>
                        <tr key={c.id} style={{ background: selC.has(c.id) ? 'rgba(201,151,10,0.05)' : undefined }}>
                          {canApprove && (
                            <td>
                              <input type="checkbox" style={CB_STYLE}
                                checked={selC.has(c.id)} onChange={() => toggleC(c.id)} />
                            </td>
                          )}
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{c.ref}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                            {c.description}
                          </td>
                          <td><span className="chip chip-blue">{c.department_name}</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(c.amount)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{c.budget_year}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{c.date}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{c.submitted_by || '—'}</td>
                          {canApprove && (
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {rejectItem?.type === 'commitment' && rejectItem?.id === c.id ? null : (
                                <>
                                  <button className="btn btn-primary"
                                    style={{ padding: '3px 12px', fontSize: 11, marginRight: 6 }}
                                    disabled={busy === `commitment-${c.id}`}
                                    onClick={() => approve('commitment', c.id)}>
                                    Approve
                                  </button>
                                  <button className="btn btn-ghost"
                                    style={{ padding: '3px 12px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                    onClick={() => startReject('commitment', c.id)}>
                                    Reject
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                        {rejectItem?.type === 'commitment' && rejectItem?.id === c.id && (
                          <tr key={`rej-${c.id}`}>
                            <td colSpan={canApprove ? 9 : 7} style={{ background: 'rgba(220,38,38,0.04)', padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <textarea rows={2} placeholder="Reason for rejection (optional)"
                                  value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)',
                                    borderRadius: 5, color: 'var(--text)', fontSize: 12, padding: '7px 10px',
                                    resize: 'none', fontFamily: 'var(--sans)', outline: 'none' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <button className="btn btn-ghost"
                                    style={{ fontSize: 11, padding: '4px 14px', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                    disabled={busy === `commitment-${c.id}`} onClick={confirmReject}>
                                    {busy === `commitment-${c.id}` ? 'Rejecting...' : 'Confirm Reject'}
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

          {/* Expenses */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Expenses</div>
              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
                {pending.expenses.length} pending
              </span>
            </div>
            {pending.expenses.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                No pending expenses
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      {canApprove && (
                        <th style={{ width: 36 }}>
                          <input type="checkbox" style={CB_STYLE}
                            checked={selE.size === pending.expenses.length && pending.expenses.length > 0}
                            onChange={toggleAllE} />
                        </th>
                      )}
                      <th>Ref</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th>Department</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                      <th>Date</th>
                      <th>Submitted By</th>
                      <th>Receipt</th>
                      {canApprove && <th style={{ textAlign: 'center' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.expenses.map(e => (
                      <>
                        <tr key={e.id} style={{ background: selE.has(e.id) ? 'rgba(201,151,10,0.05)' : undefined }}>
                          {canApprove && (
                            <td>
                              <input type="checkbox" style={CB_STYLE}
                                checked={selE.has(e.id)} onChange={() => toggleE(e.id)} />
                            </td>
                          )}
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.ref}</td>
                          <td style={{ fontWeight: 500 }}>{e.vendor || '—'}</td>
                          <td style={{ color: 'var(--text2)', fontSize: 12 }}>{e.category || '—'}</td>
                          <td><span className="chip chip-blue">{e.department_name}</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(e.amount)}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{e.date}</td>
                          <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{e.submitted_by || '—'}</td>
                          <td>
                            {e.has_receipt ? (
                              <a href={expensesApi.getReceiptUrl(e.id)} target="_blank" rel="noreferrer"
                                style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none',
                                  fontFamily: 'var(--mono)', fontWeight: 600 }}>View</a>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                            )}
                          </td>
                          {canApprove && (
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {rejectItem?.type === 'expense' && rejectItem?.id === e.id ? null : (
                                <>
                                  <button className="btn btn-primary"
                                    style={{ padding: '3px 12px', fontSize: 11, marginRight: 6 }}
                                    disabled={busy === `expense-${e.id}`}
                                    onClick={() => approve('expense', e.id)}>
                                    Approve
                                  </button>
                                  <button className="btn btn-ghost"
                                    style={{ padding: '3px 12px', fontSize: 11, color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                    onClick={() => startReject('expense', e.id)}>
                                    Reject
                                  </button>
                                </>
                              )}
                            </td>
                          )}
                        </tr>
                        {rejectItem?.type === 'expense' && rejectItem?.id === e.id && (
                          <tr key={`rej-${e.id}`}>
                            <td colSpan={canApprove ? 10 : 8} style={{ background: 'rgba(220,38,38,0.04)', padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                <textarea rows={2} placeholder="Reason for rejection (optional)"
                                  value={rejectReason} onChange={ev => setRejectReason(ev.target.value)}
                                  style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border2)',
                                    borderRadius: 5, color: 'var(--text)', fontSize: 12, padding: '7px 10px',
                                    resize: 'none', fontFamily: 'var(--sans)', outline: 'none' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <button className="btn btn-ghost"
                                    style={{ fontSize: 11, padding: '4px 14px', color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
                                    disabled={busy === `expense-${e.id}`} onClick={confirmReject}>
                                    {busy === `expense-${e.id}` ? 'Rejecting...' : 'Confirm Reject'}
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

          {pendingTotal === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)', fontSize: 13 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              All caught up — no items awaiting approval
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Approval History</div>
            <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
              {historyAll.length} records
            </span>
          </div>
          {historyAll.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              No approval history yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Ref</th><th>Type</th><th>Description</th><th>Department</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th><th>Action By</th><th>Reason</th><th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyAll.map((item, i) => (
                    <tr key={`${item.type}-${item.id}-${i}`}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{item.ref}</td>
                      <td>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 500,
                          padding: '2px 6px', borderRadius: 3, textTransform: 'uppercase',
                          background: 'var(--surface3)', color: 'var(--text2)' }}>
                          {item.type}
                        </span>
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {item.description}
                      </td>
                      <td><span className="chip chip-blue">{item.department_name}</span></td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmt(item.amount)}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{item.approved_by || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.rejection_reason || '—'}
                      </td>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                        {item.approved_at ? item.approved_at.slice(0, 10) : '—'}
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

    {/* Bulk reject modal */}
    {bulkRejectOpen && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, backdropFilter: 'blur(3px)' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)',
          borderRadius: 12, padding: 28, width: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)', animation: 'fadeUp 0.2s ease' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Bulk Reject</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            Rejecting {selectedTotal} item{selectedTotal > 1 ? 's' : ''} — add a reason below
          </div>
          <textarea
            rows={3}
            placeholder="Reason for rejection (optional)"
            value={bulkRejectReason}
            onChange={e => setBulkRejectReason(e.target.value)}
            style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border2)',
              borderRadius: 6, color: 'var(--text)', fontSize: 12, padding: '9px 11px',
              resize: 'vertical', fontFamily: 'var(--sans)', outline: 'none', marginBottom: 20,
              boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost"
              onClick={() => setBulkRejectOpen(false)} disabled={bulkBusy}>
              Cancel
            </button>
            <button className="btn btn-ghost"
              style={{ color: 'var(--danger)', borderColor: 'rgba(220,38,38,0.3)' }}
              onClick={bulkReject} disabled={bulkBusy}>
              {bulkBusy ? 'Rejecting...' : `Confirm Reject (${selectedTotal})`}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
