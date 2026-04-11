"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Lock, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { suggestDestinations } from "@/app/actions/suggest-destinations";
import { voteDestination }      from "@/app/actions/vote-destination";
import { addMemberSuggestion }  from "@/app/actions/add-member-suggestion";
import { lockDestination }      from "@/app/actions/lock-destination";
import type { DestinationSuggestion, DestinationVote } from "@/lib/types/database";

interface Props {
  tripId:             string;
  currentMemberId:    string | null;
  isOrganizer:        boolean;
  destinationLocked:  boolean;
  lockedDestination:  string | null;
  initialSuggestions: DestinationSuggestion[];
  initialVotes:       DestinationVote[];
}

export default function DestinationVoting({
  tripId,
  currentMemberId,
  isOrganizer,
  destinationLocked,
  lockedDestination,
  initialSuggestions,
  initialVotes,
}: Props) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>(initialSuggestions);
  const [votes,       setVotes]       = useState<DestinationVote[]>(initialVotes);
  const [generating,  setGenerating]  = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestName, setSuggestName] = useState("");
  const [suggestWhy,  setSuggestWhy]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [lockingId,   setLockingId]   = useState<string | null>(null);
  const [votingId,    setVotingId]    = useState<string | null>(null);

  // ── Realtime subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    const client = createClient();

    async function refetchSuggestions() {
      const { data } = await client
        .from("destination_suggestions")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (data) setSuggestions(data as DestinationSuggestion[]);
    }

    async function refetchVotes() {
      const { data } = await client
        .from("destination_votes")
        .select("*")
        .eq("trip_id", tripId);
      if (data) setVotes(data as DestinationVote[]);
    }

    const channel = client
      .channel(`trip-destinations-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "destination_suggestions", filter: `trip_id=eq.${tripId}` },
        refetchSuggestions
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "destination_votes", filter: `trip_id=eq.${tripId}` },
        refetchVotes
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [tripId]);

  // ── Computed ────────────────────────────────────────────────────────────
  const voteCountById = votes.reduce<Record<string, number>>((acc, v) => {
    acc[v.suggestion_id] = (acc[v.suggestion_id] ?? 0) + 1;
    return acc;
  }, {});

  const myVotedId = votes.find((v) => v.member_id === currentMemberId)?.suggestion_id ?? null;

  const highestVotedId = suggestions.reduce<string | null>((best, s) => {
    const count    = voteCountById[s.id]    ?? 0;
    const bestCount = best ? (voteCountById[best] ?? 0) : -1;
    return count > bestCount ? s.id : best;
  }, null);

  // ── Handlers ────────────────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true);
    const result = await suggestDestinations(tripId);
    setGenerating(false);
    if (result.rateLimited) {
      toast.warning("Please wait a moment before regenerating.");
      return;
    }
    if (result.error) { toast.error(result.error); return; }
    // Realtime will push the new suggestions — no manual refresh needed
  }

  async function handleVote(suggestionId: string) {
    if (!currentMemberId) { toast.error("Join the trip to vote."); return; }
    setVotingId(suggestionId);
    const result = await voteDestination({ tripId, memberId: currentMemberId, suggestionId });
    setVotingId(null);
    if (result.error) toast.error(result.error);
    // Realtime updates vote counts
  }

  async function handleAddSuggestion() {
    if (!currentMemberId) { toast.error("Join the trip to suggest."); return; }
    if (!suggestName.trim()) { toast.error("Destination name is required."); return; }
    setSubmitting(true);
    const result = await addMemberSuggestion({
      tripId,
      memberId:  currentMemberId,
      name:      suggestName.trim(),
      reason:    suggestWhy.trim() || undefined,
    });
    setSubmitting(false);
    if (result.error) { toast.error(result.error); return; }
    setSuggestName("");
    setSuggestWhy("");
    setSuggestOpen(false);
    // Realtime will push the new suggestion
  }

  async function handleLock(suggestionId: string, name: string) {
    setLockingId(suggestionId);
    const result = await lockDestination({ tripId, destination: name });
    setLockingId(null);
    if (result.error) { toast.error(result.error); return; }
    router.refresh(); // re-render server component to reflect locked state
  }

  // ── Locked state ────────────────────────────────────────────────────────
  if (destinationLocked && lockedDestination) {
    return (
      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Destination
        </h2>
        <div className="flex items-center gap-3 py-3 border-b border-[#E8E4DE]">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">{lockedDestination}</p>
            <p className="text-xs text-muted-foreground">Destination locked</p>
          </div>
        </div>
      </section>
    );
  }

  // ── No suggestions yet ──────────────────────────────────────────────────
  if (suggestions.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Destinations
        </h2>
        <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {isOrganizer
              ? "Generate AI suggestions or add your own."
              : "Waiting for the organizer to generate destination ideas."}
          </p>
          {isOrganizer && (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
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
                {generating ? "Thinking…" : "Generate AI suggestions"}
              </Button>
              {currentMemberId && (
                <Button variant="outline" onClick={() => setSuggestOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Suggest one
                </Button>
              )}
            </div>
          )}
        </div>
        <SuggestDialog
          open={suggestOpen}
          onOpenChange={setSuggestOpen}
          name={suggestName}
          why={suggestWhy}
          onNameChange={setSuggestName}
          onWhyChange={setSuggestWhy}
          onSubmit={handleAddSuggestion}
          submitting={submitting}
        />
      </section>
    );
  }

  // ── Suggestions exist ───────────────────────────────────────────────────
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Destinations
        </h2>
        <div className="flex gap-2">
          {currentMemberId && !destinationLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuggestOpen(true)}
              className="gap-1 h-8 text-xs"
            >
              <Plus className="h-3 w-3" />
              Suggest another
            </Button>
          )}
          {isOrganizer && !destinationLocked && (
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
      </div>

      <div className="space-y-2">
        {suggestions.map((s) => {
          const count    = voteCountById[s.id] ?? 0;
          const isMyVote = myVotedId === s.id;
          const isTop    = s.id === highestVotedId && count > 0;
          const isVoting = votingId === s.id;
          const isLocking = lockingId === s.id;

          return (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-white px-4 py-3 space-y-2 transition-colors",
                isMyVote
                  ? "border-[#1C2B4A]/25 bg-[#1C2B4A]/[0.03]"
                  : "border-[#E8E4DE]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-foreground truncate">{s.name}</p>
                    {s.suggested_by_ai && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 rounded-full px-1.5 py-0.5 font-medium shrink-0">
                        AI
                      </span>
                    )}
                  </div>
                  {s.reason && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {count === 1 ? "vote" : "votes"}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                {currentMemberId && !destinationLocked && (
                  <Button
                    size="sm"
                    variant={isMyVote ? "default" : "outline"}
                    onClick={() => handleVote(s.id)}
                    disabled={isVoting || isMyVote}
                    className={cn(
                      "h-8 text-xs gap-1.5",
                      isMyVote && "bg-[#1C2B4A] text-white hover:bg-[#243558] border-0"
                    )}
                  >
                    {isVoting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isMyVote ? (
                      "Voted ✓"
                    ) : (
                      "Vote"
                    )}
                  </Button>
                )}
                {isOrganizer && isTop && !destinationLocked && (
                  <Button
                    size="sm"
                    onClick={() => handleLock(s.id, s.name)}
                    disabled={isLocking}
                    className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-400 text-white border-0"
                  >
                    {isLocking ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Lock className="h-3 w-3" />
                        Lock destination
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <SuggestDialog
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        name={suggestName}
        why={suggestWhy}
        onNameChange={setSuggestName}
        onWhyChange={setSuggestWhy}
        onSubmit={handleAddSuggestion}
        submitting={submitting}
      />
    </section>
  );
}

// ── Suggest dialog (extracted to avoid duplication) ──────────────────────────

interface SuggestDialogProps {
  open:         boolean;
  onOpenChange: (v: boolean) => void;
  name:         string;
  why:          string;
  onNameChange: (v: string) => void;
  onWhyChange:  (v: string) => void;
  onSubmit:     () => void;
  submitting:   boolean;
}

function SuggestDialog({
  open, onOpenChange, name, why, onNameChange, onWhyChange, onSubmit, submitting,
}: SuggestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">Suggest a destination</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="sug-name">Destination</Label>
            <Input
              id="sug-name"
              placeholder="e.g. Lisbon, Portugal"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sug-why">Why? <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="sug-why"
              placeholder="e.g. Perfect weather in June"
              value={why}
              onChange={(e) => onWhyChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={onSubmit}
            disabled={submitting}
            className="w-full min-h-[44px] bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add suggestion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
