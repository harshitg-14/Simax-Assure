// src/components/QuickEntryModal.jsx
import React, { useState, useEffect } from 'react';
import { expensesApi, commitmentsApi, budgetsApi, departmentsApi } from '../api/services';
import './QuickEntryModal.css';

const CATEGORIES = ['Cloud Infrastructure', 'Software License', 'Digital Marketing', 'Logistics', 'Utilities', 'Travel', 'Other'];

export default function QuickEntryModal({ onClose, onSuccess }) {
  const [tab, setTab]       = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [depts, setDepts]   = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [commitments, setCommitments] = useState([]);

  const [expForm, setExpForm] = useState({ department_id: '', budget_id: '', commitment_id: '', vendor: '', amount: '', category: 'Cloud Infrastructure' });
  const [comForm, setComForm] = useState({ department_id: '', budget_id: '', description: '', amount: '' });
  const [budForm, setBudForm] = useState({ department_id: '', budget_year: 2025, allocated_budget: '' });

  useEffect(() => {
    Promise.all([departmentsApi.list(), budgetsApi.list(), commitmentsApi.list()])
      .then(([d, b, c]) => { setDepts(d.data || []); setBudgets(b.data || []); setCommitments(c.data || []); })
      .catch(() => {});
  }, []);

  const filteredBudgets = (deptId) => deptId ? budgets.filter(b => b.department_id === +deptId) : budgets;
  const filteredCommits = (budgetId) => budgetId ? commitments.filter(c => c.budget_id === +budgetId) : [];

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      if (tab === 0) {
        await expensesApi.create({ ...expForm, department_id: +expForm.department_id, budget_id: +expForm.budget_id, commitment_id: expForm.commitment_id ? +expForm.commitment_id : null, amount: +expForm.amount });
        onSuccess('Expense logged successfully!');
      } else if (tab === 1) {
        await commitmentsApi.create({ ...comForm, department_id: +comForm.department_id, budget_id: +comForm.budget_id, amount: +comForm.amount });
        onSuccess('Commitment added!');
      } else {
        await budgetsApi.create({ department_id: +budForm.department_id, budget_year: +budForm.budget_year, allocated_budget: +budForm.allocated_budget });
        onSuccess('Budget created!');
      }
      onClose();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to save'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <div className="modal-title">Quick Entry</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="tab-bar">
          {['Expense', 'Commitment', 'Budget'].map((t, i) => (
            <button key={t} className={`tab-btn${tab === i ? ' active' : ''}`} onClick={() => { setTab(i); setError(''); }}>{t}</button>
          ))}
        </div>
        {error && <div className="modal-error">{error}</div>}

        {/* Expense */}
        {tab === 0 && (
          <div className="modal-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label>Department</label>
                <select value={expForm.department_id} onChange={e => setExpForm({ ...expForm, department_id: e.target.value, budget_id: '', commitment_id: '' })}>
                  <option value="">Select...</option>
                  {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Budget</label>
                <select value={expForm.budget_id} onChange={e => setExpForm({ ...expForm, budget_id: e.target.value, commitment_id: '' })}>
                  <option value="">Select budget...</option>
                  {filteredBudgets(expForm.department_id).map(b => <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} (FY {b.budget_year})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Commitment (optional)</label>
                <select value={expForm.commitment_id} onChange={e => setExpForm({ ...expForm, commitment_id: e.target.value })}>
                  <option value="">No commitment</option>
                  {filteredCommits(expForm.budget_id).map(c => <option key={c.commitment_id} value={c.commitment_id}>CMT-{c.commitment_id}: {c.description}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Amount (₹)</label>
                <input type="number" placeholder="0.00" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Vendor</label>
                <input type="text" placeholder="e.g. AWS" value={expForm.vendor} onChange={e => setExpForm({ ...expForm, vendor: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Submit Expense'}</button>
            </div>
          </div>
        )}

        {/* Commitment */}
        {tab === 1 && (
          <div className="modal-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label>Department</label>
                <select value={comForm.department_id} onChange={e => setCom({ ...comForm, department_id: e.target.value, budget_id: '' })}>
                  <option value="">Select...</option>
                  {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Budget</label>
                <select value={comForm.budget_id} onChange={e => setComForm({ ...comForm, budget_id: e.target.value })}>
                  <option value="">Select budget...</option>
                  {filteredBudgets(comForm.department_id).map(b => <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} (FY {b.budget_year})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description</label>
                <input type="text" placeholder="e.g. Software license purchase" value={comForm.description} onChange={e => setComForm({ ...comForm, description: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Amount (₹)</label>
                <input type="number" placeholder="Reserved amount" value={comForm.amount} onChange={e => setComForm({ ...comForm, amount: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Add Commitment'}</button>
            </div>
          </div>
        )}

        {/* Budget */}
        {tab === 2 && (
          <div className="modal-form">
            <div className="form-grid-2">
              <div className="form-group">
                <label>Department</label>
                <select value={budForm.department_id} onChange={e => setBudForm({ ...budForm, department_id: e.target.value })}>
                  <option value="">Select...</option>
                  {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fiscal Year</label>
                <select value={budForm.budget_year} onChange={e => setBudForm({ ...budForm, budget_year: +e.target.value })}>
                  <option value={2024}>FY 2024</option>
                  <option value={2025}>FY 2025</option>
                  <option value={2026}>FY 2026</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Allocated Budget (₹)</label>
                <input type="number" placeholder="e.g. 1000000" value={budForm.allocated_budget} onChange={e => setBudForm({ ...budForm, allocated_budget: e.target.value })} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Create Budget'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
