"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId:   z.string().uuid(),
  memberId: z.string().uuid(),
  name:     z.string().min(1, "Destination name is required").max(100),
  reason:   z.string().max(150).optional(),
});

export async function addMemberSuggestion(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { error: msg };
  }

  const { tripId, memberId, name, reason } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("destination_suggestions").insert({
    trip_id:                tripId,
    name,
    reason:                 reason ?? null,
    suggested_by_ai:        false,
    suggested_by_member_id: memberId,
  });

  if (error) return { error: "Failed to add suggestion. Please try again." };
  return {};
}
