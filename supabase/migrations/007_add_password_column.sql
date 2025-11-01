-- Add password column to store encrypted passwords for password-protected pastes
-- Only stored for authenticated users who create password-protected pastes
-- Password is encrypted using the ENCRYPTION_KEY following @db.mdc rule

-- Add password column (TEXT, nullable, encrypted)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS password TEXT;

-- Update comment
COMMENT ON TABLE public.pastes IS 'Stores encrypted paste content with metadata. Supports UUID format for paste IDs. Can be linked to authenticated users via user_id. Stores encrypted passwords for password-protected pastes (only for authenticated users).';

