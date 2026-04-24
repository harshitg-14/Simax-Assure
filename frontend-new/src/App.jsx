// // // src/App.jsx
// // import React, { useEffect, useState, useCallback } from 'react';
// // import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// // import { AuthProvider, useAuth } from './context/AuthContext';
// // import { alertsApi, departmentsApi } from './api/services';

// // import Sidebar          from './components/Sidebar';
// // import Topbar           from './components/Topbar';
// // import QuickEntryModal  from './components/QuickEntryModal';
// // import Dashboard        from './pages/Dashboard';
// // import Budgets          from './pages/Budgets';
// // import Commitments      from './pages/Commitments';
// // import Expenditure      from './pages/Expenditure';
// // import Assurance        from './pages/Assurance';
// // import Reports          from './pages/Reports';
// // import Departments      from './pages/Departments';
// // import Login            from './pages/Login';

// // function AppLayout() {
// //   const { isAuthenticated } = useAuth();
// //   const [alertCount, setAlertCount] = useState(0);
// //   const [depts, setDepts]           = useState([]);
// //   const [showModal, setShowModal]   = useState(false);
// //   const [toast, setToast]           = useState('');

// //   const refreshAlerts = useCallback(() => {
// //     alertsApi.listOpen()
// //       .then(r => setAlertCount((r.data || []).length))
// //       .catch(() => {});
// //   }, []);

// //   useEffect(() => {
// //     if (!isAuthenticated) return;
// //     refreshAlerts();
// //     departmentsApi.list().then(r => setDepts(r.data || [])).catch(() => {});
// //     const id = setInterval(refreshAlerts, 60000);
// //     return () => clearInterval(id);
// //   }, [isAuthenticated, refreshAlerts]);

// //   const handleSuccess = (msg) => {
// //     setToast(msg);
// //     setTimeout(() => setToast(''), 3000);
// //     refreshAlerts();
// //   };

// //   if (!isAuthenticated) return <Navigate to="/login" replace />;

// //   return (
// //     <div style={{ display: 'flex', minHeight: '100vh' }}>
// //       <Sidebar alertCount={alertCount} />
// //       <div style={{ marginLeft: 256, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
// //         <Topbar onNewEntry={() => setShowModal(true)} />
// //         <div style={{ flex: 1 }}>
// //           <Routes>
// //             <Route path="/dashboard"   element={<Dashboard />} />
// //             <Route path="/budgets"     element={<Budgets />} />
// //             <Route path="/commitments" element={<Commitments />} />
// //             <Route path="/expenditure" element={<Expenditure />} />
// //             <Route path="/assurance"   element={<Assurance />} />
// //             <Route path="/reports"     element={<Reports />} />
// //             <Route path="/departments" element={<Departments />} />
// //             <Route path="*"            element={<Navigate to="/dashboard" replace />} />
// //           </Routes>
// //         </div>
// //       </div>

// //       {showModal && (
// //         <QuickEntryModal
// //           depts={depts}
// //           onClose={() => setShowModal(false)}
// //           onSuccess={handleSuccess}
// //         />
// //       )}

// //       {toast && (
// //         <div style={{
// //           position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
// //           background: 'var(--surface)', border: '1px solid var(--success)',
// //           borderRadius: 10, padding: '12px 20px', fontSize: 13,
// //           color: 'var(--success)', fontWeight: 700,
// //           boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
// //           animation: 'fadeUp 0.3s ease',
// //         }}>
// //           ✓ {toast}
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// // function LoginGuard() {
// //   const { isAuthenticated } = useAuth();
// //   return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
// // }

// // export default function App() {
// //   return (
// //     <AuthProvider>
// //       <BrowserRouter>
// //         <Routes>
// //           <Route path="/login" element={<LoginGuard />} />
// //           <Route path="/*"     element={<AppLayout />} />
// //         </Routes>
// //       </BrowserRouter>
// //     </AuthProvider>
// //   );
// // }
// // import React from "react";

// // function App() {
// //   return (
// //     <div style={{ color: "white", padding: "50px" }}>
// //       <h1>Simax Assure Running ✅</h1>
// //     </div>
// //   );
// // }

// // export default App;

// //


// // src/App.jsx
// import React, { useEffect, useState, useCallback } from 'react';
// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
// import { AuthProvider, useAuth } from './context/AuthContext';
// import { alertsApi, departmentsApi } from './api/services';

// import Sidebar     from './components/Sidebar';
// import Topbar      from './components/Topbar';
// // ❌ TEMP REMOVED (causing crash)
// // import QuickEntryModal from './components/QuickEntryModal';

// import Dashboard   from './pages/Dashboard';
// import Budgets     from './pages/Budgets';
// import Commitments from './pages/Commitments';
// import Expenditure from './pages/Expenditure';
// import Assurance   from './pages/Assurance';
// import Reports     from './pages/Reports';
// import Departments from './pages/Departments';
// import Login       from './pages/Login';

// function AppLayout() {
//   const { isAuthenticated } = useAuth();
//   const [alertCount, setAlertCount] = useState(0);
//   const [depts, setDepts]           = useState([]);
//   const [showModal, setShowModal]   = useState(false);
//   const [toast, setToast]           = useState('');

