-- ============================================================
-- TripSync — Enable Realtime on tasks table
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
