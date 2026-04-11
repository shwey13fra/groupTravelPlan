import { createClient } from "@/lib/supabase/server";
import JoinForm from "@/components/trip/JoinForm";

export default async function JoinPage({
  params,
}: {
  params: { code: string };
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
          <h1 className="font-display text-4xl text-foreground">
            Trip not found.
          </h1>
          <p className="text-sm text-muted-foreground">
            Double-check the invite link and try again.
          </p>
        </div>
      </main>
    );
  }

  const { count } = await supabase
    .from("trip_members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id);

  const memberCount = count ?? 0;

  return (
    <main className="min-h-screen bg-[#FAF8F5]">

      {/* Dark hero */}
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

      {/* Form */}
      <div className="mx-auto max-w-sm px-6 py-8">
        <JoinForm tripId={trip.id} />
      </div>

    </main>
  );
}
