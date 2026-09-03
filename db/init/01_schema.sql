-- ============================================================
-- Perkom Expense Approval System — Local PostgreSQL schema
-- Recreated from supabase/migrations/001-005 + schema.sql.
--
-- Differences vs the old Supabase database (required by the
-- Docker PostgreSQL migration):
--   * No RLS policies — they referenced Supabase's auth.role();
--     the app talks to this database exclusively with a trusted
--     server-side connection pool.
--   * uploads.uploaded_by is a plain UUID — historically a Supabase
--     Auth user id, now an app_users id; no foreign key either way.
--   * claims.status additionally allows 'MERGED', which the app
--     writes via /api/claims/managed-service/merge.
-- ============================================================

-- UUID primary keys default to gen_random_uuid() — core PostgreSQL since 13,
-- no extension needed.

-- ------- employees -------
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number VARCHAR(50) UNIQUE NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL DEFAULT '',
  phone_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  role VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE' CHECK (role IN ('EMPLOYEE', 'MANAGER', 'HR')),
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  hr_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_number ON employees(employee_number);
CREATE INDEX idx_employees_active ON employees(is_active);

-- ------- uploads -------
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period VARCHAR(20) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_type VARCHAR(10) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------- claims -------
CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL,
  trip_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'APPROVED', 'NEED_REVIEW', 'UNMATCHED', 'MERGED')),
  manager_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (manager_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  hr_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (hr_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  hr_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  wa_sent BOOLEAN NOT NULL DEFAULT false,
  wa_sent_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_employee ON claims(employee_id);
CREATE INDEX idx_claims_period ON claims(period);

-- ------- trips -------
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  trip_date TIMESTAMPTZ NOT NULL,
  booking_id VARCHAR(100) NOT NULL DEFAULT '',
  service_type VARCHAR(50) NOT NULL DEFAULT '',
  payment_method VARCHAR(50) NOT NULL DEFAULT '',
  employee_group VARCHAR(50) NOT NULL DEFAULT '',
  cost_code VARCHAR(255) NOT NULL DEFAULT '',
  pickup TEXT NOT NULL DEFAULT '',
  dropoff TEXT NOT NULL DEFAULT '',
  fare NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_claim ON trips(claim_id);

-- ------- comments -------
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_claim ON comments(claim_id);

-- ------- whatsapp_logs -------
CREATE TABLE whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_logs_claim ON whatsapp_logs(claim_id);

-- ------- signatures -------
CREATE TABLE signatures (
  employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------- managed_service_claims -------
CREATE TABLE managed_service_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id VARCHAR NOT NULL,
  ticket_title VARCHAR,
  customer_name VARCHAR,
  location VARCHAR,
  amount NUMERIC NOT NULL,
  file_url VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ------- app_users (local login; replaced Supabase Auth) -------
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------- Updated_at trigger -------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
