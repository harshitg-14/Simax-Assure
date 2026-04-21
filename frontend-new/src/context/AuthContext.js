import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

const USERS = [
  { username: 'admin',           password: 'admin123',   role: 'admin' },
  { username: 'finance_manager', password: 'finance123', role: 'finance_manager' },
  { username: 'marketing_head',  password: 'mkt123',     role: 'department_head' },
  { username: 'it_head',         password: 'it123',      role: 'department_head' },
  { username: 'ops_head',        password: 'ops123',     role: 'department_head' },
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem('simax_user') || 'null')
  );
  const [selectedYear, setSelectedYear] = useState(
    () => parseInt(localStorage.getItem('simax_year') || '2025')
  );

  const login = async (username, password) => {
    const found = USERS.find(u => u.username === username && u.password === password);
    if (!found) return { ok: false, error: 'Invalid credentials' };
    const u = { username: found.username, role: found.role, email: `${found.username}@simax.com` };
    localStorage.setItem('simax_user', JSON.stringify(u));
    setUser(u);
    return { ok: true };
  };

  const logout = () => {
    localStorage.removeItem('simax_user');
    localStorage.removeItem('simax_year');
    setUser(null);
  };

  const changeYear = (yr) => {
    setSelectedYear(yr);
    localStorage.setItem('simax_year', String(yr));
  };

  const isAdmin          = user?.role === 'admin';
  const isFinanceManager = user?.role === 'finance_manager';
  const isDeptHead       = user?.role === 'department_head';

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      isAuthenticated: !!user,
      isAdmin, isFinanceManager, isDeptHead,
      canCreateBudget:   isAdmin || isFinanceManager,
      canDeleteBudget:   isAdmin,
      canApproveExpense: isAdmin || isFinanceManager,
      canViewAllDepts:   isAdmin || isFinanceManager,
      canViewAssurance:  isAdmin || isFinanceManager,
      canViewReports:    isAdmin || isFinanceManager,
      selectedYear, changeYear,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