//   const refreshAlerts = useCallback(() => {
//     alertsApi.listOpen()
//       .then(r => setAlertCount((r.data || []).length))
//       .catch(() => {});
//   }, []);

//   useEffect(() => {
//     if (!isAuthenticated) return;

//     refreshAlerts();

//     departmentsApi.list()
//       .then(r => setDepts(r.data || []))
//       .catch(() => {});

//     const id = setInterval(refreshAlerts, 60000);
//     return () => clearInterval(id);
//   }, [isAuthenticated, refreshAlerts]);

//   const handleSuccess = (msg) => {
//     setToast(msg);
//     setTimeout(() => setToast(''), 3000);
//     refreshAlerts();
//   };

//   if (!isAuthenticated) return <Navigate to="/login" replace />;

//   return (
//     <div style={{ display: 'flex', minHeight: '100vh' }}>
//       <Sidebar alertCount={alertCount} />

//       <div style={{
//         marginLeft: 256,
//         flex: 1,
//         display: 'flex',
//         flexDirection: 'column',
//         position: 'relative',
//         zIndex: 1
//       }}>
//         <Topbar onNewEntry={() => setShowModal(true)} />

//         <div style={{ flex: 1 }}>
//           <Routes>
//             <Route path="/dashboard"   element={<Dashboard />} />
//             <Route path="/budgets"     element={<Budgets />} />
//             <Route path="/commitments" element={<Commitments />} />
//             <Route path="/expenditure" element={<Expenditure />} />
//             <Route path="/assurance"   element={<Assurance />} />
//             <Route path="/reports"     element={<Reports />} />
//             <Route path="/departments" element={<Departments />} />
//             <Route path="*"            element={<Navigate to="/dashboard" replace />} />
//           </Routes>
//         </div>
//       </div>

//       {/* ❌ DISABLED TEMPORARILY (WAS CRASHING)
//       {showModal && (
//         <QuickEntryModal
//           depts={depts}
//           onClose={() => setShowModal(false)}
//           onSuccess={handleSuccess}
//         />
//       )}
//       */}

//       {toast && (
//         <div style={{
//           position: 'fixed',
//           bottom: 24,
//           right: 24,
//           zIndex: 9999,
//           background: 'var(--surface)',
//           border: '1px solid var(--success)',
//           borderRadius: 10,
//           padding: '12px 20px',
//           fontSize: 13,
//           color: 'var(--success)',
//           fontWeight: 700,
//           boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
//         }}>
//           ✓ {toast}
//         </div>
//       )}
//     </div>
//   );
// }

// function LoginGuard() {
//   const { isAuthenticated } = useAuth();
//   return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
// }

// export default function App() {
//   return (
//     <AuthProvider>
//       <BrowserRouter>
//         <Routes>
//           <Route path="/login" element={<LoginGuard />} />
//           <Route path="/*"     element={<AppLayout />} />
//         </Routes>
//       </BrowserRouter>
//     </AuthProvider>
//   );
// }

//


// src/App.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { alertsApi, departmentsApi } from './api/services';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import QuickEntryModal from './components/QuickEntryModal';
import AIChat from './components/AIChat'; // ✅ NEW

import Dashboard from './pages/Dashboard';
import Budgets from './pages/Budgets';
import Commitments from './pages/Commitments';
import Expenditure from './pages/Expenditure';
import Assurance from './pages/Assurance';
import Reports from './pages/Reports';
import Departments from './pages/Departments';
import Login from './pages/Login';

function AppLayout() {
  const { isAuthenticated } = useAuth();

  const [alertCount, setAlertCount] = useState(0);
  const [depts, setDepts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState('');

  const refreshAlerts = useCallback(() => {
    alertsApi.listOpen()
      .then(r => setAlertCount((r.data || []).length))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    refreshAlerts();

    departmentsApi.list()
      .then(r => setDepts(r.data || []))
      .catch(() => {});

    const id = setInterval(refreshAlerts, 60000);
    return () => clearInterval(id);
  }, [isAuthenticated, refreshAlerts]);

  const handleSuccess = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
    refreshAlerts();
  };

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        
        <Sidebar alertCount={alertCount} />

        <div
          style={{
            marginLeft: 256,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Topbar onNewEntry={() => setShowModal(true)} />

          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/commitments" element={<Commitments />} />
              <Route path="/expenditure" element={<Expenditure />} />
              <Route path="/assurance" element={<Assurance />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>

        {/* 🔥 MODAL */}
        {showModal && (
          <QuickEntryModal
            depts={depts}
            onClose={() => setShowModal(false)}
            onSuccess={handleSuccess}
          />
        )}

        {/* 🔥 TOAST */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 9999,
              background: 'var(--surface)',
              border: '1px solid var(--success)',
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 13,
              color: 'var(--success)',
              fontWeight: 700,
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            ✓ {toast}
          </div>
        )}
      </div>

      {/* 🚀 AI CHAT (GLOBAL FLOATING) */}
      <AIChat />
    </>
  );
}

function LoginGuard() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}