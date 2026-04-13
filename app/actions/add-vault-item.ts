"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId:     z.string().uuid(),
  title:      z.string().min(1, "Title required").max(120),
  uploadedBy: z.string().uuid().nullable().optional(),
  itemType:   z.enum(["pdf", "link", "note"]),
  fileUrl:    z.string().url().optional(),
  linkUrl:    z.string().url("Invalid URL — must start with https://").optional(),
  notes:      z.string().min(1).optional(),
});

export async function addVaultItem(
  input: unknown,
): Promise<{ itemId: string } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { tripId, title, uploadedBy, itemType, fileUrl, linkUrl, notes } = parsed.data;

  if (itemType === "pdf"  && !fileUrl) return { error: "File URL required for PDF" };
  if (itemType === "link" && !linkUrl) return { error: "URL required for link" };
  if (itemType === "note" && !notes)   return { error: "Note content required" };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vault_items")
    .insert({
      trip_id:     tripId,
      title,
      item_type:   itemType,
      file_url:    fileUrl    ?? null,
      link_url:    linkUrl    ?? null,
      notes:       notes      ?? null,
      uploaded_by: uploadedBy ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Failed to add item" };
  return { itemId: data.id };
}
