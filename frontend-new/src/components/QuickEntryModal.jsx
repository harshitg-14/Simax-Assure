import { useState, useEffect, useRef } from 'react';
import { expensesApi, commitmentsApi, budgetsApi, departmentsApi } from '../api/services';
import './QuickEntryModal.css';

const CATEGORIES = [
  'Cloud Infrastructure', 'Software License', 'Digital Marketing',
  'Logistics', 'Utilities', 'Travel', 'Professional Services', 'Other',
];

export default function QuickEntryModal({ onClose, onSuccess }) {
  const [tab, setTab]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [depts, setDepts]           = useState([]);
  const [budgets, setBudgets]       = useState([]);
  const [commitments, setCommitments] = useState([]);

  const [expForm, setExpForm] = useState({
    department_id: '', budget_id: '', commitment_id: '',
    vendor: '', amount: '', category: 'Cloud Infrastructure',
  });
  const [receipt, setReceipt]   = useState(null);
  const fileInputRef            = useRef(null);
  const [comForm, setComForm] = useState({
    department_id: '', budget_id: '', description: '', amount: '',
  });
  const [budForm, setBudForm] = useState({
    department_id: '', budget_year: 2025, allocated_budget: '',
  });

  useEffect(() => {
    Promise.all([departmentsApi.list(), budgetsApi.list(), commitmentsApi.list()])
      .then(([d, b, c]) => {
        setDepts(d.data || []);
        setBudgets(b.data || []);
        setCommitments(c.data || []);
      }).catch(() => {});
  }, []);

  const filteredBudgets = (deptId) =>
    deptId ? budgets.filter(b => b.department_id === +deptId) : budgets;
  const filteredCommits = (budgetId) =>
    budgetId ? commitments.filter(c => c.budget_id === +budgetId) : [];

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      if (tab === 0) {
        const res = await expensesApi.create({
          ...expForm,
          department_id: +expForm.department_id,
          budget_id:     +expForm.budget_id,
          commitment_id: expForm.commitment_id ? +expForm.commitment_id : null,
          amount:        +expForm.amount,
        });
        if (receipt && res.data?.expense_id) {
          try { await expensesApi.uploadReceipt(res.data.expense_id, receipt); } catch {}
        }
        onSuccess('Expense recorded successfully.');
      } else if (tab === 1) {
        await commitmentsApi.create({
          ...comForm,
          department_id: +comForm.department_id,
          budget_id:     +comForm.budget_id,
          amount:        +comForm.amount,
        });
        onSuccess('Commitment added.');
      } else {
        await budgetsApi.create({
          department_id:    +budForm.department_id,
          budget_year:      +budForm.budget_year,
          allocated_budget: +budForm.allocated_budget,
        });
        onSuccess('Budget created.');
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <div className="modal-title">New Entry</div>
          <button className="modal-close" onClick={onClose}>&#215;</button>
        </div>

        <div className="tab-bar">
          {['Expense', 'Commitment', 'Budget'].map((t, i) => (
            <button
              key={t}
              className={`tab-btn${tab === i ? ' active' : ''}`}
              onClick={() => { setTab(i); setError(''); }}
            >
              {t}
            </button>
          ))}
        </div>

        {error && <div className="modal-error">{error}</div>}

        {/* Expense */}
        {tab === 0 && (
          <div className="modal-form">
            <div className="form-grid-2">
              <select
                value={expForm.department_id}
                onChange={e => setExpForm({ ...expForm, department_id: e.target.value, budget_id: '', commitment_id: '' })}
              >
                <option value="">Department</option>
                {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>

              <select
                value={expForm.budget_id}
                onChange={e => setExpForm({ ...expForm, budget_id: e.target.value, commitment_id: '' })}
              >
                <option value="">Budget</option>
                {filteredBudgets(expForm.department_id).map(b => (
                  <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} &middot; FY {b.budget_year}</option>
                ))}
              </select>

              <select
                value={expForm.commitment_id}
                onChange={e => setExpForm({ ...expForm, commitment_id: e.target.value })}
              >
                <option value="">No commitment linked</option>
                {filteredCommits(expForm.budget_id).map(c => (
                  <option key={c.commitment_id} value={c.commitment_id}>CMT-{c.commitment_id}: {c.description}</option>
                ))}
              </select>

              <select
                value={expForm.category}
                onChange={e => setExpForm({ ...expForm, category: e.target.value })}
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>

              <input
                type="text" placeholder="Vendor name"
                value={expForm.vendor}
                onChange={e => setExpForm({ ...expForm, vendor: e.target.value })}
              />

              <input
                type="number" placeholder="Amount (INR)"
                value={expForm.amount}
                onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
              />
            </div>

            {/* Receipt upload */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                marginBottom: 12, padding: '10px 14px', borderRadius: 6,
                border: `1px dashed ${receipt ? 'var(--gold)' : 'var(--border2)'}`,
                background: receipt ? 'rgba(201,151,10,0.06)' : 'var(--bg2)',
                cursor: 'pointer', fontSize: 12, color: receipt ? 'var(--gold)' : 'var(--text3)',
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {receipt ? receipt.name : 'Attach receipt (PDF, JPG, PNG — optional)'}
              {receipt && (
                <span
                  onClick={ev => { ev.stopPropagation(); setReceipt(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 14, lineHeight: 1 }}
                >
                  &#215;
                </span>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              style={{ display: 'none' }}
              onChange={e => setReceipt(e.target.files[0] || null)}
            />

            <button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Expense'}
            </button>
          </div>
        )}

        {/* Commitment */}
        {tab === 1 && (
          <div className="modal-form">
            <div className="form-grid-2" style={{ marginBottom: 12 }}>
              <select
                value={comForm.department_id}
                onChange={e => setComForm({ ...comForm, department_id: e.target.value, budget_id: '' })}
              >
                <option value="">Department</option>
                {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>

              <select
                value={comForm.budget_id}
                onChange={e => setComForm({ ...comForm, budget_id: e.target.value })}
              >
                <option value="">Budget</option>
                {filteredBudgets(comForm.department_id).map(b => (
                  <option key={b.budget_id} value={b.budget_id}>BDG-{b.budget_id} &middot; FY {b.budget_year}</option>
                ))}
              </select>
            </div>

            <input
              placeholder="Description"
              value={comForm.description}
              onChange={e => setComForm({ ...comForm, description: e.target.value })}
              style={{ width: '100%', marginBottom: 12, padding: '9px 11px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--sans)' }}
            />

            <input
              type="number" placeholder="Reserved amount (INR)"
              value={comForm.amount}
              onChange={e => setComForm({ ...comForm, amount: e.target.value })}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--sans)' }}
            />
            <button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Submitting...' : 'Add Commitment'}
            </button>
          </div>
        )}

        {/* Budget */}
        {tab === 2 && (
          <div className="modal-form">
            <div className="form-grid-2" style={{ marginBottom: 12 }}>
              <select
                value={budForm.department_id}
                onChange={e => setBudForm({ ...budForm, department_id: e.target.value })}
              >
                <option value="">Department</option>
                {depts.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
              </select>

              <select
                value={budForm.budget_year}
                onChange={e => setBudForm({ ...budForm, budget_year: +e.target.value })}
              >
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>FY {y}</option>)}
              </select>
            </div>

            <input
              type="number" placeholder="Allocated budget (INR)"
              value={budForm.allocated_budget}
              onChange={e => setBudForm({ ...budForm, allocated_budget: e.target.value })}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: 'var(--sans)' }}
            />
            <button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Create Budget'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
