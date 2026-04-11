-- Add destination tables to Supabase Realtime publication
-- Run in Supabase SQL Editor

ALTER PUBLICATION supabase_realtime ADD TABLE destination_suggestions;
ALTER PUBLICATION supabase_realtime ADD TABLE destination_votes;
