ALTER TABLE tenant.files
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extracted_at timestamptz;
