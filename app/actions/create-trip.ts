"use server";

import { z } from "zod";
import { cookies } from "next/headers";
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
    tripName:      z.string().min(2).max(50),
    organizerName: z.string().min(1).max(30),
    organizerEmoji: z.string().min(1),
    groupSize:     z.coerce.number().int().min(2).max(20),
    currency:      z.string().min(1),
    budgetMin:     z.coerce.number().int().min(1),
    budgetMax:     z.coerce.number().int().min(1),
    startDate:     z.string().min(1, "Start date required"),
    endDate:       z.string().min(1, "End date required"),
    vibe:      z.enum(["beach", "mountains", "city", "heritage", "adventure"]),
    groupType: z.enum(["friends", "family", "mixed"]),
  })
  .refine((d) => d.budgetMax > d.budgetMin, {
    message: "Max budget must be greater than min budget",
    path: ["budgetMax"],
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
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

  // Generate a unique join code
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

  // Derive month + duration from the date range
  const start = new Date(data.startDate);
  const end   = new Date(data.endDate);
  const month = start.toLocaleString("en-US", { month: "long" });
  const durationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Insert trip
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      name: data.tripName,
      vibe: data.vibe,
      month,
      group_type: data.groupType,
      currency: data.currency,
      budget_min: data.budgetMin,
      budget_max: data.budgetMax,
      duration_days: durationDays,
      start_date: data.startDate,
      end_date: data.endDate,
      join_code: joinCode,
      status: "planning",
      destination_locked: false,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    return { error: "Failed to create trip. Please try again." };
  }

  // Insert organizer as a trip member — select id back to set cookie
  const { data: member, error: memberError } = await supabase
    .from("trip_members")
    .insert({
      trip_id: trip.id,
      name: data.organizerName,
      emoji: data.organizerEmoji,
      is_organizer: true,
      commitment_status: "in",
    })
    .select("id")
    .single();

  if (memberError || !member) {
    await supabase.from("trips").delete().eq("id", trip.id);
    return { error: "Failed to create trip. Please try again." };
  }

  // Stamp the organizer's auth user_id onto their member row (enables
  // device-independent identity on the dashboard)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from("trip_members")
      .update({ user_id: user.id })
      .eq("id", member.id);
  }

  // Identify this browser as the organizer for this trip
  const cookieStore = await cookies();
  cookieStore.set(`tmid_${trip.id}`, member.id, {
    path:     "/",
    maxAge:   60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
  });

  // Store last visited trip for the landing page "Continue" button
  cookieStore.set("last_trip_id", trip.id, {
    path:     "/",
    maxAge:   60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: true,
  });

  return { tripId: trip.id };
}
