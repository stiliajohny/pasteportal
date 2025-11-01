-- Remove creator_gh_user column from pastes table
-- This migration is idempotent and safe to run multiple times

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pastes' 
    AND column_name = 'creator_gh_user'
  ) THEN
    ALTER TABLE public.pastes 
      DROP COLUMN creator_gh_user;
  END IF;
END $$;

