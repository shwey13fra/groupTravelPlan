-- ============================================================
-- TripSync — Storage Bucket
-- Paste into Supabase SQL Editor AFTER running 001_initial_schema.sql
-- ============================================================

-- Create the trip-vault bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-vault', 'trip-vault', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files from trip-vault
CREATE POLICY "trip_vault_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'trip-vault');

-- Allow anyone to upload files to trip-vault
CREATE POLICY "trip_vault_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trip-vault');

-- Allow anyone to delete files from trip-vault
CREATE POLICY "trip_vault_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'trip-vault');
