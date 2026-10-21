CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  submitted_at TEXT NOT NULL,
  source_page TEXT,
  user_agent TEXT,
  contact_consent INTEGER,
  accuracy_consent INTEGER,
  data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'New'
);
CREATE INDEX IF NOT EXISTS idx_applications_submitted ON applications(submitted_at);
