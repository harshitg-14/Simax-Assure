import { useEffect, useState } from 'react';
import { auditApi } from '../api/services';
import './Dashboard.css';

const fmt = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

const ACTION_STYLE = {
  approved: { bg: 'rgba(5,150,105,0.12)',  color: '#059669', label: 'APPROVED' },
  rejected: { bg: 'rgba(220,38,38,0.12)',  color: '#dc2626', label: 'REJECTED' },
  created:  { bg: 'rgba(91,143,255,0.12)', color: '#5b8fff', label: 'CREATED'  },
  deleted:  { bg: 'rgba(217,119,6,0.12)',  color: '#d97706', label: 'DELETED'  },
  revised:  { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'REVISED'  },
};

const ENTITY_CHIP = {
  expense:    { bg: 'rgba(201,151,10,0.12)',  color: 'var(--accent2)' },
  commitment: { bg: 'rgba(91,143,255,0.12)', color: 'var(--accent3)' },
  revision:   { bg: 'rgba(168,85,247,0.12)', color: '#a855f7'        },
  budget:     { bg: 'rgba(5,150,105,0.12)',  color: 'var(--success)' },
};

const FILTERS = ['all', 'expense', 'commitment', 'revision'];

function ActionPill({ action }) {
  const s = ACTION_STYLE[action] || { bg: 'var(--surface2)', color: 'var(--text3)', label: action?.toUpperCase() };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      fontFamily: 'var(--mono)', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function EntityChip({ type, ref: entityRef }) {
  const s = ENTITY_CHIP[type] || { bg: 'var(--surface2)', color: 'var(--text3)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 9, fontFamily: 'var(--mono)', padding: '1px 6px', borderRadius: 3,
        background: s.bg, color: s.color, fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' }}>
        {type}
      </span>
      {entityRef && (
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text2)', fontWeight: 600 }}>
          {entityRef}
        </span>
      )}
    </div>
  );
}

export default function AuditLog() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);
  const [offset,  setOffset]  = useState(0);
  const LIMIT = 50;

  const load = (f = filter, o = 0) => {
    setLoading(true);
    const params = { limit: LIMIT, offset: o };
    if (f !== 'all') params.entity_type = f;
    auditApi.list(params)
      .then(r => { setLogs(r.data.logs || []); setTotal(r.data.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(filter, offset); }, [filter, offset]);

  const changeFilter = (f) => { setFilter(f); setOffset(0); };

  return (
    <div className="page fade-in">
      <div className="ph">
        <div>
          <div className="ph-title">Audit Trail</div>
          <div className="ph-sub">Complete record of all financial approvals and actions</div>
        </div>
        <div className="ph-actions">
          <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text3)' }}>
            {total} total entries
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => changeFilter(f)}
            className={filter === f ? 'btn btn-primary' : 'btn btn-ghost'}
            style={{ fontSize: 12, padding: '5px 14px', textTransform: 'capitalize' }}
          >
            {f === 'all' ? 'All Actions' : f + 's'}
          </button>
        ))}
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Timestamp</th>
                  <th style={{ width: 90 }}>Action</th>
                  <th style={{ width: 120 }}>Reference</th>
                  <th>Detail</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Amount</th>
                  <th style={{ width: 140 }}>Department</th>
                  <th style={{ width: 120 }}>Actor</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 13 }}>
                      No audit entries yet. Actions will appear here after approvals and rejections.
                    </td>
                  </tr>
                ) : logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td><ActionPill action={log.action} /></td>
                    <td><EntityChip type={log.entity_type} ref={log.entity_ref} /></td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.detail || '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                      {fmt(log.amount)}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {log.dept_name ? (
                        <span className="chip chip-blue" style={{ fontSize: 10 }}>{log.dept_name}</span>
                      ) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--accent-dim)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: 'var(--accent2)', flexShrink: 0 }}>
                          {(log.actor || '?')[0].toUpperCase()}
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>
                          {log.actor}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text3)' }}>
            <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ fontSize: 11 }}
                disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>
                Previous
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 11 }}
                disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
