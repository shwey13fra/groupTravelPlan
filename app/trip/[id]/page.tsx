import { notFound } from "next/navigation";
import { createClient }      from "@/lib/supabase/server";
import { getCurrentMemberId } from "@/lib/server/current-member";
import CommitmentWidget   from "@/components/trip/CommitmentWidget";
import DestinationVoting  from "@/components/trip/DestinationVoting";

export default async function TripOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: trip }, currentMemberId] = await Promise.all([
    supabase.from("trips").select("*").eq("id", params.id).maybeSingle(),
    getCurrentMemberId(params.id),
  ]);

  if (!trip) notFound();

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

  const memberList  = membersRes.data    ?? [];
  const suggestions = suggestionsRes.data ?? [];
  const votes       = votesRes.data       ?? [];

  const currentMember  = memberList.find((m) => m.id === currentMemberId) ?? null;
  const isOrganizer    = currentMember?.is_organizer ?? false;
  const confirmedCount = memberList.filter((m) => m.commitment_status === "in").length;

  return (
    <div className="space-y-8">
      {/* AI nudge */}
      <p className="border-l-[3px] border-amber-400 pl-4 text-sm text-foreground/65 leading-relaxed italic">
        {trip.ai_nudge ?? "Welcome! Share the invite link above to get everyone in."}
      </p>

      {/* Commitment toggle */}
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
          {memberList.map((m) => {
            const isMe = m.id === currentMemberId;
            return (
              <div
                key={m.id}
                className={`flex-shrink-0 flex items-center gap-2 rounded-full border px-3 py-2 shadow-sm ${
                  isMe
                    ? "border-[#1C2B4A]/30 bg-[#1C2B4A]/[0.06] ring-1 ring-[#1C2B4A]/20"
                    : "border-[#E8E4DE] bg-white"
                }`}
              >
                <span className="text-base leading-none">{m.emoji}</span>
                <span className="text-sm font-medium text-foreground whitespace-nowrap">
                  {m.name}
                </span>
                {isMe && (
                  <span className="text-[9px] bg-[#1C2B4A]/10 text-[#1C2B4A] rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    You
                  </span>
                )}
                {m.is_organizer && (
                  <span className="text-[9px] bg-[#1C2B4A] text-white rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider">
                    Org
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Destination voting */}
      <DestinationVoting
        tripId={trip.id}
        currentMemberId={currentMemberId}
        isOrganizer={isOrganizer}
        destinationLocked={trip.destination_locked}
        lockedDestination={trip.destination}
        initialSuggestions={suggestions}
        initialVotes={votes}
      />
    </div>
  );
}
