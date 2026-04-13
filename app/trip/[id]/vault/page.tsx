import { notFound }            from "next/navigation";
import { createClient }         from "@/lib/supabase/server";
import { getCurrentMemberId }   from "@/lib/server/current-member";
import VaultSection             from "@/components/trip/VaultSection";
import type { VaultItem }       from "@/lib/types/database";

export default async function VaultPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [tripRes, membersRes, itemsRes, currentMemberId] = await Promise.all([
    supabase
      .from("trips")
      .select("vault_public")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("vault_items")
      .select("*")
      .eq("trip_id", params.id)
      .order("created_at", { ascending: false }),
    getCurrentMemberId(params.id),
  ]);

  if (!tripRes.data) notFound();

  const members       = membersRes.data ?? [];
  const items         = (itemsRes.data ?? []) as VaultItem[];
  const currentMember = members.find((m) => m.id === currentMemberId) ?? null;
  const isOrganizer   = currentMember?.is_organizer ?? false;

  return (
    <VaultSection
      tripId={params.id}
      currentMemberId={currentMemberId}
      members={members}
      isOrganizer={isOrganizer}
      initialItems={items}
      initialVaultPublic={tripRes.data.vault_public ?? false}
    />
  );
}
