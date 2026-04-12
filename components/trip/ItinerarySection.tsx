"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Activity, UtensilsCrossed, Car, Coffee,
  MapPin, Clock, MessageSquarePlus, CheckCircle, XCircle,
  ThumbsUp, ThumbsDown, VoteIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { generateItinerary }     from "@/app/actions/generate-itinerary";
import { suggestItemSwap }       from "@/app/actions/suggest-item-swap";
import { reviewItemSuggestion }  from "@/app/actions/review-item-suggestion";
import { voteOnSuggestion }      from "@/app/actions/vote-on-suggestion";
import { closeSuggestionVote }   from "@/app/actions/close-suggestion-vote";
import type {
  ItineraryDay, ItineraryItem, ItemSuggestion, SuggestionVote,
} from "@/lib/types/database";

// ── Item type icons + colours ─────────────────────────────────────────────────
const TYPE_ICON: Record<string, React.ElementType> = {
  activity:  Activity,
  meal:      UtensilsCrossed,
  transport: Car,
  buffer:    Coffee,
};
const TYPE_COLOR: Record<string, string> = {
  activity:  "text-blue-500  bg-blue-50",
  meal:      "text-amber-500 bg-amber-50",
  transport: "text-purple-500 bg-purple-50",
  buffer:    "text-stone-500  bg-stone-100",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  tripId:                  string;
  isOrganizer:             boolean;
  currentMemberId:         string | null;
  destinationLocked:       boolean;
  totalMembersCount:       number;
  initialDays:             ItineraryDay[];
  initialItems:            ItineraryItem[];
  initialSuggestions:      ItemSuggestion[];
  initialSuggestionVotes:  SuggestionVote[];
}

