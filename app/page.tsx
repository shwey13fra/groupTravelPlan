import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlightAnimation } from "@/components/trip/FlightAnimation";
import { createClient } from "@/lib/supabase/server";
import InfoButton from "@/components/InfoButton";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: { user } }, cookieStore] = await Promise.all([
    supabase.auth.getUser(),
    cookies(),
  ]);

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
    <main
      className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 30% 40%, #1e1b4b 0%, #0f172a 50%, #020617 100%)",
      }}
    >
      {/* Decorative ambient orbs */}
      <div className="animate-float-slow pointer-events-none absolute top-0 left-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-indigo-600/[0.18] blur-[130px]" />
      <div className="animate-float-slow-r pointer-events-none absolute bottom-0 right-0 h-[440px] w-[440px] translate-x-1/3 translate-y-1/3 rounded-full bg-cyan-500/[0.13] blur-[110px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(139,92,246,0.08)_0%,transparent_70%)]" />

      <FlightAnimation />
      <InfoButton />

      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-sm animate-fade-up">

        {/* Pill badge */}
        <div className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/55">
            Group travel, simplified
          </p>
        </div>

        {/* Hero headline — gradient text */}
        <h1 className="gradient-text-hero font-display text-7xl leading-none sm:text-8xl">
          TripSync
        </h1>

        <p className="max-w-[260px] text-base leading-relaxed text-white/45">
          Plan trips together, without the chaos
        </p>

        <div className="mt-1 flex w-full flex-col gap-3">
          {/* Authenticated organiser */}
          {user && (
            <Button
              asChild
              size="lg"
              className="w-full min-h-[44px] gap-2 border border-white/[0.12] bg-white/[0.07] text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.12]"
            >
              <Link href="/my-trips">
                My trips
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
          )}

          {/* Non-auth joiner with last trip cookie */}
          {!user && lastTripId && lastTripName && (
            <Button
              asChild
              size="lg"
              className="w-full min-h-[44px] gap-2 border border-white/[0.12] bg-white/[0.07] text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.12]"
            >
              <Link href={`/trip/${lastTripId}`}>
                Continue planning
                <span className="mx-1 font-display text-lg leading-none">
                  {lastTripName}
                </span>
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
          )}

          {/* Primary CTA */}
          <Button
            asChild
            size="lg"
            className="w-full min-h-[44px] border-0 bg-gradient-to-r from-amber-500 to-orange-500 font-medium text-white shadow-lg shadow-orange-950/40 transition-all duration-300 hover:from-amber-400 hover:to-orange-400 hover:scale-[1.02] hover:shadow-orange-950/60 active:scale-95"
          >
            <Link href="/create">Create a trip</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
