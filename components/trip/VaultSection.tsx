"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Plus, FileText, Link, StickyNote, ExternalLink, Loader2, Copy } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient }       from "@/lib/supabase/client";
import { addVaultItem }       from "@/app/actions/add-vault-item";
import { toggleVaultPublic }  from "@/app/actions/toggle-vault-public";
import type { VaultItem, TripMember } from "@/lib/types/database";
import { cn } from "@/lib/utils";

// ── Icon + colour per type ────────────────────────────────────────────────────
const TYPE_ICON  = { pdf: FileText, link: Link, note: StickyNote } as const;
const TYPE_COLOR = {
  pdf:  "text-rose-500  bg-rose-50",
  link: "text-blue-500  bg-blue-50",
  note: "text-amber-500 bg-amber-50",
} as const;

type DialogTab = "pdf" | "link" | "note";

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  tripId:             string;
  currentMemberId:    string | null;
  members:            TripMember[];
  isOrganizer:        boolean;
  initialItems:       VaultItem[];
  initialVaultPublic: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function VaultSection({
  tripId, currentMemberId, members, isOrganizer, initialItems, initialVaultPublic,
}: Props) {
  const [items,      setItems]      = useState<VaultItem[]>(initialItems);
  const [isOpen,     setIsOpen]     = useState(false);
  const [tab,        setTab]        = useState<DialogTab>("pdf");
  const [isAdding,   setIsAdding]   = useState(false);
  const [isPublic,   setIsPublic]   = useState(initialVaultPublic);
  const [isToggling, setIsToggling] = useState(false);

  // Per-tab form state — reset on open
  const [pdf,  setPdf]  = useState({ title: "", file: null as File | null });
  const [link, setLink] = useState({ title: "", url: "" });
  const [note, setNote] = useState({ title: "", text: "" });

  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient();
    const sub = sb
      .channel(`vault:${tripId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "vault_items",
        filter: `trip_id=eq.${tripId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT")
          setItems((prev) => [payload.new as VaultItem, ...prev]);
        else if (payload.eventType === "DELETE")
          setItems((prev) => prev.filter((i) => i.id !== (payload.old as { id: string }).id));
      })
      .subscribe();
    return () => { sb.removeChannel(sub); };
  }, [tripId]);

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openDialog() {
    setPdf({ title: "", file: null });
    setLink({ title: "", url: "" });
    setNote({ title: "", text: "" });
    setTab("pdf");
    setIsOpen(true);
  }

  async function handleAdd() {
    if (isAdding) return;
    setIsAdding(true);
    try {
      if (tab === "pdf") {
        if (!pdf.title.trim())  { toast.error("Enter a title"); return; }
        if (!pdf.file)          { toast.error("Select a PDF file"); return; }
        if (pdf.file.size > 5 * 1024 * 1024)          { toast.error("File must be under 5 MB"); return; }
        if (pdf.file.type !== "application/pdf")        { toast.error("Only PDF files allowed"); return; }

        const sb         = createClient();
        const safeName   = pdf.file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
        const path       = `${tripId}/${Date.now()}-${safeName}`;
        const { error: uploadErr } = await sb.storage
          .from("trip-vault")
          .upload(path, pdf.file, { contentType: "application/pdf" });
        if (uploadErr) { toast.error("Upload failed — try again"); return; }

        const { data: { publicUrl } } = sb.storage.from("trip-vault").getPublicUrl(path);
        const res = await addVaultItem({
          tripId, title: pdf.title.trim(),
          uploadedBy: currentMemberId, itemType: "pdf", fileUrl: publicUrl,
        });
        if ("error" in res) { toast.error(res.error); return; }

      } else if (tab === "link") {
        if (!link.title.trim()) { toast.error("Enter a title"); return; }
        if (!link.url.trim())   { toast.error("Enter a URL"); return; }
        const normalized = link.url.startsWith("http") ? link.url : `https://${link.url}`;
        const res = await addVaultItem({
          tripId, title: link.title.trim(),
          uploadedBy: currentMemberId, itemType: "link", linkUrl: normalized,
        });
        if ("error" in res) { toast.error(res.error); return; }

      } else {
        if (!note.title.trim()) { toast.error("Enter a title"); return; }
        if (!note.text.trim())  { toast.error("Enter note content"); return; }
        const res = await addVaultItem({
          tripId, title: note.title.trim(),
          uploadedBy: currentMemberId, itemType: "note", notes: note.text.trim(),
        });
        if ("error" in res) { toast.error(res.error); return; }
      }

      toast.success("Added to vault");
      setIsOpen(false);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleTogglePublic() {
    if (!isOrganizer || isToggling) return;
    const next = !isPublic;
    setIsToggling(true);
    try {
      const res = await toggleVaultPublic({ tripId, isPublic: next });
      if ("error" in res) { toast.error(res.error); return; }
      setIsPublic(next);
      toast.success(next ? "Vault is now public" : "Vault is now private");
    } finally {
      setIsToggling(false);
    }
  }

  function copyVaultLink() {
    const url = `${window.location.origin}/vault/${tripId}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Vault link copied"));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Trip Vault
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length === 0
              ? "No items yet"
              : `${items.length} item${items.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          onClick={openDialog}
          className="gap-1.5 bg-[#1C2B4A] hover:bg-[#243558] text-white border-0 text-sm shrink-0"
          size="sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Add to vault
        </Button>
      </div>

      {/* Public toggle — organizer only */}
      {isOrganizer && (
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl border border-[#E8E4DE] bg-white">
          <button
            onClick={handleTogglePublic}
            disabled={isToggling}
            aria-label={isPublic ? "Make vault private" : "Make vault public"}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none",
              isPublic ? "bg-[#1C2B4A]" : "bg-[#D5D0C8]",
              isToggling && "opacity-60 cursor-not-allowed",
            )}
          >
            <span className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
              isPublic ? "translate-x-[18px]" : "translate-x-0.5",
            )} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground leading-none">
              {isPublic ? "Vault is public" : "Vault is private"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPublic ? "Anyone with the link can view" : "Only trip members can view"}
            </p>
          </div>
          {isPublic && (
            <Button
              size="sm"
              variant="outline"
              onClick={copyVaultLink}
              className="gap-1.5 shrink-0 text-xs border-[#E8E4DE] hover:border-[#1C2B4A]/30"
            >
              <Copy className="h-3 w-3" />
              Copy link
            </Button>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-12 text-center space-y-1.5">
          <p className="text-3xl">🗄️</p>
          <p className="text-sm text-foreground/70">Nothing in the vault yet.</p>
          <p className="text-xs text-muted-foreground">Add PDFs, links, or notes for the group.</p>
        </div>
      ) : (
        // Card grid
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const uploader  = item.uploaded_by ? memberById[item.uploaded_by] : null;
            const Icon      = TYPE_ICON[item.item_type ?? "note"];
            const colorCls  = TYPE_COLOR[item.item_type ?? "note"];
            const timeAgo   = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });

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

                {/* Note content inline */}
                {item.item_type === "note" && item.notes && (
                  <p className="mt-2.5 text-xs text-foreground/70 line-clamp-3 leading-relaxed">
                    {item.notes}
                  </p>
                )}

                {/* Footer: uploader + action */}
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

      {/* ── Add to vault dialog ───────────────────────────────────────────── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to vault</DialogTitle>
          </DialogHeader>

          {/* Tab switcher */}
          <div className="flex bg-[#F0ECE6] rounded-full p-1 gap-0.5">
            {(["pdf", "link", "note"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-1.5 rounded-full text-xs font-medium transition-all",
                  tab === t
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "pdf" ? "Upload PDF" : t === "link" ? "Add Link" : "Add Note"}
              </button>
            ))}
          </div>

          <div className="space-y-4 py-1">
            {/* PDF tab */}
            {tab === "pdf" && (
              <>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Hotel confirmation"
                    value={pdf.title}
                    onChange={(e) => setPdf((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>PDF file</Label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="block w-full text-sm text-muted-foreground
                      file:mr-3 file:rounded-lg file:border file:border-[#E8E4DE]
                      file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium
                      file:text-foreground hover:file:bg-[#F4F1EC] cursor-pointer"
                    onChange={(e) => setPdf((f) => ({ ...f, file: e.target.files?.[0] ?? null }))}
                  />
                  <p className="text-[11px] text-muted-foreground">Max 5 MB · PDF only</p>
                </div>
              </>
            )}

            {/* Link tab */}
            {tab === "link" && (
              <>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Airbnb booking"
                    value={link.title}
                    onChange={(e) => setLink((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL</Label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => setLink((f) => ({ ...f, url: e.target.value }))}
                  />
                </div>
              </>
            )}

            {/* Note tab */}
            {tab === "note" && (
              <>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Packing checklist"
                    value={note.title}
                    onChange={(e) => setNote((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <Textarea
                    placeholder="Write anything the group needs to know..."
                    rows={4}
                    value={note.text}
                    onChange={(e) => setNote((f) => ({ ...f, text: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={isAdding}
              className="bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
