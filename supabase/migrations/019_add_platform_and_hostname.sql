-- Add platform and hostname columns to pastes table
-- platform: The platform where the paste was created (e.g., 'web', 'vscode', 'cli', etc.)
-- hostname: The hostname of the device where the paste was created (if available)

-- Add platform column (TEXT, nullable)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS platform TEXT;

-- Add hostname column (TEXT, nullable)
ALTER TABLE IF EXISTS public.pastes 
  ADD COLUMN IF NOT EXISTS hostname TEXT;

-- Create index on platform for faster queries
CREATE INDEX IF NOT EXISTS idx_pastes_platform ON public.pastes(platform) WHERE platform IS NOT NULL;

-- Update comment
COMMENT ON COLUMN public.pastes.platform IS 'Platform where the paste was created (e.g., web, vscode, cli)';
COMMENT ON COLUMN public.pastes.hostname IS 'Hostname of the device where the paste was created (if available)';

