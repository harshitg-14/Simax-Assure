import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(
    () => JSON.parse(localStorage.getItem('simax_user') || 'null')
  );
  const [selectedYear, setSelectedYear] = useState(
    () => parseInt(localStorage.getItem('simax_year') || '2025')
  );
  const [authChecked, setAuthChecked] = useState(false);

  // Validate stored token on app load
  useEffect(() => {
    const token = localStorage.getItem('simax_token');
    if (!token) {
      setAuthChecked(true);
      return;
    }
    authApi.me()
      .then(res => {
        setUser(res.data);
        localStorage.setItem('simax_user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('simax_token');
        localStorage.removeItem('simax_user');
        setUser(null);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  const login = async (username, password) => {
    try {
      const res = await authApi.login(username, password);
      const { access_token, user: u } = res.data;
      localStorage.setItem('simax_token', access_token);
      localStorage.setItem('simax_user', JSON.stringify(u));
      setUser(u);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.detail || 'Invalid credentials' };
    }
  };

  const logout = () => {
    localStorage.removeItem('simax_token');
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
  const userDeptId       = user?.department_id ?? null;

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      isAuthenticated: !!user,
      authChecked,
      isAdmin, isFinanceManager, isDeptHead,
      userDeptId,
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
