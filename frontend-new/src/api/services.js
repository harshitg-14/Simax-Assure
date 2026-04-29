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

export const aiApi = {
  ask: (query) => api.get('/ai/ask', { params: { query } }),
};
