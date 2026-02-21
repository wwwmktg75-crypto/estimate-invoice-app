-- 見積・請求アプリ 初期スキーマ
-- GAS版のスプレッドシート構成をPostgreSQLに移行

-- 設定（キ・値）
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- クライアント
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 業者見積
CREATE TABLE IF NOT EXISTS contractor_quotes (
  id TEXT PRIMARY KEY,
  imported_at TIMESTAMPTZ DEFAULT now(),
  file_id TEXT,
  file_name TEXT,
  subject TEXT,
  contractor_name TEXT,
  total_cost NUMERIC(12,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 業者見積明細
CREATE TABLE IF NOT EXISTS contractor_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id TEXT NOT NULL REFERENCES contractor_quotes(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  name TEXT,
  qty NUMERIC(12,2) DEFAULT 1,
  unit TEXT DEFAULT '式',
  cost_price NUMERIC(12,0) DEFAULT 0,
  amount NUMERIC(12,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contractor_quote_items_quote_id ON contractor_quote_items(quote_id);

-- クライアント見積
CREATE TABLE IF NOT EXISTS client_estimates (
  id SERIAL PRIMARY KEY,
  project_name TEXT,
  client_name TEXT NOT NULL,
  create_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  default_profit_rate NUMERIC(5,2) DEFAULT 15,
  status TEXT DEFAULT '下書き',
  pdf_file_id TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- クライアント見積明細
CREATE TABLE IF NOT EXISTS client_estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id INTEGER NOT NULL REFERENCES client_estimates(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  name TEXT,
  qty NUMERIC(12,2) DEFAULT 0,
  unit TEXT DEFAULT '式',
  cost_price NUMERIC(12,0) DEFAULT 0,
  profit_rate NUMERIC(5,2),
  apply_margin BOOLEAN DEFAULT true,
  sell_price NUMERIC(12,0) DEFAULT 0,
  amount NUMERIC(12,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_estimate_items_estimate_id ON client_estimate_items(estimate_id);

-- 請求書
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  amount NUMERIC(12,0) DEFAULT 0,
  issue_date DATE DEFAULT CURRENT_DATE,
  is_issued BOOLEAN DEFAULT false,
  pdf_file_id TEXT,
  email_to TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 請求明細
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  description TEXT,
  amount NUMERIC(12,0) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- RLS（Row Level Security）は無効化（API経由でアクセスするため）
-- 本番ではSupabase Authと組み合わせてRLSを有効化することを推奨

-- Storage バケット（Supabase Dashboard で手動作成するか、以下を実行）
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true);
