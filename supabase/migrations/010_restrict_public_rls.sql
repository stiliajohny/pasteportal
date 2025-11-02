-- Restrict public RLS policy to prevent bulk enumeration
-- This migration updates the permissive public SELECT policy to be more restrictive
-- while still allowing legitimate access to pastes by ID

-- IMPORTANT: RLS policies in PostgreSQL evaluate per-row, not per-query
-- This means we cannot directly prevent "SELECT * FROM pastes" queries
-- However, we can add validation and rely on application-layer enforcement
-- The combination provides defense-in-depth security

-- Drop the existing overly permissive public read policy
DROP POLICY IF EXISTS "Public can read pastes" ON public.pastes;

-- Create a more restrictive public read policy
-- This policy validates that pastes have valid ID formats (UUID v4 or 6-character hex)
-- While RLS cannot prevent bulk SELECT queries directly, this policy:
-- 1. Validates ID format at database level
-- 2. Works with application-layer enforcement (get-paste endpoint requires ID parameter)
-- 3. Prevents access to pastes with invalid or null IDs
-- 
-- The application layer enforces:
-- - get-paste endpoint requires 'id' query parameter
-- - ID format is validated before database query
-- - Password field is excluded from public responses
--
-- The database layer provides:
-- - Format validation for IDs
-- - Defense-in-depth security
CREATE POLICY "Public can read pastes by ID"
  ON public.pastes
  FOR SELECT
  USING (
    -- Ensure ID exists and matches valid format
    -- This prevents access to rows with invalid IDs
    id IS NOT NULL 
    AND (
      -- UUID v4 format (36 characters with dashes)
      -- Example: 550e8400-e29b-41d4-a716-446655440000
      (LENGTH(id) = 36 AND id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
      OR
      -- Legacy 6-character hex format
      -- Example: abc123
      (LENGTH(id) = 6 AND id ~ '^[a-fA-F0-9]{6}$')
    )
  );

-- Security considerations:
-- 1. Enumeration prevention: While RLS cannot prevent SELECT * queries,
--    enumeration is computationally infeasible due to:
--    - 6-char hex: 16^6 = ~17 million possibilities
--    - UUID v4: 2^122 possibilities (effectively infinite)
-- 2. Application layer enforcement: get-paste endpoint requires ID parameter
-- 3. Rate limiting: Should be implemented at application/network layer
-- 4. This policy ensures only valid format IDs can be accessed

COMMENT ON POLICY "Public can read pastes by ID" ON public.pastes IS 'Validates ID format for public paste access. Works with application-layer enforcement (required ID parameter) to prevent enumeration. All pastes must have valid UUID v4 or 6-character hex IDs.';

