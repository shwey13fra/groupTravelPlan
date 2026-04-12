import { notFound }             from "next/navigation";
import { createClient }          from "@/lib/supabase/server";
import { getCurrentMemberId }    from "@/lib/server/current-member";
import ExpenseSection            from "@/components/trip/ExpenseSection";
import type { Expense, ExpenseSplit } from "@/lib/types/database";

export default async function ExpensesPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [tripRes, membersRes, expensesRes, currentMemberId] = await Promise.all([
    supabase.from("trips").select("currency").eq("id", params.id).maybeSingle(),
    supabase.from("trip_members").select("*").eq("trip_id", params.id).order("created_at", { ascending: true }),
    supabase.from("expenses").select("*").eq("trip_id", params.id).order("created_at", { ascending: false }),
    getCurrentMemberId(params.id),
  ]);

  if (!tripRes.data) notFound();

  const members  = membersRes.data  ?? [];
  const expenses = (expensesRes.data ?? []) as Expense[];
  const currency = tripRes.data.currency ?? "USD";

  // Fetch all splits for these expenses in one query
  let splits: ExpenseSplit[] = [];
  if (expenses.length > 0) {
    const expenseIds = expenses.map((e) => e.id);
    const { data: splitRows } = await supabase
      .from("expense_splits")
      .select("*")
      .in("expense_id", expenseIds);
    splits = (splitRows ?? []) as ExpenseSplit[];
  }

  return (
    <ExpenseSection
      tripId={params.id}
      currency={currency}
      currentMemberId={currentMemberId}
      members={members}
      initialExpenses={expenses}
      initialSplits={splits}
    />
  );
}
