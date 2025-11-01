-- Migration 006: No-op migration (consolidated with 005)
-- This migration exists to maintain migration sequence numbering.
-- The functionality previously in 006 (verify_and_fix_user_id_name) was redundant
-- as migration 005 already handles this with IF NOT EXISTS checks.
-- This migration does nothing and is safe to apply on existing databases.

-- No changes needed - columns and indexes are already created by migration 005

