"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  suggestionId: z.string().uuid(),
  memberId:     z.string().uuid(),
  vote:         z.enum(["yes", "no"]),
});

// Shared resolution logic — used by both vote and close actions.
// majority = floor(totalMembers / 2) + 1
// yes ≥ majority  → approve + update item
// no  ≥ majority  → reject
// all voted + tie → reject (no-change wins)
export async function resolveVote(
  supabase: ReturnType<typeof import("@/lib/supabase/server").createClient> extends Promise<infer T> ? T : never,
  suggestionId: string,
  force: boolean   // true = close vote immediately (organizer), false = only resolve on majority
): Promise<void> {
  // Fetch suggestion
  const { data: suggestion } = await supabase
    .from("item_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!suggestion || suggestion.status !== "pending") return;

  // Trace: suggestion → item → day → trip
  const { data: item } = await supabase
    .from("itinerary_items")
    .select("day_id")
    .eq("id", suggestion.item_id)
    .maybeSingle();

  if (!item) return;

  const { data: day } = await supabase
    .from("itinerary_days")
    .select("trip_id")
    .eq("id", item.day_id)
    .maybeSingle();

  if (!day) return;

  // Count all trip members (voting eligibility = all members)
  const { count: totalCount } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", day.trip_id);

  const total    = totalCount ?? 1;
  const majority = Math.floor(total / 2) + 1;

  // Count votes
  const { data: votes } = await supabase
    .from("suggestion_votes")
    .select("vote")
    .eq("suggestion_id", suggestionId);

  const yesCount   = (votes ?? []).filter((v) => v.vote === "yes").length;
  const noCount    = (votes ?? []).filter((v) => v.vote === "no").length;
  const totalVoted = yesCount + noCount;

  let approve: boolean | null = null; // null = still pending

  if (yesCount >= majority) {
    approve = true;
  } else if (noCount >= majority) {
    approve = false;
  } else if (totalVoted >= total) {
    // All members voted — tie goes to no (no-change wins)
    approve = false;
  } else if (force) {
    // Organizer closed early — yes > no wins; tie → no
    approve = yesCount > noCount;
  }

  if (approve === null) return; // still pending, no action

  await supabase
    .from("item_suggestions")
    .update({ status: approve ? "approved" : "rejected" })
    .eq("id", suggestionId);

  // On approval: update the itinerary item with the proposed values
  if (approve && suggestion.suggested_title) {
    await supabase
      .from("itinerary_items")
      .update({
        title:       suggestion.suggested_title,
        description: suggestion.suggested_description ?? null,
        location:    suggestion.suggested_location ?? null,
      })
      .eq("id", suggestion.item_id);
  }
}

export async function voteOnSuggestion(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { suggestionId, memberId, vote } = parsed.data;
  const supabase = await createClient();

  // Verify suggestion is still pending
  const { data: suggestion } = await supabase
    .from("item_suggestions")
    .select("status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!suggestion) return { error: "Suggestion not found." };
  if (suggestion.status !== "pending") return { error: "This vote is already closed." };

  // Upsert — UNIQUE (suggestion_id, member_id) lets members change their vote
  const { error: voteError } = await supabase
    .from("suggestion_votes")
    .upsert(
      { suggestion_id: suggestionId, member_id: memberId, vote },
      { onConflict: "suggestion_id,member_id" }
    );

  if (voteError) return { error: "Failed to cast vote. Try again." };

  // Check for auto-resolution
  await resolveVote(supabase, suggestionId, false);

  return {};
}
