"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { refreshNudge }  from "@/app/actions/refresh-nudge";

const schema = z.object({
  tripId:      z.string().uuid(),
  destination: z.string().min(1),
});

export async function lockDestination(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { tripId, destination } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("trips")
    .update({ destination, destination_locked: true })
    .eq("id", tripId);

  if (error) return { error: "Failed to lock destination. Please try again." };

  try { await refreshNudge(tripId); } catch {}
  revalidatePath(`/trip/${tripId}`);
  return {};
}
