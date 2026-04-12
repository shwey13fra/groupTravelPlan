"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    itemId:              z.string().uuid(),
    memberId:            z.string().uuid().optional(),
    // Freeform (member suggestion)
    suggestionText:      z.string().min(1).max(500).optional(),
    // Structured (organizer swap proposal — triggers voting)
    suggestedTitle:      z.string().min(1).max(200).optional(),
    suggestedDescription:z.string().max(500).optional(),
    suggestedLocation:   z.string().max(200).optional(),
  })
  .refine((d) => d.suggestionText || d.suggestedTitle, {
    message: "Either suggestionText or suggestedTitle is required.",
  });

export async function suggestItemSwap(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const {
    itemId,
    memberId,
    suggestionText,
    suggestedTitle,
    suggestedDescription,
    suggestedLocation,
  } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.from("item_suggestions").insert({
    item_id:              itemId,
    suggested_by:         memberId ?? null,
    suggestion_text:      suggestionText ?? "",
    suggested_title:      suggestedTitle ?? null,
    suggested_description:suggestedDescription ?? null,
    suggested_location:   suggestedLocation ?? null,
    status:               "pending",
  });

  if (error) return { error: "Failed to submit suggestion. Try again." };
  return {};
}
