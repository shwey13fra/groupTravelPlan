import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShareButton  from "@/components/trip/ShareButton";
import TripTabNav   from "@/components/trip/TripTabNav";

const VIBE_LABELS: Record<string, string> = {
  beach:     "Beach",
  mountains: "Mountains",
  city:      "City",
  heritage:  "Heritage",
  adventure: "Adventure",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, destination, start_date, end_date, duration_days, vibe, month, join_code")
    .eq("id", params.id)
    .maybeSingle();

  if (!trip) notFound();

  const dateRange =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
      : null;

  const metaLine = [
    trip.vibe ? VIBE_LABELS[trip.vibe] : null,
    dateRange ?? (trip.month ?? null),
    !dateRange && trip.duration_days ? `${trip.duration_days} days` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* ── Dark hero ──────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#1C2B4A] to-[#243558] px-6 pt-14 pb-8">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          {metaLine && (
            <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-medium">
              {metaLine}
            </p>
          )}
          <h1 className="font-display text-6xl sm:text-7xl text-[#FAF8F5] leading-tight">
            {trip.name}
          </h1>
          {trip.destination && (
            <p className="text-white/60 text-base">{trip.destination}</p>
          )}
          <div className="pt-2 flex justify-center sm:block">
            <ShareButton
              joinCode={trip.join_code}
              className="border-white/25 text-white bg-white/5 hover:bg-white/15 hover:border-white/40 sm:w-auto"
            />
          </div>
        </div>
      </div>

      {/* ── Sticky tab nav ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 shadow-sm">
        <TripTabNav tripId={trip.id} />
      </div>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        {children}
      </div>
    </div>
  );
}
