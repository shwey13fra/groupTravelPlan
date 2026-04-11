import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlightAnimation } from "@/components/trip/FlightAnimation";

export default function Home() {
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
        <Button
          asChild
          size="lg"
          className="mt-2 w-full sm:w-auto min-h-[44px] bg-amber-500 hover:bg-amber-400 text-white border-0 shadow-lg shadow-amber-900/30 transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <Link href="/create">Create a trip</Link>
        </Button>
      </div>
    </main>
  );
}
