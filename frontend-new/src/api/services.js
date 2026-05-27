import api from './client';

export const departmentsApi = {
  list:   ()         => api.get('/departments/'),
  get:    (id)       => api.get(`/departments/${id}`),
  create: (data)     => api.post('/departments/', data),
  update: (id, data) => api.put(`/departments/${id}`, data),
  delete: (id)       => api.delete(`/departments/${id}`),
};

export const budgetsApi = {
  list:    (params) => api.get('/budgets/', { params }),
  get:     (id)     => api.get(`/budgets/${id}`),
  summary: (id)     => api.get(`/dashboard/${id}`),
  getKPIs: (year)   => api.get('/budgets/dashboard', { params: { year: year || 2025 } }),
  create:  (data)   => api.post('/budgets/', data),
  delete:  (id)     => api.delete(`/budgets/${id}`),
};

export const dashboardApi = {
  getKPIs:        (year) => api.get('/budgets/dashboard', { params: { year: year || 2025 } }),
  monthlyTrend:   (budgetId) => api.get('/dashboard/monthly-trend', { params: { budget_id: budgetId } }),
  anomalies:      (budgetId) => api.get('/dashboard/anomalies', { params: { budget_id: budgetId } }),
  departmentRisk: ()     => api.get('/dashboard/department-risk'),
  alertsSummary:  ()     => api.get('/dashboard/alerts-summary'),
  topAlerts:      ()     => api.get('/dashboard/top-alerts'),
  forecast:       (year) => api.get('/dashboard/forecast', { params: { year } }),
};

export const auditApi = {
  list: (params) => api.get('/audit/', { params }),
};

export const commitmentsApi = {
  list:   (params) => api.get('/commitments/', { params }),
  get:    (id)     => api.get(`/commitments/${id}`),
  create: (data)   => api.post('/commitments/', data),
  delete: (id)     => api.delete(`/commitments/${id}`),
};

export const expensesApi = {
  list:   (params) => api.get('/expenses/', { params }),
  get:    (id)     => api.get(`/expenses/${id}`),
  create: (data)   => api.post('/expenses/', data),
  delete: (id)     => api.delete(`/expenses/${id}`),
  bulkImport: (file, year) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/expenses/bulk${year ? `?year=${year}` : ''}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadReceipt: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/expenses/${id}/receipt`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getReceiptUrl: (id) => `${api.defaults.baseURL}/expenses/${id}/receipt`,
};

export const alertsApi = {
  list:        (params)     => api.get('/alerts/', { params }),
  listOpen:    ()           => api.get('/alerts/open'),
  get:         (id)         => api.get(`/alerts/${id}`),
  acknowledge: (id, user)   => api.put(`/alerts/${id}/acknowledge`, { user_name: user || 'admin' }),
  resolve:     (id, user)   => api.put(`/alerts/${id}/resolve`,     { user_name: user || 'admin' }),
  dismiss:     (id)         => api.put(`/alerts/${id}/dismiss`),
  patch:       (id, data)   => api.patch(`/alerts/${id}`, data),
  delete:      (id)         => api.delete(`/alerts/${id}`),
};

export const approvalsApi = {
  summary:           ()           => api.get('/approvals/summary'),
  pending:           ()           => api.get('/approvals/pending'),
  history:           ()           => api.get('/approvals/history'),
  approveCommitment: (id)         => api.put(`/approvals/commitments/${id}/approve`),
  rejectCommitment:  (id, reason) => api.put(`/approvals/commitments/${id}/reject`, { reason }),
  approveExpense:    (id)         => api.put(`/approvals/expenses/${id}/approve`),
  rejectExpense:     (id, reason) => api.put(`/approvals/expenses/${id}/reject`, { reason }),
  bulkAction:        (data)       => api.post('/approvals/bulk', data),
};

export const revisionsApi = {
  list:         ()           => api.get('/revisions/'),
  pendingCount: ()           => api.get('/revisions/pending-count'),
  create:       (data)       => api.post('/revisions/', data),
  approve:      (id)         => api.put(`/revisions/${id}/approve`),
  reject:       (id, reason) => api.put(`/revisions/${id}/reject`, { reason }),
};

export const reportsApi = {
  downloadPdf: (year) =>
    api.get('/reports/pdf', { params: { year }, responseType: 'blob' }),
  yoy: (yearA, yearB) =>
    api.get('/reports/yoy', { params: { year_a: yearA, year_b: yearB } }),
};

export const aiApi = {
  ask: (query) => api.get('/ai/ask', { params: { query } }),
};

export const schedulesApi = {
  get:     ()     => api.get('/schedules/'),
  update:  (data) => api.put('/schedules/', data),
  sendNow: ()     => api.post('/schedules/send-now'),
};

export const authApi = {
  login:          (username, password)           => api.post('/auth/login', { username, password }),
  me:             ()                             => api.get('/auth/me'),
  changePassword: (current_password, new_password) => api.put('/auth/change-password', { current_password, new_password }),
};

export const usersApi = {
  list:          ()              => api.get('/users/'),
  create:        (data)          => api.post('/users/', data),
  update:        (id, data)      => api.put(`/users/${id}`, data),
  resetPassword: (id, password)  => api.put(`/users/${id}/reset-password`, { new_password: password }),
  delete:        (id)            => api.delete(`/users/${id}`),
};
