import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { departmentsApi, expensesApi } from '../api/services';
import { useTheme } from '../context/ThemeContext';
import './Topbar.css';

const PAGE_LABELS = {
  '/dashboard':   'Dashboard',
  '/budgets':     'Budget Management',
  '/commitments': 'Commitments',
  '/expenditure': 'Expenditure',
  '/assurance':   'Risk & Compliance',
  '/reports':     'Reports & Analytics',
  '/departments': 'Departments',
  '/users':       'User Management',
  '/approvals':   'Approval Workflow',
};

const SEV_COLOR = { critical: '#dc2626', high: '#d97706', medium: '#c9970a', low: '#059669' };
const SEV_BG    = { critical: 'rgba(220,38,38,0.1)', high: 'rgba(217,119,6,0.1)', medium: 'rgba(201,151,10,0.1)', low: 'rgba(5,150,105,0.1)' };

const BellIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1a5 5 0 0 0-5 5v2.5L1.5 10h13L13 8.5V6a5 5 0 0 0-5-5Z" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

export default function Topbar({ onNewEntry, alertCount = 0, openAlerts = [] }) {
  const { pathname } = useLocation();
  const navigate     = useNavigate();
  const label        = PAGE_LABELS[pathname] || 'Simax Assure';
  const { theme, toggleTheme } = useTheme();

  const [bellOpen, setBellOpen]         = useState(false);
  const [seenIds, setSeenIds]           = useState(() => new Set());
  const [ringing, setRinging]           = useState(false);
  const [searchVal, setSearchVal]       = useState('');
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchData, setSearchData]     = useState([]);
  const [searchLoaded, setSearchLoaded] = useState(false);

  const bellRef   = useRef(null);
  const searchRef = useRef(null);
  const prevCount = useRef(alertCount);

  // Ring bell when new alerts arrive
  useEffect(() => {
    if (alertCount > prevCount.current) {
      setRinging(true);
      setTimeout(() => setRinging(false), 1500);
    }
    prevCount.current = alertCount;
  }, [alertCount]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current   && !bellRef.current.contains(e.target))   setBellOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Mark all as read when bell opens
  const openBell = () => {
    setBellOpen(o => !o);
    if (!bellOpen) {
      setSeenIds(new Set(openAlerts.map(a => a.alert_id)));
    }
  };

  const markAllRead = (e) => {
    e.stopPropagation();
    setSeenIds(new Set(openAlerts.map(a => a.alert_id)));
  };

  const unreadCount = openAlerts.filter(a => !seenIds.has(a.alert_id)).length;

  const loadSearchData = async () => {
    if (searchLoaded) return;
    try {
      const [d, e] = await Promise.all([departmentsApi.list(), expensesApi.list()]);
      const depts   = (d.data || []).map(dept => ({ label: dept.department_name, sub: 'Department', path: '/departments' }));
      const vendors = [...new Set((e.data || []).map(exp => exp.vendor).filter(Boolean))]
        .map(v => ({ label: v, sub: 'Vendor', path: '/expenditure' }));
      setSearchData([...depts, ...vendors]);
      setSearchLoaded(true);
    } catch {}
  };

  const results = searchVal.trim().length >= 1
    ? searchData.filter(i => i.label.toLowerCase().includes(searchVal.toLowerCase())).slice(0, 7)
    : [];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="breadcrumb">
          Simax Assure &nbsp;/&nbsp; <span>{label}</span>
        </div>
      </div>

      <div className="topbar-right">

        {/* Search */}
        <div className="search-wrap" ref={searchRef}>
          <div className={`search-box${searchOpen ? ' focused' : ''}`}>
            <span className="search-icon" />
            <input
              className="search-input"
              placeholder="Search budgets, vendors, departments..."
              value={searchVal}
              onFocus={() => { setSearchOpen(true); loadSearchData(); }}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchVal(''); setSearchOpen(false); } }}
            />
            {searchVal && (
              <button className="search-clear" onClick={() => setSearchVal('')}>&#215;</button>
            )}
          </div>

          {searchOpen && (results.length > 0 || searchVal.trim().length === 0) && (
            <div className="search-dropdown">
              {searchVal.trim().length === 0 ? (
                <div className="search-hint">Type to search departments and vendors</div>
              ) : results.length === 0 ? (
                <div className="search-hint">No results for &ldquo;{searchVal}&rdquo;</div>
              ) : results.map((r, i) => (
                <div key={i} className="search-result" onClick={() => { setSearchVal(''); setSearchOpen(false); navigate(r.path); }}>
                  <span className="sr-label">{r.label}</span>
                  <span className="sr-sub">{r.sub}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <div
          className="topbar-icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </div>

        {/* Bell */}
        <div
          className={`topbar-icon-btn${ringing ? ' bell-ringing' : ''}`}
          ref={bellRef}
          title={alertCount > 0 ? `${alertCount} open alerts` : 'No alerts'}
          onClick={openBell}
        >
          <BellIcon />

          {/* Badge — shows unread when closed, total when open */}
          {alertCount > 0 && (
            <span className={`bell-count${unreadCount > 0 && !bellOpen ? ' bell-count-pulse' : ''}`}>
              {bellOpen ? alertCount : unreadCount > 0 ? unreadCount : alertCount}
            </span>
          )}

          {bellOpen && (
            <div className="bell-dropdown" onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="bd-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bd-title">Alerts</span>
                  {alertCount > 0 && (
                    <span className="bd-count">{alertCount} open</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button className="bd-mark-read" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="bd-list">
                {openAlerts.length === 0 ? (
                  <div className="bd-empty">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8, color: 'var(--text3)' }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    <div>All clear — no open alerts</div>
                  </div>
                ) : openAlerts.map(a => {
                  const sev  = (a.severity || 'medium').toLowerCase();
                  const isNew = !seenIds.has(a.alert_id);
                  return (
                    <div key={a.alert_id} className={`bd-item${isNew ? ' bd-item-new' : ''}`}>
                      <span className="bd-dot" style={{ background: SEV_COLOR[sev] || SEV_COLOR.medium }} />
                      <div className="bd-body">
                        <div className="bd-item-title">{a.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700,
                            padding: '1px 5px', borderRadius: 3, textTransform: 'uppercase',
                            background: SEV_BG[sev] || SEV_BG.medium,
                            color: SEV_COLOR[sev] || SEV_COLOR.medium,
                          }}>
                            {sev}
                          </span>
                          <span className="bd-item-code">{a.alert_code?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                      {isNew && <span className="bd-new-dot" />}
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <Link to="/assurance" className="bd-footer" onClick={() => setBellOpen(false)}>
                View all in Assurance Monitor &rarr;
              </Link>
            </div>
          )}
        </div>

        {onNewEntry && (
          <button className="btn btn-primary" onClick={onNewEntry}>
            New Entry
          </button>
        )}
      </div>
    </header>
  );
}
