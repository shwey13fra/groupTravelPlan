import type { TripVibe } from "@/lib/types/database";

// ── Vibe accent colours ───────────────────────────────────────────────────────
// Each vibe gets a saturated, characterful accent used in tab nav + UI highlights
export const VIBE_ACCENT: Record<TripVibe, string> = {
  beach:     "#06b6d4",   // cyan-500    — tropical sea
  mountains: "#6366f1",   // indigo-500  — alpine twilight
  city:      "#a855f7",   // purple-500  — neon cityscape
  heritage:  "#d97706",   // amber-600   — golden hour
  adventure: "#f97316",   // orange-500  — burning horizon
};

/** Returns the hex accent colour for a trip vibe, defaulting to cyan. */
export function getVibeAccent(vibe: string | null | undefined): string {
  return VIBE_ACCENT[(vibe as TripVibe)] ?? "#06b6d4";
}

// ── Per-vibe immersive hero gradients ─────────────────────────────────────────
// Rich multi-stop gradients that set mood per trip type
const VIBE_HERO_GRADIENT: Record<TripVibe, string> = {
  beach:     "linear-gradient(160deg, #0c4a6e 0%, #0e7490 45%, #134e4a 100%)",
  mountains: "linear-gradient(160deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)",
  city:      "linear-gradient(160deg, #1a0533 0%, #2d1b69 50%, #0f172a 100%)",
  heritage:  "linear-gradient(160deg, #431407 0%, #7c2d12 50%, #451a03 100%)",
  adventure: "linear-gradient(160deg, #1c0a00 0%, #7c2d12 50%, #431407 100%)",
};

/** Returns a rich per-vibe hero gradient string for inline style use. */
export function getVibeHeroGradient(vibe: string | null | undefined): string {
  return VIBE_HERO_GRADIENT[(vibe as TripVibe)]
    ?? "linear-gradient(160deg, #0f172a 0%, #1e2d4a 50%, #0a1628 100%)";
}
