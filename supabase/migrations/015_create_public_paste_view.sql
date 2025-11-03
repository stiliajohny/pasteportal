-- Remove the public_pastes_view as it's not used by the application and creates a security risk
-- The view was marked as "Unrestricted" in Supabase, allowing public API access to encrypted data
-- Even though data is encrypted, this exposes:
-- 1. Encrypted blobs (cryptanalysis risk)
-- 2. Metadata (IDs, timestamps, user_ids) 
-- 3. Allows enumeration of all pastes
--
-- The application queries the 'pastes' table directly with proper RLS policies,
-- so this view is unnecessary and creates an unnecessary attack surface.
--
-- IDEMPOTENCY: This migration is fully idempotent and safe to run multiple times
-- - DROP VIEW IF EXISTS: Safe to run multiple times (no-op if view doesn't exist)

-- Revoke permissions first (only if view exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'public_pastes_view') THEN
    REVOKE ALL ON public.public_pastes_view FROM anon;
    REVOKE ALL ON public.public_pastes_view FROM authenticated;
  END IF;
END $$;

-- Drop the view
DROP VIEW IF EXISTS public.public_pastes_view;

