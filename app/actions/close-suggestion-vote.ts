"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveVote } from "./vote-on-suggestion";

const schema = z.object({
  suggestionId: z.string().uuid(),
});

export async function closeSuggestionVote(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { suggestionId } = parsed.data;
  const supabase = await createClient();

  // Verify still pending
  const { data: suggestion } = await supabase
    .from("item_suggestions")
    .select("status")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!suggestion) return { error: "Suggestion not found." };
  if (suggestion.status !== "pending") return { error: "Vote is already closed." };

  // Force-resolve: yes > no → approve, else → reject
  await resolveVote(supabase, suggestionId, true);

  return {};
}
