import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShareButton from "@/components/trip/ShareButton";

const SECTION_CARDS = [
  { title: "Destinations", emoji: "📍" },
  { title: "Itinerary",    emoji: "🗓️" },
  { title: "Tasks",        emoji: "✅" },
  { title: "Vault",        emoji: "📁" },
  { title: "Expenses",     emoji: "💸" },
];

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

  const dateLabel =
    trip.start_date && trip.end_date
      ? `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`
      : trip.month
      ? `Planned for ${trip.month}`
      : null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">

        {/* Hero */}
        <section className="space-y-1">
          <h1 className="font-display text-5xl sm:text-6xl text-foreground leading-tight">
            {trip.name}
          </h1>
          {trip.destination && (
            <p className="text-muted-foreground text-lg">{trip.destination}</p>
          )}
          {dateLabel && (
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          )}
        </section>

        {/* AI nudge banner */}
        <section className="rounded-xl bg-amber-50 border border-amber-100 px-5 py-4">
          <p className="text-sm text-amber-800 leading-relaxed">
            {trip.ai_nudge ?? "Welcome! Share the link below to invite your group."}
          </p>
        </section>

        {/* Share */}
        <ShareButton joinCode={trip.join_code} />

        {/* Members */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Members · {memberList.length}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {memberList.map((m) => (
              <div
                key={m.id}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-full bg-secondary px-3 py-2 text-sm"
              >
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="font-medium text-foreground whitespace-nowrap">
                  {m.name}
                </span>
                {m.is_organizer && (
                  <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wide">
                    Org
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Placeholder section cards */}
        <section className="space-y-3">
          {SECTION_CARDS.map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4"
            >
              <span className="text-2xl">{card.emoji}</span>
              <div>
                <p className="font-semibold text-foreground">{card.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Coming up in the next phase.
                </p>
              </div>
            </div>
          ))}
        </section>

      </div>
    </main>
  );
}
