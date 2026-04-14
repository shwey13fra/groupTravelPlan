"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient }  from "@/lib/supabase/server";
import { refreshNudge }  from "@/app/actions/refresh-nudge";

const joinTripSchema = z.object({
  tripId: z.string().uuid(),
  name:   z.string().min(1, "Name is required").max(30, "Max 30 characters"),
  emoji:  z.string().min(1, "Pick an emoji"),
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

  if (!trip) return { error: "Trip not found." };

  const cookieStore = await cookies();

  // Block if this name is already taken in the trip — prevents impersonation.
  // Each member must have a unique name within a trip.
  const { data: existing } = await supabase
    .from("trip_members")
    .select("id")
    .eq("trip_id", tripId)
    .ilike("name", name.trim())
    .maybeSingle();

  if (existing) {
    return {
      error: `"${name.trim()}" is already taken in this trip. Choose a different name.`,
    };
  }

  // New member
  const { data: member, error } = await supabase
    .from("trip_members")
    .insert({
      trip_id:           tripId,
      name:              name.trim(),
      emoji,
      is_organizer:      false,
      commitment_status: "pending",
    })
    .select("id")
    .single();

  if (error || !member) return { error: "Failed to join trip. Please try again." };
  const memberId = member.id;

  // Set member identity cookie (scoped to this trip)
  cookieStore.set(`tmid_${tripId}`, memberId, {
    path:     "/",
    maxAge:   60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
  });

  // Store last visited trip for the landing page "Continue" button
  cookieStore.set("last_trip_id", tripId, {
    path:     "/",
    maxAge:   60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
  });

  // Fire nudge (best-effort — redirect follows immediately)
  try { await refreshNudge(tripId); } catch {}

  redirect(`/trip/${tripId}`);
}
