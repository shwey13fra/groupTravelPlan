"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId:     z.string().uuid(),
  creditorId: z.string().uuid(), // the member who is owed money
  debtorId:   z.string().uuid(), // the member who owes money
});

export async function settleBetween(
  input: unknown,
): Promise<{ ok: true } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { tripId, creditorId, debtorId } = parsed.data;
  const supabase = await createClient();

  // Get all expense IDs paid by each party in this trip
  const [{ data: creditorExpenses }, { data: debtorExpenses }] = await Promise.all([
    supabase.from("expenses").select("id").eq("trip_id", tripId).eq("paid_by", creditorId),
    supabase.from("expenses").select("id").eq("trip_id", tripId).eq("paid_by", debtorId),
  ]);

  const creditorIds = (creditorExpenses ?? []).map((e) => e.id);
  const debtorIds   = (debtorExpenses   ?? []).map((e) => e.id);

  // Settle debtor's splits in creditor's expenses  (debtor owes creditor)
  if (creditorIds.length > 0) {
    await supabase
      .from("expense_splits")
      .update({ settled: true })
      .in("expense_id", creditorIds)
      .eq("member_id", debtorId)
      .eq("settled", false);
  }

  // Settle creditor's splits in debtor's expenses  (creditor owes debtor — netted)
  if (debtorIds.length > 0) {
    await supabase
      .from("expense_splits")
      .update({ settled: true })
      .in("expense_id", debtorIds)
      .eq("member_id", creditorId)
      .eq("settled", false);
  }

  return { ok: true };
}
