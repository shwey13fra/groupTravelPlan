"use client";

import { useState, useEffect } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient }  from "@/lib/supabase/client";
import { refreshNudge }  from "@/app/actions/refresh-nudge";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types/database";

interface Props {
  tripId:       string;
  initialNudge: string | null;
}

const FALLBACK = "Share the invite link above to get everyone in.";

export default function NudgeBanner({ tripId, initialNudge }: Props) {
  const router                = useRouter();
  const [nudge,   setNudge]   = useState(initialNudge);
  const [loading, setLoading] = useState(false);

  // ── Realtime: watch trips.ai_nudge for updates from background triggers ──
  useEffect(() => {
    const sb  = createClient();
    const sub = sb
      .channel(`trip-nudge:${tripId}`)
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "trips",
        filter: `id=eq.${tripId}`,
      }, (payload) => {
        const updated = (payload.new as Partial<Trip>).ai_nudge;
        if (updated && updated !== nudge) setNudge(updated);
      })
      .subscribe();
    return () => { sb.removeChannel(sub); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function handleRefresh() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await refreshNudge(tripId);
      if (res?.rateLimited) {
        toast.info("Please wait 60 seconds between refreshes");
      } else {
        // Realtime will update the text; also hard-refresh for full consistency
        router.refresh();
      }
    } catch {
      toast.error("Could not refresh — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-xl bg-amber-50 border border-amber-100 px-4 py-3.5">
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600">
            Trip guide
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh suggestion"
          className={cn(
            "flex items-center gap-1 text-[11px] text-amber-500 hover:text-amber-700 transition-colors",
            loading && "opacity-50 cursor-not-allowed",
          )}
        >
          <RotateCcw className={cn("h-3 w-3", loading && "animate-spin")} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Nudge text */}
      <p className="text-sm text-foreground/80 leading-relaxed">
        {nudge ?? FALLBACK}
      </p>
    </div>
  );
}
