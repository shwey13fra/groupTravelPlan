import { notFound }          from "next/navigation";
import { createClient }       from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { FileText, Link, StickyNote, ExternalLink } from "lucide-react";
import type { VaultItem, TripMember } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const TYPE_ICON  = { pdf: FileText, link: Link, note: StickyNote } as const;
const TYPE_COLOR = {
  pdf:  "text-rose-500  bg-rose-50",
  link: "text-blue-500  bg-blue-50",
  note: "text-amber-500 bg-amber-50",
} as const;

export default async function PublicVaultPage({
  params,
}: {
  params: { tripId: string };
}) {
  const supabase = await createClient();

  const [tripRes, membersRes, itemsRes] = await Promise.all([
    supabase
      .from("trips")
      .select("id, name, destination, vault_public")
      .eq("id", params.tripId)
      .maybeSingle(),
    supabase
      .from("trip_members")
      .select("id, name, emoji")
      .eq("trip_id", params.tripId),
    supabase
      .from("vault_items")
      .select("*")
      .eq("trip_id", params.tripId)
      .order("created_at", { ascending: false }),
  ]);

  // 404 if trip not found or vault is private
  if (!tripRes.data || !tripRes.data.vault_public) notFound();

  const trip      = tripRes.data;
  const members   = (membersRes.data ?? []) as Pick<TripMember, "id" | "name" | "emoji">[];
  const items     = (itemsRes.data ?? []) as VaultItem[];
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Dark hero */}
      <div className="bg-gradient-to-b from-[#1C2B4A] to-[#243558] px-6 pt-12 pb-8">
        <div className="mx-auto max-w-2xl space-y-1">
          <p className="text-white/40 text-xs uppercase tracking-[0.2em] font-medium">
            Shared vault
          </p>
          <h1 className="font-display text-5xl text-[#FAF8F5] leading-tight">
            {trip.name}
          </h1>
          {trip.destination && (
            <p className="text-white/60 text-base">{trip.destination}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-12 text-center space-y-1.5">
            <p className="text-3xl">🗄️</p>
            <p className="text-sm text-foreground/70">Nothing in the vault yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => {
              const uploader = item.uploaded_by ? memberById[item.uploaded_by] : null;
              const Icon     = TYPE_ICON[item.item_type ?? "note"];
              const colorCls = TYPE_COLOR[item.item_type ?? "note"];
              const timeAgo  = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });

              return (
                <div
                  key={item.id}
                  className="flex flex-col rounded-xl border border-[#E8E4DE] bg-white px-4 py-3.5 shadow-sm"
                >
                  {/* Icon + title */}
                  <div className="flex items-start gap-3">
                    <span className={cn("mt-0.5 p-1.5 rounded-lg shrink-0", colorCls)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground leading-tight line-clamp-2">
                        {item.title}
                      </p>
                      {item.item_type === "link" && item.link_url && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {(() => { try { return new URL(item.link_url).hostname; } catch { return item.link_url; } })()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Note text inline */}
                  {item.item_type === "note" && item.notes && (
                    <p className="mt-2.5 text-xs text-foreground/70 line-clamp-3 leading-relaxed">
                      {item.notes}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#F0ECE6]">
                    <p className="text-[11px] text-muted-foreground truncate mr-2">
                      {uploader ? `${uploader.emoji} ${uploader.name}` : "Unknown"} · {timeAgo}
                    </p>
                    {item.item_type === "pdf" && item.file_url && (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-[#1C2B4A] hover:underline flex items-center gap-1 shrink-0">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {item.item_type === "link" && item.link_url && (
                      <a href={item.link_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-[#1C2B4A] hover:underline flex items-center gap-1 shrink-0">
                        Visit <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
