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
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <p className="text-3xl">🔍</p>
          <h1 className="text-xl font-semibold text-foreground">
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
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <p className="text-4xl">✈️</p>
          <h1 className="font-display text-4xl text-foreground leading-tight">
            {trip.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {memberCount} {memberCount === 1 ? "person" : "people"} already in
          </p>
        </div>
        <JoinForm tripId={trip.id} />
      </div>
    </main>
  );
}
