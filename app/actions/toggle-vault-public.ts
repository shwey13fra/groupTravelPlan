"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId:   z.string().uuid(),
  isPublic: z.boolean(),
});

export async function toggleVaultPublic(
  input: unknown,
): Promise<{ success: true } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { tripId, isPublic } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("trips")
    .update({ vault_public: isPublic })
    .eq("id", tripId);

  if (error) return { error: "Failed to update vault visibility" };
  return { success: true };
}
