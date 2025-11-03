# Supabase Migration Instructions

## Quick Fix: Remove public_pastes_view

### Option 1: Using Supabase CLI (Recommended)

```bash
# Link to your Supabase project (if not already linked)
supabase link --project-ref your-project-ref

# Push all pending migrations including the fix
supabase db push
```

This will apply migration `015_create_public_paste_view.sql` which removes the view.

### Option 2: Manual SQL Execution

If you prefer to run the SQL manually in Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the contents of `supabase/fix_remove_public_pastes_view.sql`

Or via psql:

```bash
psql "your-connection-string" -f supabase/fix_remove_public_pastes_view.sql
```

## Verification

After applying the migration, verify the view is removed:

```sql
-- Check if view exists (should return 0 rows)
SELECT * FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'public_pastes_view';
```

## Disaster Recovery (DR) Readiness

All migrations are idempotent and can be run multiple times safely. To rebuild the database from scratch:

1. Run all migrations in sequence:
   ```bash
   supabase db push
   ```

2. Or manually run migrations in order:
   - `001_initial_schema.sql`
   - `003_profile_pictures_storage.sql`
   - `004_uuid_and_encryption_flag.sql`
   - `005_add_user_id_and_name.sql`
   - `006_noop_consolidation.sql`
   - `007_add_password_column.sql`
   - `008_secure_rls_policies.sql`
   - `009_remove_creator_gh_user.sql`
   - `010_restrict_public_rls.sql`
   - `011_extension_interest.sql`
   - `012_secure_extension_interest.sql`
   - `013_password_storage_constraint.sql`
   - `014_remove_unused_function.sql`
   - `015_create_public_paste_view.sql` (removes the view, ensuring it doesn't exist)

Note: Migration 015 ensures the view is removed, so it's safe to run on both existing and fresh databases.

