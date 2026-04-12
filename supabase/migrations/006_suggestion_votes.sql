-- ============================================================
-- TripSync — Suggestion voting + structured swap fields
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

-- Add structured swap fields to item_suggestions
-- (NULL = freeform member suggestion, NOT NULL = organizer structured swap with voting)
ALTER TABLE item_suggestions
  ADD COLUMN suggested_title       TEXT,
  ADD COLUMN suggested_description TEXT,
  ADD COLUMN suggested_location    TEXT;

-- Votes on organizer swap suggestions
CREATE TABLE suggestion_votes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID        NOT NULL REFERENCES item_suggestions(id) ON DELETE CASCADE,
  member_id     UUID        NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  vote          TEXT        NOT NULL CHECK (vote IN ('yes', 'no')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (suggestion_id, member_id)
);

ALTER TABLE suggestion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suggestion_votes_permissive_all" ON suggestion_votes USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE suggestion_votes;
