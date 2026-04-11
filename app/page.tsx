import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <h1 className="font-display text-6xl sm:text-7xl text-foreground tracking-tight">
          TripSync
        </h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          Plan trips together, without the chaos
        </p>
        <Button asChild size="lg" className="mt-2 w-full sm:w-auto min-h-[44px]">
          <Link href="/create">Create a trip</Link>
        </Button>
      </div>
    </main>
  );
}
