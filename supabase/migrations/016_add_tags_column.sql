-- Add tags column to pastes table
-- Tags are stored as comma-separated values (encrypted at application level)
-- This allows users to categorize and search their pastes

-- Add tags column (TEXT, nullable)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS tags TEXT;

-- Create index on tags for faster tag-based queries
-- Note: Since tags are encrypted, this index is mainly for structure
-- Actual tag searching will be done after decryption at application level
CREATE INDEX IF NOT EXISTS idx_pastes_tags ON public.pastes(tags) WHERE tags IS NOT NULL;

-- Update comment
COMMENT ON COLUMN public.pastes.tags IS 'Comma-separated tags for categorizing pastes (encrypted at application level)';

