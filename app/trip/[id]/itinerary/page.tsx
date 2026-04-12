import { notFound } from "next/navigation";
import { createClient }       from "@/lib/supabase/server";
import { getCurrentMemberId }  from "@/lib/server/current-member";
import ItinerarySection        from "@/components/trip/ItinerarySection";
import type { ItineraryDay, ItineraryItem, ItemSuggestion, SuggestionVote } from "@/lib/types/database";

export default async function ItineraryPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: trip }, currentMemberId] = await Promise.all([
    supabase
      .from("trips")
      .select("destination_locked, destination")
      .eq("id", params.id)
      .maybeSingle(),
    getCurrentMemberId(params.id),
  ]);

  if (!trip) notFound();

  const [membersRes, daysRes] = await Promise.all([
    supabase
      .from("trip_members")
      .select("id, is_organizer")
      .eq("trip_id", params.id),
    supabase
      .from("itinerary_days")
      .select("*")
      .eq("trip_id", params.id)
      .order("day_number", { ascending: true }),
  ]);

  const members     = membersRes.data ?? [];
  const days        = (daysRes.data ?? []) as ItineraryDay[];
  const currentMember = members.find((m) => m.id === currentMemberId) ?? null;
  const isOrganizer   = currentMember?.is_organizer ?? false;

  // Cascade: items → item suggestions → suggestion votes
  let items:           ItineraryItem[]   = [];
  let itemSuggestions: ItemSuggestion[]  = [];
  let suggestionVotes: SuggestionVote[]  = [];

  if (days.length > 0) {
    const dayIds = days.map((d) => d.id);
    const { data: itemsData } = await supabase
      .from("itinerary_items")
      .select("*")
      .in("day_id", dayIds)
      .order("order_index", { ascending: true });

    items = (itemsData ?? []) as ItineraryItem[];

    if (items.length > 0) {
      const itemIds = items.map((i) => i.id);
      const { data: sugData } = await supabase
        .from("item_suggestions")
        .select("*")
        .in("item_id", itemIds);
      itemSuggestions = (sugData ?? []) as ItemSuggestion[];

      if (itemSuggestions.length > 0) {
        const suggIds = itemSuggestions.map((s) => s.id);
        const { data: voteData } = await supabase
          .from("suggestion_votes")
          .select("*")
          .in("suggestion_id", suggIds);
        suggestionVotes = (voteData ?? []) as SuggestionVote[];
      }
    }
  }

  return (
    <ItinerarySection
      tripId={params.id}
      isOrganizer={isOrganizer}
      currentMemberId={currentMemberId}
      destinationLocked={trip.destination_locked}
      totalMembersCount={members.length}
      initialDays={days}
      initialItems={items}
      initialSuggestions={itemSuggestions}
      initialSuggestionVotes={suggestionVotes}
    />
  );
}
