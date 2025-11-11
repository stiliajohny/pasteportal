-- Add content_hash column to pastes table
-- This column stores SHA-256 hash of paste content for duplicate detection
-- Hash is computed on server-side before any modifications (secret redaction, encryption)
-- Content is normalized (trimmed) before hashing to catch near-duplicates

-- Add content_hash column (TEXT, nullable for existing records)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create unique index for authenticated users (per-user duplicate detection)
-- This prevents the same user from submitting identical content twice
-- Partial index only applies when user_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_pastes_user_content_hash 
  ON public.pastes(user_id, content_hash) 
  WHERE user_id IS NOT NULL AND content_hash IS NOT NULL;

-- Create index for anonymous paste duplicate checks (non-unique)
-- Allows fast lookups for anonymous paste duplicates
CREATE INDEX IF NOT EXISTS idx_pastes_content_hash 
  ON public.pastes(content_hash) 
  WHERE content_hash IS NOT NULL;

-- Update comment
COMMENT ON COLUMN public.pastes.content_hash IS 'SHA-256 hash of paste content (normalized/trimmed) for duplicate detection. Computed before any modifications.';

