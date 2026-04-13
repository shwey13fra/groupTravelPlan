"use server";

import { z }          from "zod";
import { createClient } from "@/lib/supabase/server";
import { anthropic }   from "@/lib/anthropic/client";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function refreshNudge(
  tripId: string,
): Promise<{ rateLimited?: true }> {
  if (!z.string().uuid().safeParse(tripId).success) return {};

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return {};

  // ── Rate limit: 60 s on last_nudge_at (separate from last_ai_call_at) ────
  if (trip.last_nudge_at) {
    const elapsed = (Date.now() - new Date(trip.last_nudge_at).getTime()) / 1000;
    if (elapsed < 60) return { rateLimited: true };
  }

  // Stamp before the slow calls so concurrent triggers don't race
  await supabase
    .from("trips")
    .update({ last_nudge_at: new Date().toISOString() })
    .eq("id", tripId);

  // ── Load counts in parallel ───────────────────────────────────────────────
  const [membersRes, daysRes, tasksRes, expensesRes, vaultRes] = await Promise.all([
    supabase
      .from("trip_members")
      .select("id, commitment_status")
      .eq("trip_id", tripId),
    supabase
      .from("itinerary_days")
      .select("id")
      .eq("trip_id", tripId),
    supabase
      .from("tasks")
      .select("id, status")
      .eq("trip_id", tripId),
    supabase
      .from("expenses")
      .select("id")
      .eq("trip_id", tripId),
    supabase
      .from("vault_items")
      .select("id")
      .eq("trip_id", tripId),
  ]);

  const members   = membersRes.data ?? [];
  const tasks     = tasksRes.data ?? [];
  const confirmed = members.filter((m) => m.commitment_status === "in").length;
  const pending   = members.filter((m) => m.commitment_status === "pending").length;
  const taskTodo  = tasks.filter((t) => t.status === "todo").length;
  const taskWip   = tasks.filter((t) => t.status === "in_progress").length;
  const taskDone  = tasks.filter((t) => t.status === "done").length;

  // ── Build structured summary ──────────────────────────────────────────────
  const dateRange =
    trip.start_date && trip.end_date
      ? `${fmt(trip.start_date)} – ${fmt(trip.end_date)}`
      : trip.month ?? "dates TBD";

  const summary = [
    `Trip: ${trip.name}${trip.destination ? `, ${trip.destination}` : ""}, ${dateRange}.`,
    `${members.length} members invited, ${confirmed} confirmed, ${pending} pending.`,
    trip.destination_locked
      ? `Destination locked: ${trip.destination}.`
      : "Destination not yet decided.",
    (daysRes.data?.length ?? 0) > 0
      ? `Itinerary generated (${daysRes.data!.length} days).`
      : "No itinerary yet.",
    tasks.length > 0
      ? `Tasks: ${tasks.length} total, ${taskTodo} todo, ${taskWip} in progress, ${taskDone} done.`
      : "No tasks created yet.",
    `Expenses: ${expensesRes.data?.length ?? 0} logged.`,
    `Vault: ${vaultRes.data?.length ?? 0} item${(vaultRes.data?.length ?? 0) !== 1 ? "s" : ""}.`,
  ].join(" ");

  // ── Call Claude ───────────────────────────────────────────────────────────
  let nudgeText: string;
  try {
    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 200,
      system:
        "You are the trip organizer's assistant. Given the trip state, write ONE short actionable nudge " +
        "(max 2 sentences) telling the organizer the single most important next step. " +
        "Be warm but direct. No greetings, no 'Hi!' — just the nudge. Plain text only.",
      messages: [{ role: "user", content: summary }],
    });
    nudgeText = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  } catch (err) {
    console.error("[refresh-nudge] Claude call failed:", err instanceof Error ? err.message : err);
    return {};
  }

  if (!nudgeText) return {};

  await supabase
    .from("trips")
    .update({ ai_nudge: nudgeText })
    .eq("id", tripId);

  return {};
}
