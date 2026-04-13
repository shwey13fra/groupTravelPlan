-- Phase 8: proactive AI nudge — separate rate-limit column + trips realtime
ALTER TABLE trips ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMPTZ;

-- Enable realtime on trips so NudgeBanner auto-updates when ai_nudge changes
ALTER PUBLICATION supabase_realtime ADD TABLE trips;
