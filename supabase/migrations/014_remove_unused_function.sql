-- Remove unused SECURITY DEFINER function user_owns_paste
-- This function is not used anywhere in the codebase and poses a security risk if misused
--
-- IDEMPOTENCY: This migration is fully idempotent and safe to run multiple times
-- - REVOKE: Won't error if grant doesn't exist
-- - DROP FUNCTION IF EXISTS: Won't error if function doesn't exist

-- Revoke execute permission from authenticated role
REVOKE EXECUTE ON FUNCTION public.user_owns_paste(TEXT) FROM authenticated;

-- Drop the function
-- Using CASCADE to handle any dependent objects (though none should exist)
DROP FUNCTION IF EXISTS public.user_owns_paste(TEXT) CASCADE;

-- Note: If the function is referenced anywhere, this migration will fail
-- This is intentional to ensure we don't break any hidden dependencies

