"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  suggestionId: z.string().uuid(),
  status:       z.enum(["approved", "rejected"]),
});

export async function reviewItemSuggestion(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { suggestionId, status } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("item_suggestions")
    .update({ status })
    .eq("id", suggestionId);

  if (error) return { error: "Failed to update suggestion." };
  return {};
}
