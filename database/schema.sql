DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS commitments CASCADE;
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL,
    manager_name VARCHAR(100),
    created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE budgets (
    budget_id SERIAL PRIMARY KEY,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
    budget_year INT NOT NULL,
    allocated_budget DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_date DATE DEFAULT CURRENT_DATE
);

CREATE TABLE commitments (
    commitment_id SERIAL PRIMARY KEY,
    budget_id INT NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    commitment_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE expenses (
    expense_id SERIAL PRIMARY KEY,
    budget_id INT NOT NULL REFERENCES budgets(budget_id) ON DELETE CASCADE,
    commitment_id INT NULL REFERENCES commitments(commitment_id) ON DELETE SET NULL,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
    vendor VARCHAR(100),
    amount DECIMAL(14,2) NOT NULL,
    expense_date DATE DEFAULT CURRENT_DATE,
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE alerts (
    alert_id SERIAL PRIMARY KEY,
    department_id INT REFERENCES departments(department_id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_date DATE DEFAULT CURRENT_DATE
);