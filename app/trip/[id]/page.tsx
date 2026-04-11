import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ShareButton        from "@/components/trip/ShareButton";
import CommitmentWidget   from "@/components/trip/CommitmentWidget";
import DestinationVoting  from "@/components/trip/DestinationVoting";

const SECTION_CARDS = [
  { title: "Itinerary", emoji: "🗓️", sub: "Day-by-day plan" },
  { title: "Tasks",     emoji: "✅", sub: "Who's doing what" },
  { title: "Vault",     emoji: "📁", sub: "Docs, links, and notes" },
  { title: "Expenses",  emoji: "💸", sub: "Split costs, settle up" },
];

const VIBE_LABELS: Record<string, string> = {
  beach:     "Beach",
  mountains: "Mountains",
  city:      "City",
  heritage:  "Heritage",
  adventure: "Adventure",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

export default async function TripPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  // Batch both fetches in parallel
  const [{ data: trip }, cookieStore] = await Promise.all([
    supabase.from("trips").select("*").eq("id", params.id).maybeSingle(),
    cookies(),
  ]);

  if (!trip) notFound();

  // Identify current member from cookie
  const currentMemberId = cookieStore.get(`tmid_${trip.id}`)?.value ?? null;

  // Remaining fetches in parallel
  const [membersRes, suggestionsRes, votesRes] = await Promise.all([
    supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("destination_suggestions")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("destination_votes")
      .select("*")
      .eq("trip_id", trip.id),
  ]);

  const memberList  = membersRes.data   ?? [];
  const suggestions = suggestionsRes.data ?? [];
  const votes       = votesRes.data      ?? [];

  const currentMember = memberList.find((m) => m.id === currentMemberId) ?? null;
  const isOrganizer   = currentMember?.is_organizer ?? false;
  const confirmedCount = memberList.filter((m) => m.commitment_status === "in").length;

  const metaLine = [
    trip.vibe        ? VIBE_LABELS[trip.vibe] : null,
    trip.month       ?? null,
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

      {/* ── Dark hero ─────────────────────────────────────────────────── */}
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

      {/* ── Content ───────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl px-6 py-8 space-y-8">

        {/* AI nudge */}
        <p className="border-l-[3px] border-amber-400 pl-4 text-sm text-foreground/65 leading-relaxed italic">
          {trip.ai_nudge ?? "Welcome! Share the invite link above to get everyone in."}
        </p>

        {/* Commitment toggle (only if current browser is a member) */}
        {currentMember && (
          <CommitmentWidget
            tripId={trip.id}
            memberId={currentMember.id}
            currentStatus={currentMember.commitment_status as "in" | "out" | "pending"}
            confirmedCount={confirmedCount}
            totalCount={memberList.length}
          />
        )}

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

        {/* Destination voting (client component — handles realtime) */}
        <DestinationVoting
          tripId={trip.id}
          currentMemberId={currentMemberId}
          isOrganizer={isOrganizer}
          destinationLocked={trip.destination_locked}
          lockedDestination={trip.destination}
          initialSuggestions={suggestions}
          initialVotes={votes}
        />

        {/* Remaining placeholder sections */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Coming up
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
