import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FlightAnimation } from "@/components/trip/FlightAnimation";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-background flex flex-col items-center justify-center px-6 overflow-hidden">
      <FlightAnimation />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center max-w-sm">
        <h1 className="font-display text-6xl sm:text-7xl text-foreground tracking-tight">
          TripSync
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Plan trips together, without the chaos
        </p>
        <Button
          asChild
          size="lg"
          className="mt-2 w-full sm:w-auto min-h-[44px] transition-transform duration-200 hover:scale-110 active:scale-95"
        >
          <Link href="/create">Create a trip</Link>
        </Button>
      </div>
    </main>
  );
}
