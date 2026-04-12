"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  itemId:         z.string().uuid(),
  memberId:       z.string().uuid().optional(),
  suggestionText: z.string().min(1).max(500),
});

export async function suggestItemSwap(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { itemId, memberId, suggestionText } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("item_suggestions").insert({
    item_id:         itemId,
    suggested_by:    memberId ?? null,
    suggestion_text: suggestionText,
    status:          "pending",
  });

  if (error) return { error: "Failed to submit suggestion. Try again." };
  return {};
}
