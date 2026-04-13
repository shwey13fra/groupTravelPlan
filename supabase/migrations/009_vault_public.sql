-- Phase 7: vault_public toggle + realtime on vault_items
ALTER TABLE trips ADD COLUMN IF NOT EXISTS vault_public BOOLEAN NOT NULL DEFAULT false;

ALTER PUBLICATION supabase_realtime ADD TABLE vault_items;
