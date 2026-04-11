"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const joinTripSchema = z.object({
  tripId: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(30, "Max 30 characters"),
  emoji: z.string().min(1, "Pick an emoji"),
});

export async function joinTrip(
  input: unknown
): Promise<{ error: string }> {
  const parsed = joinTripSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const { tripId, name, emoji } = parsed.data;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) {
    return { error: "Trip not found." };
  }

  const { data: member, error } = await supabase
    .from("trip_members")
    .insert({
      trip_id: tripId,
      name,
      emoji,
      is_organizer: false,
      commitment_status: "pending",
    })
    .select("id")
    .single();

  if (error || !member) {
    return { error: "Failed to join trip. Please try again." };
  }

  // Identify this browser as this member for this trip
  const cookieStore = await cookies();
  cookieStore.set(`tmid_${tripId}`, member.id, {
    path:     "/",
    maxAge:   60 * 60 * 24 * 30, // 30 days
    sameSite: "lax",
    httpOnly: true,
  });

  redirect(`/trip/${tripId}`);
}
