-- ============================================================
-- TripSync — Item Suggestions + Realtime for itinerary tables
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

CREATE TABLE item_suggestions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID        NOT NULL REFERENCES itinerary_items(id) ON DELETE CASCADE,
  suggested_by    UUID        REFERENCES trip_members(id) ON DELETE SET NULL,
  suggestion_text TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE item_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_suggestions_permissive_all" ON item_suggestions USING (true) WITH CHECK (true);

-- Enable Realtime on itinerary tables + item_suggestions
ALTER PUBLICATION supabase_realtime ADD TABLE itinerary_days;
ALTER PUBLICATION supabase_realtime ADD TABLE itinerary_items;
ALTER PUBLICATION supabase_realtime ADD TABLE item_suggestions;
