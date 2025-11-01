-- Add user_id and name columns to pastes table
-- user_id links pastes to authenticated users (nullable for anonymous pastes)
-- name allows users to give custom names to their pastes

-- Add user_id column (UUID, nullable)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add name column (TEXT, nullable)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_pastes_user_id ON public.pastes(user_id);

-- Create index on user_id and created_at for faster user paste queries
CREATE INDEX IF NOT EXISTS idx_pastes_user_id_created_at ON public.pastes(user_id, created_at DESC);

-- Update comment
COMMENT ON TABLE public.pastes IS 'Stores encrypted paste content with metadata. Supports UUID format for paste IDs. Can be linked to authenticated users via user_id.';

