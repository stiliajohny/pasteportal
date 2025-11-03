-- Standalone SQL script to remove the public_pastes_view security risk
-- This can be run directly in Supabase SQL Editor or via psql if needed
-- 
-- The view was marked as "Unrestricted" in Supabase, allowing public API access to encrypted data
-- Even though data is encrypted, this exposes:
-- 1. Encrypted blobs (cryptanalysis risk)
-- 2. Metadata (IDs, timestamps, user_ids) 
-- 3. Allows enumeration of all pastes
--
-- This script is idempotent and safe to run multiple times

-- Revoke permissions first (only if view exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'public_pastes_view') THEN
    REVOKE ALL ON public.public_pastes_view FROM anon;
    REVOKE ALL ON public.public_pastes_view FROM authenticated;
    RAISE NOTICE 'Revoked permissions on public_pastes_view';
  ELSE
    RAISE NOTICE 'View public_pastes_view does not exist, skipping permission revocation';
  END IF;
END $$;

-- Drop the view
DROP VIEW IF EXISTS public.public_pastes_view;

-- Verify removal
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'public_pastes_view') THEN
    RAISE NOTICE 'Successfully removed public_pastes_view';
  ELSE
    RAISE WARNING 'View public_pastes_view still exists after drop attempt';
  END IF;
END $$;

