import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import JoinForm from "@/components/trip/JoinForm";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params:       { code: string };
  searchParams: { new?: string };
}) {
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("id, name, join_code")
    .eq("join_code", params.code.toUpperCase())
    .maybeSingle();

  if (!trip) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-3xl">🔍</p>
          <h1 className="font-display text-4xl text-foreground">Trip not found.</h1>
          <p className="text-sm text-muted-foreground">
            Double-check the invite link and try again.
          </p>
        </div>
      </main>
    );
  }

  const cookieStore      = await cookies();
  const existingMemberId = cookieStore.get(`tmid_${trip.id}`)?.value;
  const forceNew         = searchParams.new === "1";

  // ── Already identified — show "continue" or "switch" ──────────────────
  if (existingMemberId && !forceNew) {
    const { data: member } = await supabase
      .from("trip_members")
      .select("name, emoji")
      .eq("id", existingMemberId)
      .maybeSingle();

    return (
      <main className="min-h-screen bg-[#FAF8F5]">
        <div className="bg-gradient-to-b from-[#1C2B4A] to-[#243558] px-6 pt-14 pb-10 text-center">
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-medium mb-3">
            Welcome back
          </p>
          <h1 className="font-display text-5xl sm:text-6xl text-[#FAF8F5] leading-tight">
            {trip.name}
          </h1>
        </div>

        <div className="mx-auto max-w-sm px-6 py-8 space-y-4">
          {member && (
            <div className="flex items-center gap-3 rounded-xl border border-[#E8E4DE] bg-white px-4 py-3 shadow-sm">
              <span className="text-2xl">{member.emoji}</span>
              <div>
                <p className="text-xs text-muted-foreground">You&apos;re in as</p>
                <p className="font-semibold text-foreground">{member.name}</p>
              </div>
            </div>
          )}

          <Button
            asChild
            className="w-full min-h-[44px] bg-[#1C2B4A] hover:bg-[#243558] text-white border-0 gap-2"
          >
            <Link href={`/trip/${trip.id}`}>
              Go to dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Not you?{" "}
            <Link
              href={`/join/${trip.join_code}?new=1`}
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Join as someone else
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // ── No cookie (or forced new) — show the join form ────────────────────
  const { count } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const memberCount = count ?? 0;

  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      <div className="bg-gradient-to-b from-[#1C2B4A] to-[#243558] px-6 pt-14 pb-10 text-center">
        <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-medium mb-3">
          You&apos;re invited
        </p>
        <h1 className="font-display text-5xl sm:text-6xl text-[#FAF8F5] leading-tight">
          {trip.name}
        </h1>
        <p className="text-white/45 text-sm mt-2">
          {memberCount} {memberCount === 1 ? "person" : "people"} already in
        </p>
      </div>

      <div className="mx-auto max-w-sm px-6 py-8 space-y-4">
        <p className="text-xs text-muted-foreground text-center">
          Already a member? Enter your name exactly as you used before.
        </p>
        <JoinForm tripId={trip.id} />
      </div>
    </main>
  );
}
