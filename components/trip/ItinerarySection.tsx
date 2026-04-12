"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Loader2, Sparkles, Activity, UtensilsCrossed, Car, Coffee,
  MapPin, Clock, MessageSquarePlus, CheckCircle, XCircle,
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
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { generateItinerary }      from "@/app/actions/generate-itinerary";
import { suggestItemSwap }        from "@/app/actions/suggest-item-swap";
import { reviewItemSuggestion }   from "@/app/actions/review-item-suggestion";
import type { ItineraryDay, ItineraryItem, ItemSuggestion } from "@/lib/types/database";

// ── Icons by item type ────────────────────────────────────────────────────────
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
  tripId:              string;
  isOrganizer:         boolean;
  currentMemberId:     string | null;
  destinationLocked:   boolean;
  initialDays:         ItineraryDay[];
  initialItems:        ItineraryItem[];
  initialSuggestions:  ItemSuggestion[];
}

export default function ItinerarySection({
  tripId,
  isOrganizer,
  currentMemberId,
  destinationLocked,
  initialDays,
  initialItems,
  initialSuggestions,
}: Props) {
  const [days,        setDays]        = useState<ItineraryDay[]>(initialDays);
  const [items,       setItems]       = useState<ItineraryItem[]>(initialItems);
  const [suggestions, setSuggestions] = useState<ItemSuggestion[]>(initialSuggestions);
  const [generating,  setGenerating]  = useState(false);

  // Suggest-swap dialog
  const [swapItemId,     setSwapItemId]     = useState<string | null>(null);
  const [swapText,       setSwapText]       = useState("");
  const [submittingSwap, setSubmittingSwap] = useState(false);

  // Reviewing a suggestion
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Ref so realtime callback always sees current item IDs without re-subscribing
  const itemIdsRef = useRef<string[]>(initialItems.map((i) => i.id));
  useEffect(() => {
    itemIdsRef.current = items.map((i) => i.id);
  }, [items]);

  // ── Realtime ──────────────────────────────────────────────────────────────
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

    async function refetchSuggestions() {
      const ids = itemIdsRef.current;
      if (ids.length === 0) return;
      const { data } = await client
        .from("item_suggestions")
        .select("*")
        .in("item_id", ids);
      if (data) setSuggestions(data as ItemSuggestion[]);
    }

    const channel = client
      .channel(`trip-itinerary-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_days", filter: `trip_id=eq.${tripId}` },
        refetchDaysAndItems
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_items" },
        refetchDaysAndItems
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_suggestions" },
        refetchSuggestions
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [tripId]);

  // ── Derived maps ──────────────────────────────────────────────────────────
  const itemsByDayId = items.reduce<Record<string, ItineraryItem[]>>((acc, item) => {
    if (!acc[item.day_id]) acc[item.day_id] = [];
    acc[item.day_id].push(item);
    return acc;
  }, {});

  const suggestionsByItemId = suggestions.reduce<Record<string, ItemSuggestion[]>>((acc, s) => {
    if (!acc[s.item_id]) acc[s.item_id] = [];
    acc[s.item_id].push(s);
    return acc;
  }, {});

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true);
    const result = await generateItinerary(tripId);
    setGenerating(false);
    if (result.rateLimited) {
      toast.warning("Please wait a moment before regenerating.");
      return;
    }
    if (result.error) { toast.error(result.error); return; }
    // Realtime will push new days + items
  }

  async function handleSuggestSwap() {
    if (!swapItemId) return;
    if (!swapText.trim()) { toast.error("Please describe your suggestion."); return; }
    setSubmittingSwap(true);
    const result = await suggestItemSwap({
      itemId:         swapItemId,
      memberId:       currentMemberId ?? undefined,
      suggestionText: swapText.trim(),
    });
    setSubmittingSwap(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Suggestion submitted.");
    setSwapItemId(null);
    setSwapText("");
  }

  async function handleReview(suggestionId: string, status: "approved" | "rejected") {
    setReviewingId(suggestionId);
    const result = await reviewItemSuggestion({ suggestionId, status });
    setReviewingId(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success(status === "approved" ? "Suggestion approved." : "Suggestion dismissed.");
  }

  // ── Empty states ──────────────────────────────────────────────────────────
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
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
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

  // ── Timeline ──────────────────────────────────────────────────────────────
  return (
    <>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Itinerary
          </h2>
          {isOrganizer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-1 h-8 text-xs text-muted-foreground"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Regenerate
            </Button>
          )}
        </div>

        {days.map((day) => {
          const dayItems = itemsByDayId[day.id] ?? [];
          return (
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
                {dayItems.map((item) => {
                  const Icon        = TYPE_ICON[item.item_type ?? "activity"] ?? Activity;
                  const colorClass  = TYPE_COLOR[item.item_type ?? "activity"] ?? TYPE_COLOR.activity;
                  const itemSuggs   = suggestionsByItemId[item.id] ?? [];
                  const pendingCount = itemSuggs.filter((s) => s.status === "pending").length;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 space-y-2"
                    >
                      {/* Top row: time + icon + title */}
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
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {item.description}
                            </p>
                          )}
                          {item.location && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/70">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span>{item.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom row: suggest swap + badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {currentMemberId && (
                          <button
                            onClick={() => { setSwapItemId(item.id); setSwapText(""); }}
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <MessageSquarePlus className="h-3 w-3" />
                            Suggest swap
                          </button>
                        )}
                        {pendingCount > 0 && (
                          <span className="inline-flex items-center text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-2 py-0.5">
                            {pendingCount} suggestion{pendingCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Organizer: pending suggestions with approve/reject */}
                      {isOrganizer && itemSuggs.filter((s) => s.status === "pending").length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-[#F0EDE8]">
                          {itemSuggs
                            .filter((s) => s.status === "pending")
                            .map((s) => (
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
                                    {reviewingId === s.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
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
          );
        })}
      </section>

      {/* Suggest swap dialog */}
      <Dialog
        open={!!swapItemId}
        onOpenChange={(open) => { if (!open) setSwapItemId(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Suggest a swap</DialogTitle>
          </DialogHeader>
          <div className="py-1">
            <Textarea
              placeholder="Describe what you'd swap this for…"
              value={swapText}
              onChange={(e) => setSwapText(e.target.value)}
              className="resize-none min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSuggestSwap}
              disabled={submittingSwap}
              className="w-full min-h-[44px] bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
            >
              {submittingSwap ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit suggestion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
