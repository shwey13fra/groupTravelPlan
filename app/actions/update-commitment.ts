"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  memberId:      z.string().uuid(),
  tripId:        z.string().uuid(),
  status:        z.enum(["in", "out"]),
  availableFrom: z.string().optional(),
  availableTo:   z.string().optional(),
});

export async function updateCommitment(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { memberId, tripId, status, availableFrom, availableTo } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("trip_members")
    .update({
      commitment_status: status,
      ...(availableFrom ? { available_from: availableFrom } : {}),
      ...(availableTo   ? { available_to:   availableTo   } : {}),
    })
    .eq("id", memberId)
    .eq("trip_id", tripId); // ensure member belongs to this trip

  if (error) return { error: "Failed to update. Please try again." };

  revalidatePath(`/trip/${tripId}`);
  return {};
}
