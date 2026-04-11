import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ShareButton from "@/components/trip/ShareButton";

const SECTION_CARDS = [
  { title: "Destinations", emoji: "📍", sub: "Vote on where you're headed" },
  { title: "Itinerary",    emoji: "🗓️", sub: "Day-by-day plan" },
  { title: "Tasks",        emoji: "✅", sub: "Who's doing what" },
  { title: "Vault",        emoji: "📁", sub: "Docs, links, and notes" },
  { title: "Expenses",     emoji: "💸", sub: "Split costs, settle up" },
];

const VIBE_LABELS: Record<string, string> = {
  beach: "Beach",
  mountains: "Mountains",
  city: "City",
  heritage: "Heritage",
  adventure: "Adventure",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function TripPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!trip) notFound();

  const { data: members } = await supabase
    .from("trip_members")
    .select("*")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });

  const memberList = members ?? [];

  const metaLine = [
    trip.vibe ? VIBE_LABELS[trip.vibe] : null,
    trip.month ?? null,
    trip.duration_days ? `${trip.duration_days} days` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const dateLabel =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
      : null;

  return (
    <main className="min-h-screen bg-[#FAF8F5]">

      {/* ── Dark hero ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#1C2B4A] to-[#243558] px-6 pt-14 pb-10">
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
          {dateLabel && (
            <p className="text-white/50 text-sm">{dateLabel}</p>
          )}
          <div className="pt-3">
            <ShareButton
              joinCode={trip.join_code}
              className="border-white/25 text-white bg-white/5 hover:bg-white/15 hover:border-white/40 w-full sm:w-auto"
            />
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">

        {/* AI nudge */}
        <p className="border-l-[3px] border-amber-400 pl-4 text-sm text-foreground/65 leading-relaxed italic">
          {trip.ai_nudge ?? "Welcome! Share the invite link above to get everyone in."}
        </p>

        {/* Members */}
        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Members · {memberList.length}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {memberList.map((m) => (
              <div
                key={m.id}
                className="flex-shrink-0 flex items-center gap-2 rounded-full border border-[#E8E4DE] bg-white px-3 py-2 shadow-sm"
              >
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  {m.name}
                </span>
                {m.is_organizer && (
                  <span className="text-[9px] bg-[#1C2B4A] text-white rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    Org
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section rows */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Trip sections
          </h2>
          <div className="divide-y divide-[#E8E4DE]">
            {SECTION_CARDS.map((card) => (
              <div
                key={card.title}
                className="flex items-center justify-between py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{card.emoji}</span>
                  <div>
                    <p className="font-medium text-foreground text-sm">{card.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0" />
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
