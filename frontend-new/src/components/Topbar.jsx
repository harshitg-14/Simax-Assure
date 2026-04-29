import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { departmentsApi, expensesApi } from '../api/services';
import './Topbar.css';

const PAGE_LABELS = {
  '/dashboard':   'Dashboard',
  '/budgets':     'Budget Management',
  '/commitments': 'Commitments',
  '/expenditure': 'Expenditure',
  '/assurance':   'Risk & Compliance',
  '/reports':     'Reports & Analytics',
  '/departments': 'Departments',
};

const SEV_COLOR = { critical: '#dc2626', high: '#d97706', medium: '#c9970a', low: '#059669' };

const BellIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 1a5 5 0 0 0-5 5v2.5L1.5 10h13L13 8.5V6a5 5 0 0 0-5-5Z" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const GearIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="2.5" strokeWidth="1.2"/>
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

export default function Topbar({ onNewEntry, alertCount = 0, openAlerts = [] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const label = PAGE_LABELS[pathname] || 'Simax Assure';

  const [bellOpen, setBellOpen]       = useState(false);
  const [searchVal, setSearchVal]     = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);
  const [searchData, setSearchData]   = useState([]);
  const [searchLoaded, setSearchLoaded] = useState(false);

  const bellRef   = useRef(null);
  const searchRef = useRef(null);

  /* close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current   && !bellRef.current.contains(e.target))   setBellOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

  const handleResultClick = (path) => {
    setSearchVal('');
    setSearchOpen(false);
    navigate(path);
  };

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
                <div key={i} className="search-result" onClick={() => handleResultClick(r.path)}>
                  <span className="sr-label">{r.label}</span>
                  <span className="sr-sub">{r.sub}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bell */}
        <div className="topbar-icon-btn" ref={bellRef} title={alertCount > 0 ? `${alertCount} open alerts` : 'Notifications'} onClick={() => setBellOpen(o => !o)}>
          <BellIcon />
          {alertCount > 0 && (
            <span className="bell-count">{alertCount > 99 ? '99+' : alertCount}</span>
          )}

          {bellOpen && (
            <div className="bell-dropdown" onClick={e => e.stopPropagation()}>
              <div className="bd-head">
                <span className="bd-title">Open Alerts</span>
                <span className="bd-count">{alertCount}</span>
              </div>
              <div className="bd-list">
                {openAlerts.length === 0 ? (
                  <div className="bd-empty">No open alerts</div>
                ) : openAlerts.map(a => (
                  <div key={a.alert_id} className="bd-item">
                    <span className="bd-dot" style={{ background: SEV_COLOR[(a.severity || '').toLowerCase()] || '#d97706' }} />
                    <div className="bd-body">
                      <div className="bd-item-title">{a.title}</div>
                      <div className="bd-item-code">{a.alert_code}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/assurance" className="bd-footer" onClick={() => setBellOpen(false)}>
                View all in Assurance Monitor &rarr;
              </Link>
            </div>
          )}
        </div>

        <div className="topbar-icon-btn" title="Settings">
          <GearIcon />
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
