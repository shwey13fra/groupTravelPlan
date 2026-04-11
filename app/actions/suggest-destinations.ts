"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic/client";

const aiSchema = z
  .array(
    z.object({
      name:   z.string().min(1),
      reason: z.string(),
    })
  )
  .length(3);

export async function suggestDestinations(
  tripId: string
): Promise<{ rateLimited?: true; error?: string }> {
  if (!z.string().uuid().safeParse(tripId).success) return { error: "Invalid trip." };

  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return { error: "Trip not found." };

  // Rate limit: 60 s between AI calls
  if (trip.last_ai_call_at) {
    const elapsed = (Date.now() - new Date(trip.last_ai_call_at).getTime()) / 1000;
    if (elapsed < 60) return { rateLimited: true };
  }

  // Build structured prompt
  const userPrompt = [
    `Vibe: ${trip.vibe ?? "any"}`,
    `Month: ${trip.month ?? "any"}`,
    `Duration: ${trip.duration_days ?? "?"} days`,
    `Group type: ${trip.group_type ?? "any"}`,
    `Budget per person: ${trip.currency ?? "USD"} ${trip.budget_min ?? "?"} – ${trip.budget_max ?? "?"}`,
  ].join(", ");

  // Call Claude
  let rawText: string;
  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system:
        'You are a travel planning assistant. Return ONLY valid JSON, no markdown fences, no commentary. Schema: an array of exactly 3 objects, each with "name" (string) and "reason" (string, max 20 words).',
      messages: [{ role: "user", content: userPrompt }],
    });
    rawText = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  } catch {
    return { error: "AI service unavailable. Please try again." };
  }

  // Parse & validate
  let suggestions: z.infer<typeof aiSchema>;
  try {
    suggestions = aiSchema.parse(JSON.parse(rawText));
  } catch {
    return { error: "AI returned an unexpected format. Please try again." };
  }

  // Stamp rate-limit timestamp
  await supabase
    .from("trips")
    .update({ last_ai_call_at: new Date().toISOString() })
    .eq("id", tripId);

  // Insert suggestions
  const rows = suggestions.map((s) => ({
    trip_id:                tripId,
    name:                   s.name,
    reason:                 s.reason,
    suggested_by_ai:        true,
    suggested_by_member_id: null as string | null,
  }));

  const { error: insertError } = await supabase
    .from("destination_suggestions")
    .insert(rows);

  if (insertError) return { error: "Failed to save suggestions. Try again." };

  return {};
}