export default function ItinerarySection({
  tripId,
  isOrganizer,
  currentMemberId,
  destinationLocked,
  totalMembersCount,
  initialDays,
  initialItems,
  initialSuggestions,
  initialSuggestionVotes,
}: Props) {
  const [days,            setDays]            = useState<ItineraryDay[]>(initialDays);
  const [items,           setItems]           = useState<ItineraryItem[]>(initialItems);
  const [suggestions,     setSuggestions]     = useState<ItemSuggestion[]>(initialSuggestions);
  const [suggestionVotes, setSuggestionVotes] = useState<SuggestionVote[]>(initialSuggestionVotes);

  const [generating,     setGenerating]     = useState(false);
  const [swapItemId,     setSwapItemId]     = useState<string | null>(null);
  const [swapItem,       setSwapItem]       = useState<ItineraryItem | null>(null);

  // Freeform (member) fields
  const [swapText,       setSwapText]       = useState("");
  // Structured (organizer) fields
  const [swapTitle,      setSwapTitle]      = useState("");
  const [swapDesc,       setSwapDesc]       = useState("");
  const [swapLocation,   setSwapLocation]   = useState("");

  const [submittingSwap, setSubmittingSwap] = useState(false);
  const [reviewingId,    setReviewingId]    = useState<string | null>(null);
  const [votingId,       setVotingId]       = useState<string | null>(null);
  const [closingId,      setClosingId]      = useState<string | null>(null);

  // Refs so realtime callbacks see current IDs without re-subscribing
  const itemIdsRef       = useRef<string[]>(initialItems.map((i) => i.id));
  const suggestionIdsRef = useRef<string[]>(initialSuggestions.map((s) => s.id));

  useEffect(() => { itemIdsRef.current = items.map((i) => i.id); }, [items]);
  useEffect(() => { suggestionIdsRef.current = suggestions.map((s) => s.id); }, [suggestions]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const client = createClient();

    async function refetchDaysAndItems() {
      const { data: newDays } = await client
        .from("itinerary_days")
        .select("*")
        .eq("trip_id", tripId)
        .order("day_number", { ascending: true });

      if (!newDays) return;
      setDays(newDays as ItineraryDay[]);

      const dayIds = newDays.map((d) => d.id);
      if (dayIds.length === 0) { setItems([]); return; }

      const { data: newItems } = await client
        .from("itinerary_items")
        .select("*")
        .in("day_id", dayIds)
        .order("order_index", { ascending: true });

      if (newItems) setItems(newItems as ItineraryItem[]);
    }

    async function refetchSuggestionsAndVotes() {
      const ids = itemIdsRef.current;
      if (ids.length === 0) return;

      const { data: newSugs } = await client
        .from("item_suggestions")
        .select("*")
        .in("item_id", ids);

      if (!newSugs) return;
      setSuggestions(newSugs as ItemSuggestion[]);

      const suggIds = newSugs.map((s) => s.id);
      if (suggIds.length === 0) { setSuggestionVotes([]); return; }

      const { data: newVotes } = await client
        .from("suggestion_votes")
        .select("*")
        .in("suggestion_id", suggIds);

      if (newVotes) setSuggestionVotes(newVotes as SuggestionVote[]);
    }

    const channel = client
      .channel(`trip-itinerary-${tripId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "itinerary_days",   filter: `trip_id=eq.${tripId}` },
        refetchDaysAndItems)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "itinerary_items" },
        refetchDaysAndItems)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "item_suggestions" },
        refetchSuggestionsAndVotes)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "suggestion_votes" },
        refetchSuggestionsAndVotes)
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [tripId]);

  // ── Derived maps ─────────────────────────────────────────────────────────────
  const itemsByDayId = items.reduce<Record<string, ItineraryItem[]>>((acc, item) => {
    (acc[item.day_id] ??= []).push(item);
    return acc;
  }, {});

  const suggestionsByItemId = suggestions.reduce<Record<string, ItemSuggestion[]>>((acc, s) => {
    (acc[s.item_id] ??= []).push(s);
    return acc;
  }, {});

  const votesBySuggId = suggestionVotes.reduce<Record<string, SuggestionVote[]>>((acc, v) => {
    (acc[v.suggestion_id] ??= []).push(v);
    return acc;
  }, {});

  const majority = Math.floor(totalMembersCount / 2) + 1;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function openSwapDialog(item: ItineraryItem) {
    setSwapItem(item);
    setSwapItemId(item.id);
    if (isOrganizer) {
      setSwapTitle(item.title);
      setSwapDesc(item.description ?? "");
      setSwapLocation(item.location ?? "");
    } else {
      setSwapText("");
    }
  }

  function closeSwapDialog() {
    setSwapItemId(null);
    setSwapItem(null);
  }

  async function handleGenerate() {
    setGenerating(true);
    const result = await generateItinerary(tripId);
    setGenerating(false);
    if (result.rateLimited) { toast.warning("Please wait a moment before regenerating."); return; }
    if (result.error) { toast.error(result.error); return; }
  }

  async function handleSubmitSwap() {
    if (!swapItemId) return;
    setSubmittingSwap(true);

    const payload = isOrganizer
      ? {
          itemId:              swapItemId,
          memberId:            currentMemberId ?? undefined,
          suggestedTitle:      swapTitle.trim(),
          suggestedDescription:swapDesc.trim() || undefined,
          suggestedLocation:   swapLocation.trim() || undefined,
        }
      : {
          itemId:         swapItemId,
          memberId:       currentMemberId ?? undefined,
          suggestionText: swapText.trim(),
        };

    if (isOrganizer && !swapTitle.trim()) {
      toast.error("Title is required.");
      setSubmittingSwap(false);
      return;
    }
    if (!isOrganizer && !swapText.trim()) {
      toast.error("Please describe your suggestion.");
      setSubmittingSwap(false);
      return;
    }

    const result = await suggestItemSwap(payload);
    setSubmittingSwap(false);
    if (result.error) { toast.error(result.error); return; }

    toast.success(
      isOrganizer
        ? "Swap proposed — members can now vote."
        : "Suggestion submitted."
    );
    closeSwapDialog();
  }

  async function handleReview(suggestionId: string, status: "approved" | "rejected") {
    setReviewingId(suggestionId);
    const result = await reviewItemSuggestion({ suggestionId, status });
    setReviewingId(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success(status === "approved" ? "Suggestion approved." : "Suggestion dismissed.");
  }

  async function handleVote(suggestionId: string, vote: "yes" | "no") {
    if (!currentMemberId) { toast.error("Join the trip to vote."); return; }
    setVotingId(suggestionId + vote);
    const result = await voteOnSuggestion({ suggestionId, memberId: currentMemberId, vote });
    setVotingId(null);
    if (result.error) { toast.error(result.error); return; }
  }

  async function handleCloseVote(suggestionId: string) {
    setClosingId(suggestionId);
    const result = await closeSuggestionVote({ suggestionId });
    setClosingId(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Vote closed.");
  }

  // ── Empty states ──────────────────────────────────────────────────────────────
  if (days.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Itinerary
        </h2>
        <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-6 text-center space-y-3">
          {!destinationLocked ? (
            <p className="text-sm text-muted-foreground">
              Lock a destination first to generate the itinerary.
            </p>
          ) : isOrganizer ? (
            <>
              <p className="text-sm text-muted-foreground">
                Ready to plan. Generate the day-by-day itinerary.
              </p>
              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="gap-2 bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generating…" : "Generate itinerary"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Waiting for the organizer to generate the itinerary.
            </p>
          )}
        </div>
      </section>
    );
  }

  // ── Timeline ───────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Itinerary
          </h2>
          {isOrganizer && (
            <Button
              variant="ghost" size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-1 h-8 text-xs text-muted-foreground"
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              Regenerate
            </Button>
          )}
        </div>

        {days.map((day) => (
          <div key={day.id} className="space-y-3">
            {/* Day header */}
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-12 shrink-0">
                Day {day.day_number}
              </span>
              <p className="text-sm font-semibold text-foreground">{day.title}</p>
            </div>

            {/* Items */}
            <div className="ml-12 space-y-2 border-l border-[#E8E4DE] pl-4">
              {(itemsByDayId[day.id] ?? []).map((item) => {
                const Icon       = TYPE_ICON[item.item_type ?? "activity"] ?? Activity;
                const colorClass = TYPE_COLOR[item.item_type ?? "activity"] ?? TYPE_COLOR.activity;
                const itemSuggs  = (suggestionsByItemId[item.id] ?? []).filter(
                  (s) => s.status === "pending"
                );
                const pendingFreeform   = itemSuggs.filter((s) => !s.suggested_title);
                const pendingStructured = itemSuggs.filter((s) => !!s.suggested_title);

                return (
                  <div key={item.id} className="rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 space-y-3">
                    {/* Top: time + icon + title */}
                    <div className="flex items-start gap-3">
                      {item.time_slot && (
                        <div className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground pt-0.5">
                          <Clock className="h-3 w-3" />
                          <span className="tabular-nums">{item.time_slot}</span>
                        </div>
                      )}
                      <div className={cn("rounded-lg p-1.5 shrink-0", colorClass)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground leading-snug">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                        )}
                        {item.location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/70">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>{item.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Suggest swap button + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {currentMemberId && (
                        <button
                          onClick={() => openSwapDialog(item)}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MessageSquarePlus className="h-3 w-3" />
                          {isOrganizer ? "Propose swap" : "Suggest swap"}
                        </button>
                      )}
                      {pendingFreeform.length > 0 && (
                        <span className="text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">
                          {pendingFreeform.length} suggestion{pendingFreeform.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {pendingStructured.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-600 rounded-full px-2 py-0.5">
                          <VoteIcon className="h-3 w-3" />
                          Vote open
                        </span>
                      )}
                    </div>

                    {/* ── Organizer voting proposals (visible to all members) ── */}
                    {pendingStructured.map((s) => {
                      const votes     = votesBySuggId[s.id] ?? [];
                      const yesCount  = votes.filter((v) => v.vote === "yes").length;
                      const noCount   = votes.filter((v) => v.vote === "no").length;
                      const myVote    = votes.find((v) => v.member_id === currentMemberId)?.vote ?? null;
                      const isVotingY = votingId === s.id + "yes";
                      const isVotingN = votingId === s.id + "no";
                      const isClosing = closingId === s.id;

                      return (
                        <div key={s.id} className="rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">
                              Organizer proposes swap
                            </p>
                            {isOrganizer && (
                              <button
                                onClick={() => handleCloseVote(s.id)}
                                disabled={isClosing}
                                className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40 shrink-0 transition-colors"
                              >
                                {isClosing ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Close vote"}
                              </button>
                            )}
                          </div>

                          {/* Proposed values */}
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-foreground">{s.suggested_title}</p>
                            {s.suggested_description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{s.suggested_description}</p>
                            )}
                            {s.suggested_location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>{s.suggested_location}</span>
                              </div>
                            )}
                          </div>

                          {/* Vote counts + threshold */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="text-emerald-600 font-medium">✓ {yesCount} yes</span>
                            <span className="text-rose-500 font-medium">✗ {noCount} no</span>
                            <span className="text-muted-foreground/60">
                              {majority} needed to decide
                            </span>
                          </div>

                          {/* Vote buttons (all members) */}
                          {currentMemberId && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleVote(s.id, "yes")}
                                disabled={isVotingY || isVotingN}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 min-h-[36px]",
                                  myVote === "yes"
                                    ? "bg-emerald-500 text-white border-emerald-500"
                                    : "bg-white text-foreground border-[#E8E4DE] hover:border-emerald-300 hover:text-emerald-600"
                                )}
                              >
                                {isVotingY ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                                Yes
                              </button>
                              <button
                                onClick={() => handleVote(s.id, "no")}
                                disabled={isVotingY || isVotingN}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 min-h-[36px]",
                                  myVote === "no"
                                    ? "bg-rose-500 text-white border-rose-500"
                                    : "bg-white text-foreground border-[#E8E4DE] hover:border-rose-300 hover:text-rose-500"
                                )}
                              >
                                {isVotingN ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsDown className="h-3 w-3" />}
                                No
                              </button>
                              {myVote && (
                                <span className="text-[10px] text-muted-foreground self-center ml-1">
                                  You voted {myVote} · tap to change
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* ── Freeform member suggestions (organizer approve/reject) ── */}
                    {isOrganizer && pendingFreeform.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-[#F0EDE8]">
                        {pendingFreeform.map((s) => (
                          <div key={s.id} className="flex items-start gap-2">
                            <p className="text-xs text-foreground/70 flex-1 leading-relaxed">
                              &ldquo;{s.suggestion_text}&rdquo;
                            </p>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => handleReview(s.id, "approved")}
                                disabled={reviewingId === s.id}
                                className="p-1 text-emerald-500 hover:text-emerald-600 disabled:opacity-40 transition-colors"
                                title="Approve"
                              >
                                {reviewingId === s.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <CheckCircle className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => handleReview(s.id, "rejected")}
                                disabled={reviewingId === s.id}
                                className="p-1 text-rose-400 hover:text-rose-500 disabled:opacity-40 transition-colors"
                                title="Dismiss"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* ── Swap dialog ─────────────────────────────────────────────────────────── */}
      <Dialog open={!!swapItemId} onOpenChange={(open) => { if (!open) closeSwapDialog(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">
              {isOrganizer ? "Propose a swap" : "Suggest a swap"}
            </DialogTitle>
            {swapItem && (
              <p className="text-xs text-muted-foreground pt-1">
                Currently: <span className="font-medium text-foreground">{swapItem.title}</span>
              </p>
            )}
          </DialogHeader>

          {isOrganizer ? (
            /* Structured form — goes to member vote */
            <div className="space-y-3 py-1">
              <p className="text-xs text-muted-foreground bg-blue-50 rounded-lg px-3 py-2">
                Members will vote on this. Majority wins — ties keep the original.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="swap-title">New activity title</Label>
                <Input
                  id="swap-title"
                  placeholder="e.g. Cooking class at Le Cordon Bleu"
                  value={swapTitle}
                  onChange={(e) => setSwapTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="swap-desc">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="swap-desc"
                  placeholder="Brief description…"
                  value={swapDesc}
                  onChange={(e) => setSwapDesc(e.target.value)}
                  className="resize-none min-h-[64px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="swap-loc">
                  Location <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="swap-loc"
                  placeholder="e.g. Rue du Faubourg Saint-Honoré"
                  value={swapLocation}
                  onChange={(e) => setSwapLocation(e.target.value)}
                />
              </div>
            </div>
          ) : (
            /* Freeform — organizer approves/rejects */
            <div className="py-1">
              <Textarea
                placeholder="Describe what you'd swap this for…"
                value={swapText}
                onChange={(e) => setSwapText(e.target.value)}
                className="resize-none min-h-[80px]"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={handleSubmitSwap}
              disabled={submittingSwap}
              className="w-full min-h-[44px] bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
            >
              {submittingSwap
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : isOrganizer ? "Put to vote" : "Submit suggestion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
