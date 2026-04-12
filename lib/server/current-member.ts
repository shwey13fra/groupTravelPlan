import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the current member ID for a trip.
 * Auth takes priority (organizer, cross-device); cookie is the fallback for joiners.
 */
export async function getCurrentMemberId(tripId: string): Promise<string | null> {
  const [supabase, cookieStore] = await Promise.all([
    createClient(),
    cookies(),
  ]);

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: authMember } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (authMember?.id) return authMember.id;
  }

  return cookieStore.get(`tmid_${tripId}`)?.value ?? null;
}
