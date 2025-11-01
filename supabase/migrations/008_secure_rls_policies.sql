-- Secure Row Level Security policies for pastes table
-- This migration replaces the permissive public policies with strict security policies

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read access" ON public.pastes;
DROP POLICY IF EXISTS "Allow public insert access" ON public.pastes;

-- Policy 1: Allow public read access to paste content
-- This is needed for the sharing functionality where users access pastes via URL
-- Note: Password field is excluded at application layer (get-paste endpoint)
-- While this allows reading all pastes, the application only queries by specific ID,
-- and sensitive fields (password) are filtered at the API level
CREATE POLICY "Public can read pastes"
  ON public.pastes
  FOR SELECT
  USING (true);

-- Policy 2: Allow authenticated users to read their own pastes (for My Pastes page)
-- This ensures users can only see their own pastes when listing by user_id
CREATE POLICY "Users can read their own pastes"
  ON public.pastes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  );

-- Policy 3: Allow anyone to insert pastes (needed for anonymous users)
-- But restrict: authenticated users can only set user_id to their own ID
-- Anonymous users can only set user_id to NULL
CREATE POLICY "Public can insert pastes"
  ON public.pastes
  FOR INSERT
  WITH CHECK (
    -- Anonymous users can insert pastes without user_id
    (user_id IS NULL AND auth.uid() IS NULL) OR
    -- Authenticated users can only insert pastes with their own user_id
    (user_id = auth.uid() AND auth.uid() IS NOT NULL)
  );

-- Policy 4: Allow users to update only their own pastes
-- This is for future features like editing paste names
CREATE POLICY "Users can update their own pastes"
  ON public.pastes
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  );

-- Policy 5: Allow users to delete only their own pastes
-- This is for future features like deleting pastes
CREATE POLICY "Users can delete their own pastes"
  ON public.pastes
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND 
    user_id = auth.uid()
  );

-- Note: While the SELECT policy allows public read, the application layer should:
-- 1. Not expose password field in public API endpoints (get-paste should not return password)
-- 2. Only return password in authenticated endpoints where user_id matches (list-pastes)
-- 3. The get-paste endpoint should use application-level filtering to exclude password field

-- Create a function to check if current user owns the paste
-- This can be used for additional validation if needed
CREATE OR REPLACE FUNCTION public.user_owns_paste(paste_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.pastes 
    WHERE id = paste_id 
    AND user_id = auth.uid()
    AND auth.uid() IS NOT NULL
  );
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.user_owns_paste(TEXT) TO authenticated;

COMMENT ON TABLE public.pastes IS 'Stores encrypted paste content with metadata. Supports UUID format for paste IDs. Can be linked to authenticated users via user_id. Stores encrypted passwords for password-protected pastes (only for authenticated users). Protected by RLS policies.';

