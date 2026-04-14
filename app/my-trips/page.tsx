import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions/sign-out";
import { getVibeAccent } from "@/lib/theme";

const VIBE_EMOJI: Record<string, string> = {
  beach:     "🏖️",
  mountains: "⛰️",
  city:      "🏙️",
  heritage:  "🏛️",
  adventure: "🎒",
};

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MyTripsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: memberships } = await supabase
    .from("trip_members")
    .select("trip_id, trips(id, name, vibe, month, status, join_code, destination_locked, destination, start_date, end_date, duration_days)")
    .eq("user_id", user.id)
    .eq("is_organizer", true)
    .order("created_at", { ascending: false });

  type TripRow = {
    id: string; name: string; vibe: string | null; month: string | null;
    status: string; join_code: string; destination_locked: boolean;
    destination: string | null; start_date: string | null;
    end_date: string | null; duration_days: number | null;
  };

  const trips = (memberships ?? [])
    .flatMap((m) => (Array.isArray(m.trips) ? m.trips : [m.trips]))
    .filter(Boolean) as unknown as TripRow[];

  // Batch member count for all trips in one query
  let memberCountByTripId: Record<string, number> = {};
  if (trips.length > 0) {
    const tripIds = trips.map((t) => t.id);
    const { data: memberRows } = await supabase
      .from("trip_members")
      .select("trip_id")
      .in("trip_id", tripIds);
    memberCountByTripId = (memberRows ?? []).reduce<Record<string, number>>((acc, m) => {
      acc[m.trip_id] = (acc[m.trip_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5]">

      {/* Immersive hero */}
      <div
        className="relative overflow-hidden px-6 pt-14 pb-10"
        style={{
          background:
            "linear-gradient(160deg, #0f172a 0%, #1e2d4a 50%, #0a1628 100%)",
        }}
      >
        {/* Subtle ambient orb */}
        <div className="pointer-events-none absolute top-0 right-0 h-80 w-80 translate-x-1/3 -translate-y-1/3 rounded-full bg-indigo-600/[0.15] blur-[90px]" />
        <div className="relative mx-auto max-w-2xl flex items-end justify-between">
          <div className="space-y-2">
            <a href="/" className="font-display text-xl text-white/40 hover:text-white/80 transition-colors block">
              TripSync
            </a>
            <h1 className="font-display text-5xl sm:text-6xl text-[#FAF8F5] leading-tight">
              Your trips
            </h1>
            <p className="text-white/40 text-sm">{user.email}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-white/35 hover:text-white/65 transition-colors underline underline-offset-2"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-4">

        {trips.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-10 text-center space-y-3">
            <p className="text-muted-foreground text-sm">No trips yet.</p>
            <Button asChild className="bg-[#1C2B4A] hover:bg-[#243558] text-white border-0">
              <Link href="/create">Create your first trip</Link>
            </Button>
          </div>
        ) : (
          <>
            {trips.map((trip) => {
              const memberCount = memberCountByTripId[trip.id] ?? 0;

              // Build date string
              const dateStr = trip.start_date && trip.end_date
                ? `${formatShortDate(trip.start_date)} – ${formatShortDate(trip.end_date)}`
                : trip.duration_days
                ? `${trip.duration_days} days`
                : null;

              // Build meta line
              const metaParts = [
                trip.destination_locked && trip.destination ? `📍 ${trip.destination}` : trip.month ? `Planned for ${trip.month}` : null,
                dateStr,
                memberCount > 0 ? `${memberCount} member${memberCount !== 1 ? "s" : ""}` : null,
              ].filter(Boolean);

              const accent = getVibeAccent(trip.vibe);
              return (
                <Link
                  key={trip.id}
                  href={`/trip/${trip.id}`}
                  className="flex items-center justify-between rounded-xl border border-[#E8E4DE] bg-white overflow-hidden shadow-sm hover:shadow-md hover:border-[#C8C4BC] transition-all group"
                  style={{ borderLeftColor: accent, borderLeftWidth: "3px" }}
                >
                  <div className="space-y-1.5 min-w-0 px-5 py-4">
                    <div className="flex items-center gap-2">
                      {trip.vibe && (
                        <span className="text-lg">{VIBE_EMOJI[trip.vibe] ?? "✈️"}</span>
                      )}
                      <p className="font-display text-2xl text-foreground leading-tight truncate">
                        {trip.name}
                      </p>
                    </div>
                    {metaParts.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {metaParts.join(" · ")}
                      </p>
                    )}
                    {/* Status badge */}
                    <div>
                      {trip.destination_locked ? (
                        <span className="inline-block text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-0.5 border border-emerald-100">
                          Destination locked ✓
                        </span>
                      ) : (
                        <span className="inline-block text-[10px] font-medium bg-[#F4F1EC] text-muted-foreground rounded-full px-2.5 py-0.5">
                          Planning
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground shrink-0 transition-all group-hover:translate-x-0.5 mr-5" />
                </Link>
              );
            })}

            <Button
              asChild
              variant="outline"
              className="w-full min-h-[44px] gap-2 border-dashed"
            >
              <Link href="/create">
                <Plus className="h-4 w-4" />
                Create another trip
              </Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
