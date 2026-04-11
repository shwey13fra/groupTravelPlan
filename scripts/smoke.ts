/**
 * Smoke test — run with: npm run smoke
 *
 * Creates a trip, joins two members, verifies both rows, then cleans up.
 * Exits 0 on success, 1 on any failure.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomJoinCode() {
  return Array.from(
    { length: 6 },
    () => JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]
  ).join("");
}

async function cleanup(tripId: string) {
  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) {
    console.warn("⚠️  Cleanup failed (trip may remain):", error.message);
  } else {
    console.log("🧹 Cleanup done — test trip deleted.");
  }
}

async function main() {
  console.log("🔥 TripSync smoke test\n");

  const tripName = `Smoke-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const joinCode = randomJoinCode();

  // 1. Create test trip
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      name: tripName,
      vibe: "beach",
      month: "June",
      group_type: "friends",
      currency: "USD",
      budget_min: 1000,
      budget_max: 2000,
      duration_days: 7,
      join_code: joinCode,
      status: "planning",
      destination_locked: false,
    })
    .select("id, name, join_code")
    .single();

  if (tripError || !trip) {
    console.error("❌ Create trip failed:", tripError?.message);
    process.exit(1);
  }
  console.log("✅ Trip created:", trip);

  // 2. Insert organizer
  const { data: organizer, error: orgError } = await supabase
    .from("trip_members")
    .insert({
      trip_id: trip.id,
      name: "Organizer",
      emoji: "😎",
      is_organizer: true,
      commitment_status: "in",
    })
    .select("id, name, is_organizer, commitment_status")
    .single();

  if (orgError || !organizer) {
    console.error("❌ Insert organizer failed:", orgError?.message);
    await cleanup(trip.id);
    process.exit(1);
  }
  console.log("✅ Organizer row:", organizer);

  // 3. Insert second member (simulating a join via code)
  const { data: member, error: memberError } = await supabase
    .from("trip_members")
    .insert({
      trip_id: trip.id,
      name: "Guest",
      emoji: "🥳",
      is_organizer: false,
      commitment_status: "pending",
    })
    .select("id, name, is_organizer, commitment_status")
    .single();

  if (memberError || !member) {
    console.error("❌ Insert member failed:", memberError?.message);
    await cleanup(trip.id);
    process.exit(1);
  }
  console.log("✅ Member row:", member);

  // 4. Verify both rows exist
  const { data: allMembers, error: fetchError } = await supabase
    .from("trip_members")
    .select("id, name, is_organizer, commitment_status")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });

  if (fetchError || !allMembers) {
    console.error("❌ Fetch members failed:", fetchError?.message);
    await cleanup(trip.id);
    process.exit(1);
  }

  console.log(`\n📋 All members (${allMembers.length}):`);
  allMembers.forEach((m) =>
    console.log(
      `   ${m.is_organizer ? "👑" : "👤"} ${m.name} — ${m.commitment_status}`
    )
  );

  if (allMembers.length !== 2) {
    console.error(`❌ Expected 2 members, got ${allMembers.length}`);
    await cleanup(trip.id);
    process.exit(1);
  }

  // 5. Cleanup
  await cleanup(trip.id);

  console.log("\n✅ All checks passed — smoke test OK.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
