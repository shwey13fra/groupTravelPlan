-- ============================================================
-- TripSync — Initial Schema
-- Paste into Supabase SQL Editor and Run.
-- ============================================================

-- ── Updated-at trigger (applied to trips, trip_members, tasks) ──────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── 1. trips ────────────────────────────────────────────────────────────
CREATE TABLE trips (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  destination         TEXT,
  start_date          DATE,
  end_date            DATE,
  budget_min          INT,
  budget_max          INT,
  duration_days       INT,
  vibe                TEXT        CHECK (vibe IN ('beach', 'mountains', 'city', 'heritage', 'adventure')),
  month               TEXT,
  group_type          TEXT        CHECK (group_type IN ('friends', 'family', 'mixed')),
  status              TEXT        NOT NULL DEFAULT 'planning'
                                  CHECK (status IN ('planning', 'confirmed', 'completed')),
  join_code           TEXT        UNIQUE NOT NULL,
  ai_nudge            TEXT,
  destination_locked  BOOLEAN     NOT NULL DEFAULT false,
  last_ai_call_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_permissive_all" ON trips USING (true) WITH CHECK (true);

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 2. trip_members ─────────────────────────────────────────────────────
CREATE TABLE trip_members (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL,
  emoji               TEXT        NOT NULL,
  is_organizer        BOOLEAN     NOT NULL DEFAULT false,
  commitment_status   TEXT        NOT NULL DEFAULT 'pending'
                                  CHECK (commitment_status IN ('in', 'out', 'pending')),
  available_from      DATE,
  available_to        DATE,
  tags                TEXT[]      NOT NULL DEFAULT '{}',
  user_id             UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_members_permissive_all" ON trip_members USING (true) WITH CHECK (true);

CREATE TRIGGER trip_members_updated_at
  BEFORE UPDATE ON trip_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 3. destination_suggestions ──────────────────────────────────────────
CREATE TABLE destination_suggestions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id                 UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name                    TEXT        NOT NULL,
  suggested_by_member_id  UUID        REFERENCES trip_members(id) ON DELETE SET NULL,
  suggested_by_ai         BOOLEAN     NOT NULL DEFAULT false,
  reason                  TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE destination_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destination_suggestions_permissive_all" ON destination_suggestions USING (true) WITH CHECK (true);


-- ── 4. destination_votes ────────────────────────────────────────────────
CREATE TABLE destination_votes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id      UUID        NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  suggestion_id  UUID        NOT NULL REFERENCES destination_suggestions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, member_id)   -- each member gets exactly one vote per trip
);

ALTER TABLE destination_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destination_votes_permissive_all" ON destination_votes USING (true) WITH CHECK (true);


-- ── 5. itinerary_days ───────────────────────────────────────────────────
CREATE TABLE itinerary_days (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number  INT         NOT NULL,
  date        DATE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itinerary_days_permissive_all" ON itinerary_days USING (true) WITH CHECK (true);


-- ── 6. itinerary_items ──────────────────────────────────────────────────
CREATE TABLE itinerary_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id       UUID        NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  time_slot    TEXT,
  title        TEXT        NOT NULL,
  description  TEXT,
  location     TEXT,
  item_type    TEXT        CHECK (item_type IN ('activity', 'meal', 'transport', 'buffer')),
  order_index  INT         NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itinerary_items_permissive_all" ON itinerary_items USING (true) WITH CHECK (true);


-- ── 7. tasks ────────────────────────────────────────────────────────────
CREATE TABLE tasks (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  assigned_to  UUID        REFERENCES trip_members(id) ON DELETE SET NULL,
  due_date     DATE,
  status       TEXT        NOT NULL DEFAULT 'todo'
                           CHECK (status IN ('todo', 'in_progress', 'done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_permissive_all" ON tasks USING (true) WITH CHECK (true);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── 8. expenses ─────────────────────────────────────────────────────────
CREATE TABLE expenses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  amount      NUMERIC     NOT NULL,
  paid_by     UUID        NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  split_type  TEXT        NOT NULL DEFAULT 'equal'
                          CHECK (split_type IN ('equal', 'custom')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_permissive_all" ON expenses USING (true) WITH CHECK (true);


-- ── 9. expense_splits ───────────────────────────────────────────────────
CREATE TABLE expense_splits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id   UUID        NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id    UUID        NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  amount_owed  NUMERIC     NOT NULL,
  settled      BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_splits_permissive_all" ON expense_splits USING (true) WITH CHECK (true);


-- ── 10. vault_items ─────────────────────────────────────────────────────
CREATE TABLE vault_items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      UUID        NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  item_type    TEXT        CHECK (item_type IN ('pdf', 'link', 'note')),
  file_url     TEXT,
  link_url     TEXT,
  notes        TEXT,
  uploaded_by  UUID        REFERENCES trip_members(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vault_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vault_items_permissive_all" ON vault_items USING (true) WITH CHECK (true);
