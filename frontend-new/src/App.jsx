import { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { alertsApi, departmentsApi, approvalsApi, revisionsApi } from './api/services';

import Sidebar          from './components/Sidebar';
import Topbar           from './components/Topbar';
import QuickEntryModal  from './components/QuickEntryModal';
import AIChat           from './components/AIChat';

import Dashboard   from './pages/Dashboard';
import Budgets     from './pages/Budgets';
import Commitments from './pages/Commitments';
import Expenditure from './pages/Expenditure';
import Assurance   from './pages/Assurance';
import Reports     from './pages/Reports';
import Departments from './pages/Departments';
import Users       from './pages/Users';
import Approvals        from './pages/Approvals';
import BudgetRevisions  from './pages/BudgetRevisions';
import AuditLog         from './pages/AuditLog';
import Login            from './pages/Login';

function AppLayout() {
  const { isAuthenticated, authChecked } = useAuth();
  const [alertCount, setAlertCount]         = useState(0);
  const [openAlerts, setOpenAlerts]         = useState([]);
  const [pendingApprovals,  setPendingApprovals]  = useState(0);
  const [pendingRevisions,  setPendingRevisions]  = useState(0);
  const [depts, setDepts]                   = useState([]);
  const [showModal, setShowModal]           = useState(false);
  const [toast, setToast]                   = useState('');

  const refreshAlerts = useCallback(() => {
    alertsApi.listOpen()
      .then(r => {
        const data = r.data || [];
        setAlertCount(data.length);
        setOpenAlerts(data.slice(0, 8));
      })
      .catch(() => {});
  }, []);

  const refreshApprovals = useCallback(() => {
    approvalsApi.summary()
      .then(r => setPendingApprovals(r.data?.pending || 0))
      .catch(() => {});
  }, []);

  const refreshRevisions = useCallback(() => {
    revisionsApi.pendingCount()
      .then(r => setPendingRevisions(r.data?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshAlerts();
    refreshApprovals();
    refreshRevisions();
    departmentsApi.list().then(r => setDepts(r.data || [])).catch(() => {});
    const id1 = setInterval(refreshAlerts,    60000);
    const id2 = setInterval(refreshApprovals, 60000);
    const id3 = setInterval(refreshRevisions, 60000);
    return () => { clearInterval(id1); clearInterval(id2); clearInterval(id3); };
  }, [isAuthenticated, refreshAlerts, refreshApprovals]);

  const handleSuccess = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
    refreshAlerts();
  };

  // Wait for token validation before deciding where to send the user
  if (!authChecked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar alertCount={alertCount} pendingApprovals={pendingApprovals} pendingRevisions={pendingRevisions} />
        <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
          <Topbar onNewEntry={() => setShowModal(true)} alertCount={alertCount} openAlerts={openAlerts} />
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/dashboard"   element={<Dashboard />} />
              <Route path="/budgets"     element={<Budgets />} />
              <Route path="/commitments" element={<Commitments />} />
              <Route path="/expenditure" element={<Expenditure />} />
              <Route path="/assurance"   element={<Assurance />} />
              <Route path="/reports"     element={<Reports />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/users"       element={<Users />} />
              <Route path="/approvals"   element={<Approvals />} />
              <Route path="/revisions"   element={<BudgetRevisions />} />
              <Route path="/audit"       element={<AuditLog />} />
              <Route path="*"            element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>

        {showModal && (
          <QuickEntryModal
            depts={depts}
            onClose={() => setShowModal(false)}
            onSuccess={handleSuccess}
          />
        )}

        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            background: 'var(--surface)', border: '1px solid var(--success)',
            borderRadius: 10, padding: '12px 20px', fontSize: 13,
            color: 'var(--success)', fontWeight: 700,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            animation: 'fadeUp 0.3s ease',
          }}>
            ✓ {toast}
          </div>
        )}
      </div>

      <AIChat />
    </>
  );
}

function LoginGuard() {
  const { isAuthenticated, authChecked } = useAuth();
  if (!authChecked) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route path="/*"     element={<AppLayout />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
