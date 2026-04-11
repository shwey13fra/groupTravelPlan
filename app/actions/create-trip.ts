"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// No ambiguous chars: 0 O I 1
const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode(): string {
  return Array.from(
    { length: 6 },
    () => JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)]
  ).join("");
}

const createTripSchema = z
  .object({
    tripName: z.string().min(2).max(50),
    organizerName: z.string().min(1).max(30),
    organizerEmoji: z.string().min(1),
    groupSize: z.coerce.number().int().min(2).max(20),
    budgetMin: z.coerce.number().int().min(1),
    budgetMax: z.coerce.number().int().min(1),
    durationDays: z.coerce.number().int().min(1).max(30),
    vibe: z.enum(["beach", "mountains", "city", "heritage", "adventure"]),
    month: z.enum([
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ]),
    groupType: z.enum(["friends", "family", "mixed"]),
  })
  .refine((d) => d.budgetMax > d.budgetMin, {
    message: "Max budget must be greater than min budget",
    path: ["budgetMax"],
  });

type CreateTripInput = z.infer<typeof createTripSchema>;

export async function createTrip(
  input: unknown
): Promise<{ tripId: string } | { error: string }> {
  const parsed = createTripSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    return { error: msg };
  }

  const data: CreateTripInput = parsed.data;
  const supabase = await createClient();

  // Generate a unique join code (collision is astronomically unlikely but handle it)
  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("trips")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!existing) break;
    joinCode = generateJoinCode();
  }

  // Insert trip
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      name: data.tripName,
      vibe: data.vibe,
      month: data.month,
      group_type: data.groupType,
      budget_min: data.budgetMin,
      budget_max: data.budgetMax,
      duration_days: data.durationDays,
      join_code: joinCode,
      status: "planning",
      destination_locked: false,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    return { error: "Failed to create trip. Please try again." };
  }

  // Insert organizer as a trip member
  const { error: memberError } = await supabase.from("trip_members").insert({
    trip_id: trip.id,
    name: data.organizerName,
    emoji: data.organizerEmoji,
    is_organizer: true,
    commitment_status: "in",
  });

  if (memberError) {
    // Clean up the orphaned trip
    await supabase.from("trips").delete().eq("id", trip.id);
    return { error: "Failed to create trip. Please try again." };
  }

  return { tripId: trip.id };
}
