-- Update pastes table to support UUID format and add encryption flag
-- Remove the 6-character length constraint
ALTER TABLE IF EXISTS public.pastes 
  DROP CONSTRAINT IF EXISTS pastes_id_check;

-- Add column to track if paste is password-encrypted
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS is_password_encrypted BOOLEAN DEFAULT FALSE;

-- Update comment
COMMENT ON TABLE public.pastes IS 'Stores encrypted paste content with metadata. Supports UUID format for paste IDs.';

