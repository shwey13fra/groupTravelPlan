"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId:       z.string().uuid(),
  memberId:     z.string().uuid(),
  suggestionId: z.string().uuid(),
});

export async function voteDestination(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { tripId, memberId, suggestionId } = parsed.data;
  const supabase = await createClient();

  // Upsert — UNIQUE (trip_id, member_id) means one vote per member per trip;
  // upsert changes their vote to the new suggestion.
  const { error } = await supabase.from("destination_votes").upsert(
    { trip_id: tripId, member_id: memberId, suggestion_id: suggestionId },
    { onConflict: "trip_id,member_id" }
  );

  if (error) return { error: "Failed to vote. Please try again." };
  return {};
}
