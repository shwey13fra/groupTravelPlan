"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const splitSchema = z.object({
  memberId: z.string().uuid(),
  amount:   z.number().positive(),
});

const schema = z
  .object({
    tripId:    z.string().uuid(),
    title:     z.string().min(1, "Title required").max(80),
    amount:    z.number().positive("Amount must be positive"),
    paidBy:    z.string().uuid(),
    splitType: z.enum(["equal", "custom"]),
    splits:    z.array(splitSchema).optional(),
  });

export async function addExpense(
  input: unknown,
): Promise<{ expenseId: string } | { error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { tripId, title, amount, paidBy, splitType, splits } = parsed.data;
  const supabase = await createClient();

  // Insert the expense row first
  const { data: expense, error: expenseErr } = await supabase
    .from("expenses")
    .insert({ trip_id: tripId, title, amount, paid_by: paidBy, split_type: splitType })
    .select("id")
    .single();

  if (expenseErr || !expense) return { error: "Failed to add expense" };

  // Build split rows (never include a self-split for the payer)
  let splitRows: { expense_id: string; member_id: string; amount_owed: number }[];

  if (splitType === "equal") {
    const { data: inMembers } = await supabase
      .from("trip_members")
      .select("id")
      .eq("trip_id", tripId)
      .eq("commitment_status", "in");

    const members = (inMembers ?? []).filter((m) => m.id !== paidBy);
    if (members.length === 0) {
      // Solo expense — no splits needed (payer owes no one)
      return { expenseId: expense.id };
    }
    // Per-person share based on total participants (including payer)
    const participantCount = members.length + 1; // +1 for the payer
    const perPerson = Math.round((amount / participantCount) * 100) / 100;
    splitRows = members.map((m) => ({
      expense_id: expense.id,
      member_id:  m.id,
      amount_owed: perPerson,
    }));
  } else {
    // Custom splits
    if (!splits || splits.length === 0) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: "Custom split amounts required" };
    }
    // Exclude payer self-split silently, then validate sum
    const nonSelfSplits = splits.filter((s) => s.memberId !== paidBy);
    const total = nonSelfSplits.reduce((sum, s) => sum + s.amount, 0);
    if (Math.abs(total - amount) > 0.02) {
      await supabase.from("expenses").delete().eq("id", expense.id);
      return { error: `Split amounts must equal total (${total.toFixed(2)} ≠ ${amount.toFixed(2)})` };
    }
    splitRows = nonSelfSplits.map((s) => ({
      expense_id:  expense.id,
      member_id:   s.memberId,
      amount_owed: s.amount,
    }));
  }

  const { error: splitsErr } = await supabase.from("expense_splits").insert(splitRows);
  if (splitsErr) {
    await supabase.from("expenses").delete().eq("id", expense.id);
    return { error: "Failed to save splits" };
  }

  return { expenseId: expense.id };
}
