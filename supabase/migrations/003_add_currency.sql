-- Add currency column to trips
-- Paste into Supabase SQL Editor and Run.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
