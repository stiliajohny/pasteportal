-- Add CHECK constraint to enforce password storage rules at database level
-- This ensures that passwords can only be stored for authenticated users with password-encrypted pastes
-- 
-- Rule: If password IS NOT NULL, then user_id IS NOT NULL AND is_password_encrypted = true
--
-- IDEMPOTENCY: This migration is fully idempotent and safe to run multiple times
-- - DROP CONSTRAINT IF EXISTS: Won't error if constraint doesn't exist
-- - ADD CONSTRAINT: Will error if constraint exists, but we drop first, so it's idempotent

-- Drop existing constraint if it exists (in case we need to update the constraint definition)
ALTER TABLE public.pastes
  DROP CONSTRAINT IF EXISTS pastes_password_storage_check;

-- Add CHECK constraint to enforce password storage rules
-- This constraint ensures:
-- 1. If password is provided, user_id must be set (authenticated users only)
-- 2. If password is provided, is_password_encrypted must be true
-- 3. Passwords cannot be stored for anonymous users or non-password-encrypted pastes
ALTER TABLE public.pastes
  ADD CONSTRAINT pastes_password_storage_check
  CHECK (
    password IS NULL 
    OR (
      user_id IS NOT NULL 
      AND is_password_encrypted = true
    )
  );

-- Add comment documenting the constraint
COMMENT ON CONSTRAINT pastes_password_storage_check ON public.pastes IS 'Enforces that passwords can only be stored for authenticated users (user_id IS NOT NULL) who create password-encrypted pastes (is_password_encrypted = true). This provides database-level enforcement of password storage rules as defense-in-depth.';

