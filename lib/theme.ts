import type { TripVibe } from "@/lib/types/database";

// ── Vibe accent colours ───────────────────────────────────────────────────────
export const VIBE_ACCENT: Record<TripVibe, string> = {
  beach:     "#2dd4bf",   // teal
  mountains: "#16a34a",   // forest green
  city:      "#475569",   // slate blue
  heritage:  "#c2410c",   // terracotta
  adventure: "#ea580c",   // burnt orange
};

/** Returns the hex accent colour for a trip vibe, defaulting to teal. */
export function getVibeAccent(vibe: string | null | undefined): string {
  return VIBE_ACCENT[(vibe as TripVibe)] ?? "#2dd4bf";
}
