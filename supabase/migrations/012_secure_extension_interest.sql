-- Secure extension_interest table by explicitly denying UPDATE and DELETE operations
-- This migration adds explicit RLS policies to prevent UPDATE/DELETE operations
-- even if endpoints are added later without proper security
--
-- IDEMPOTENCY: This migration is fully idempotent and safe to run multiple times
-- - DROP POLICY IF EXISTS: Won't error if policy doesn't exist
-- - CREATE POLICY: Overwrites existing policy if it exists (idempotent behavior)

-- Policy: Explicitly deny UPDATE operations on extension_interest
-- This ensures that even if UPDATE endpoints are added, they won't work without proper RLS policies
DROP POLICY IF EXISTS "Deny extension_interest updates" ON public.extension_interest;
CREATE POLICY "Deny extension_interest updates"
  ON public.extension_interest
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- Policy: Explicitly deny DELETE operations on extension_interest
-- This ensures that even if DELETE endpoints are added, they won't work without proper RLS policies
DROP POLICY IF EXISTS "Deny extension_interest deletes" ON public.extension_interest;
CREATE POLICY "Deny extension_interest deletes"
  ON public.extension_interest
  FOR DELETE
  USING (false);

-- Add comment documenting the security policy
COMMENT ON POLICY "Deny extension_interest updates" ON public.extension_interest IS 'Explicitly denies all UPDATE operations on extension_interest table. This ensures data integrity and prevents unauthorized modifications even if endpoints are added later.';
COMMENT ON POLICY "Deny extension_interest deletes" ON public.extension_interest IS 'Explicitly denies all DELETE operations on extension_interest table. This ensures data integrity and prevents unauthorized deletions even if endpoints are added later.';

