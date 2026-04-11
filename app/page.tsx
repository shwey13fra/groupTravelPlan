import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlightAnimation } from "@/components/trip/FlightAnimation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: { user } }, cookieStore] = await Promise.all([
    supabase.auth.getUser(),
    cookies(),
  ]);

  // Last trip cookie fallback (for non-auth joiners)
  const lastTripId = !user ? (cookieStore.get("last_trip_id")?.value ?? null) : null;

  let lastTripName: string | null = null;
  if (lastTripId) {
    const { data } = await supabase
      .from("trips")
      .select("name")
      .eq("id", lastTripId)
      .maybeSingle();
    lastTripName = data?.name ?? null;
  }

  return (
    <main className="relative min-h-screen bg-[#1C2B4A] flex flex-col items-center justify-center px-6 overflow-hidden">
      <FlightAnimation />

      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm">
        <p className="text-white/40 text-xs uppercase tracking-[0.25em] font-medium">
          Group travel, simplified
        </p>
        <h1 className="font-display text-7xl sm:text-8xl text-[#FAF8F5] tracking-tight leading-none">
          TripSync
        </h1>
        <p className="text-white/50 text-base leading-relaxed">
          Plan trips together, without the chaos
        </p>

        <div className="flex flex-col gap-3 w-full mt-2">
          {/* Authenticated organizer */}
          {user && (
            <Button
              asChild
              size="lg"
              className="w-full min-h-[44px] bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 transition-all duration-200"
            >
              <Link href="/my-trips">
                My trips
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          )}

          {/* Non-auth joiner with last trip cookie */}
          {!user && lastTripId && lastTripName && (
            <Button
              asChild
              size="lg"
              className="w-full min-h-[44px] bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2 transition-all duration-200"
            >
              <Link href={`/trip/${lastTripId}`}>
                Continue planning
                <span className="font-display text-lg leading-none mx-1">{lastTripName}</span>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          )}

          <Button
            asChild
            size="lg"
            className="w-full min-h-[44px] bg-amber-500 hover:bg-amber-400 text-white border-0 shadow-lg shadow-amber-900/30 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Link href="/create">Create a trip</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
