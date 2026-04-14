"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { anthropic }    from "@/lib/anthropic/client";
import { refreshNudge } from "@/app/actions/refresh-nudge";

// ── Zod schema for Claude response ───────────────────────────────────────────
// Kept deliberately permissive — Claude is non-deterministic. Only enforce
// structural shape; don't reject on item counts or string lengths.
const ItemSchema = z.object({
  time_slot:   z.string(),
  title:       z.string().min(1),
  description: z.string(),
  location:    z.string(),
  item_type:   z.enum(["activity", "meal", "transport", "buffer"]),
});

const DaySchema = z.object({
  day_number: z.number().positive(),
  title:      z.string().min(1),
  items:      z.array(ItemSchema).min(1),
});

const ItinerarySchema = z.array(DaySchema).min(1);

// ── Robust JSON-array extractor ───────────────────────────────────────────────
// Claude sometimes prefixes the JSON with a sentence or wraps it in fences.
// Find the first "[" and the matching last "]" to pull the array out cleanly.
function extractJsonArray(text: string): string {
  const stripped = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  const start = stripped.indexOf("[");
  const end   = stripped.lastIndexOf("]");
  if (start !== -1 && end > start) return stripped.slice(start, end + 1);
  return stripped; // fall through to JSON.parse which will throw a useful error
}

export async function generateItinerary(
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
  if (!trip.destination_locked) {
    return { error: "Lock a destination before generating the itinerary." };
  }

  // Rate limit: 60 s between AI calls
  if (trip.last_ai_call_at) {
    const elapsed = (Date.now() - new Date(trip.last_ai_call_at).getTime()) / 1000;
    if (elapsed < 60) return { rateLimited: true };
  }

  // Collect all member tags
  const { data: members } = await supabase
    .from("trip_members")
    .select("name, tags")
    .eq("trip_id", tripId);

  const allTags = Array.from(
    new Set((members ?? []).flatMap((m) => m.tags ?? []))
  );

  const userPrompt = [
    `Destination: ${trip.destination}`,
    `Start date: ${trip.start_date ?? "unknown"}`,
    `End date: ${trip.end_date ?? "unknown"}`,
    `Duration: ${trip.duration_days ?? "?"} days`,
    `Group size: ${members?.length ?? "?"}`,
    `Budget range: ${trip.budget_min ?? "?"} – ${trip.budget_max ?? "?"}`,
    `Vibe: ${trip.vibe ?? "any"}`,
    `Group type: ${trip.group_type ?? "mixed"}`,
    allTags.length > 0 ? `Member tags: ${allTags.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Stamp rate-limit timestamp before the slow API call
  await supabase
    .from("trips")
    .update({ last_ai_call_at: new Date().toISOString() })
    .eq("id", tripId);

  // ── Call Claude ───────────────────────────────────────────────────────────
  // Assistant prefill: seeding the response with "[" forces Claude to
  // continue the JSON array directly — preamble text is physically impossible.
  let rawText: string;
  try {
    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are an expert travel planner. " +
        "Your response must be a valid JSON array and nothing else — no explanation, no markdown fences, no commentary. " +
        "Start your response with [ and end with ]. " +
        "Schema: array of day objects, each with day_number (int), title (string), and items (array). " +
        "Each item: time_slot (string like '9:00 AM'), title (string), description (string, max 30 words), " +
        "location (string), item_type (one of: activity, meal, transport, buffer). " +
        "4-6 items per day. Always include meal slots and at least one buffer block per day. " +
        "Account for member tags like 'elderly' or 'infant' by avoiding strenuous activities.",
      messages: [
        { role: "user", content: userPrompt },
      ],
    });
    rawText = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `AI error: ${message}` };
  }

  // ── Parse & validate ──────────────────────────────────────────────────────
  // extractJsonArray is now a safety net only — prefill makes it unnecessary
  const jsonStr = extractJsonArray(rawText);

  let itinerary: z.infer<typeof ItinerarySchema>;
  try {
    itinerary = ItinerarySchema.parse(JSON.parse(jsonStr));
  } catch (parseErr) {
    console.error("[generate-itinerary] parse failed:", parseErr);
    console.error("[generate-itinerary] Claude raw (first 600 chars):", rawText.slice(0, 600));
    return { error: "AI returned an unexpected format. Please try again." };
  }

  // ── Insert days then items (sequential — items need day IDs) ─────────────
  for (const day of itinerary) {
    const { data: insertedDay, error: dayError } = await supabase
      .from("itinerary_days")
      .insert({
        trip_id:    tripId,
        day_number: day.day_number,
        title:      day.title,
      })
      .select()
      .single();

    if (dayError || !insertedDay) return { error: "Failed to save itinerary day." };

    const itemRows = day.items.map((item, index) => ({
      day_id:      insertedDay.id,
      time_slot:   item.time_slot,
      title:       item.title,
      description: item.description,
      location:    item.location,
      item_type:   item.item_type,
      order_index: index,
    }));

    const { error: itemsError } = await supabase
      .from("itinerary_items")
      .insert(itemRows);

    if (itemsError) return { error: "Failed to save itinerary items." };
  }

  try { await refreshNudge(tripId); } catch {}
  return {};
}
