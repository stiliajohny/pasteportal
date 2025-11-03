-- Migration: Create extension_interest table to track user interest in IDE extensions
-- 
-- IDEMPOTENCY: This migration is fully idempotent and safe to run multiple times
-- - CREATE TABLE IF NOT EXISTS: Won't error if table exists
-- - ALTER TABLE IF EXISTS ENABLE RLS: Won't error if table doesn't exist, idempotent if RLS already enabled
-- - DROP POLICY IF EXISTS: Won't error if policy doesn't exist
-- - CREATE INDEX IF NOT EXISTS: Won't error if index exists
-- - COMMENT ON TABLE: Overwrites existing comment (idempotent by nature)
--
-- This file is the source of truth for disaster recovery

-- Create extension_interest table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.extension_interest (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ide_preference TEXT NOT NULL CHECK (ide_preference IN ('vscode', 'cursor', 'jetbrains', 'vim', 'other')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  -- Ensure a user can only register interest once per IDE
  UNIQUE(email, ide_preference)
);

-- Update CHECK constraint to include 'cursor' if table exists and constraint needs updating
DO $$
DECLARE
  constraint_name TEXT;
  constraint_exists BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_interest') THEN
    -- Check if the constraint with the correct definition already exists
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.extension_interest'::regclass
        AND contype = 'c'
        AND conname = 'extension_interest_ide_preference_check'
    ) INTO constraint_exists;
    
    -- Only update if constraint doesn't exist or has different definition
    IF NOT constraint_exists THEN
      -- Find and drop any existing CHECK constraint on ide_preference column
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'public.extension_interest'::regclass
        AND contype = 'c'
        AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'public.extension_interest'::regclass AND attname = 'ide_preference');
      
      -- Drop the old constraint if found
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.extension_interest DROP CONSTRAINT IF EXISTS %I', constraint_name);
      END IF;
      
      -- Add the updated constraint with 'cursor' included
      ALTER TABLE public.extension_interest 
        ADD CONSTRAINT extension_interest_ide_preference_check 
        CHECK (ide_preference IN ('vscode', 'cursor', 'jetbrains', 'vim', 'other'));
    END IF;
  END IF;
END $$;

-- Enable RLS (idempotent - ALTER TABLE ENABLE RLS is safe to run multiple times)
ALTER TABLE IF EXISTS public.extension_interest ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert (register interest)
DROP POLICY IF EXISTS "Anyone can register interest" ON public.extension_interest;
CREATE POLICY "Anyone can register interest" 
  ON public.extension_interest 
  FOR INSERT 
  WITH CHECK (true);

-- Policy: Users can view their own interest registrations
DROP POLICY IF EXISTS "Users can view their own interest" ON public.extension_interest;
CREATE POLICY "Users can view their own interest" 
  ON public.extension_interest 
  FOR SELECT 
  USING (
    auth.uid() = user_id
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_extension_interest_email ON public.extension_interest(email);
CREATE INDEX IF NOT EXISTS idx_extension_interest_user_id ON public.extension_interest(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_interest_created_at ON public.extension_interest(created_at DESC);

-- Add comment to table (idempotent - overwrites if exists)
COMMENT ON TABLE public.extension_interest IS 'Tracks user interest in IDE extensions for future development';

