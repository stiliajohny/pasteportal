-- Create pastes table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pastes (
  id TEXT PRIMARY KEY CHECK (LENGTH(id) = 6),
  paste TEXT NOT NULL,
  recipient_gh_username TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on timestamp for faster queries
CREATE INDEX IF NOT EXISTS idx_pastes_timestamp ON public.pastes(timestamp DESC);

-- Create index on created_at for faster queries
CREATE INDEX IF NOT EXISTS idx_pastes_created_at ON public.pastes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.pastes ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for authenticated users (adjust as needed)
-- For now, allow public read/write since we're using encryption at application level
CREATE POLICY "Allow public read access" ON public.pastes
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.pastes
  FOR INSERT WITH CHECK (true);

-- Comment on table
COMMENT ON TABLE public.pastes IS 'Stores encrypted paste content with metadata';
