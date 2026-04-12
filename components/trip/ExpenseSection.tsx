"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Button }  from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input }   from "@/components/ui/input";
import { Label }   from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient }  from "@/lib/supabase/client";
import { addExpense }    from "@/app/actions/add-expense";
import { settleBetween } from "@/app/actions/settle-between";
import type { Expense, ExpenseSplit, TripMember } from "@/lib/types/database";
import { cn } from "@/lib/utils";

// ── Currency symbol lookup ────────────────────────────────────────────────────
const SYM: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹",
  AED: "د.إ", SGD: "S$", AUD: "A$", JPY: "¥",
};

// ── Debt simplification (greedy, ~30 lines) ───────────────────────────────────
interface DebtTx { fromId: string; toId: string; amount: number }

function simplifyDebts(
  members: TripMember[],
  expenses: Expense[],
  splits: ExpenseSplit[],
): DebtTx[] {
  const payerOf: Record<string, string> = {};
  for (const e of expenses) payerOf[e.id] = e.paid_by;

  // Accumulate raw pairwise unsettled debts: raw[creditor][debtor] = amount
  const raw: Record<string, Record<string, number>> = {};
  for (const s of splits) {
    if (s.settled) continue;
    const creditor = payerOf[s.expense_id];
    if (!creditor || creditor === s.member_id) continue; // skip unknown / self-splits
    raw[creditor] = raw[creditor] ?? {};
    raw[creditor][s.member_id] = (raw[creditor][s.member_id] ?? 0) + Number(s.amount_owed);
  }

  // Net per member
  const net: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
  for (const [cId, debtors] of Object.entries(raw)) {
    for (const [dId, amt] of Object.entries(debtors)) {
      net[cId] = (net[cId] ?? 0) + amt;
      net[dId] = (net[dId] ?? 0) - amt;
    }
  }

  // Sort creditors / debtors descending by absolute amount
  const creditors = Object.entries(net).filter(([, n]) => n > 0.005)
    .map(([id, n]) => ({ id, amount: n })).sort((a, b) => b.amount - a.amount);
  const debtors   = Object.entries(net).filter(([, n]) => n < -0.005)
    .map(([id, n]) => ({ id, amount: -n })).sort((a, b) => b.amount - a.amount);

  const txns: DebtTx[] = [];
  let ci = 0, di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci], d = debtors[di];
    const transfer = Math.min(c.amount, d.amount);
    txns.push({ fromId: d.id, toId: c.id, amount: Math.round(transfer * 100) / 100 });
    c.amount -= transfer;
    d.amount -= transfer;
    if (c.amount < 0.005) ci++;
    if (d.amount < 0.005) di++;
  }
  return txns;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  tripId:          string;
  currency:        string;
  currentMemberId: string | null;
  members:         TripMember[];
  initialExpenses: Expense[];
  initialSplits:   ExpenseSplit[];
}

// ── Dialog default state ──────────────────────────────────────────────────────
const emptyDialog = {
  title:         "",
  amount:        "",
  paidBy:        "",
  splitType:     "equal" as "equal" | "custom",
  customAmounts: {} as Record<string, string>,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function ExpenseSection({
  tripId, currency, currentMemberId, members, initialExpenses, initialSplits,
}: Props) {
  const sym   = SYM[currency] ?? currency;
  const [tab,      setTab]      = useState<"expenses" | "balances">("expenses");
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [splits,   setSplits]   = useState<ExpenseSplit[]>(initialSplits);
  const [isOpen,   setIsOpen]   = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [settlingPair, setSettlingPair] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyDialog, paidBy: currentMemberId ?? members[0]?.id ?? "" });

  // Track expense IDs for realtime filtering on expense_splits
  const expenseIdsRef = useRef<Set<string>>(new Set(initialExpenses.map((e) => e.id)));
  useEffect(() => { expenseIdsRef.current = new Set(expenses.map((e) => e.id)); }, [expenses]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const sb = createClient();
    const expenseSub = sb
      .channel(`expenses:${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${tripId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const e = payload.new as Expense;
            setExpenses((prev) => [...prev, e]);
            expenseIdsRef.current.add(e.id);
          } else if (payload.eventType === "UPDATE") {
            setExpenses((prev) => prev.map((e) => e.id === (payload.new as Expense).id ? payload.new as Expense : e));
          } else if (payload.eventType === "DELETE") {
            const id = (payload.old as { id: string }).id;
            setExpenses((prev) => prev.filter((e) => e.id !== id));
            expenseIdsRef.current.delete(id);
          }
        })
      .subscribe();

    const splitSub = sb
      .channel(`expense_splits:${tripId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_splits" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const s = payload.new as ExpenseSplit;
            if (expenseIdsRef.current.has(s.expense_id))
              setSplits((prev) => [...prev, s]);
          } else if (payload.eventType === "UPDATE") {
            const s = payload.new as ExpenseSplit;
            if (expenseIdsRef.current.has(s.expense_id))
              setSplits((prev) => prev.map((x) => x.id === s.id ? s : x));
          }
        })
      .subscribe();

    return () => { sb.removeChannel(expenseSub); sb.removeChannel(splitSub); };
  }, [tripId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const inMembers   = members.filter((m) => m.commitment_status === "in");
  const memberById  = Object.fromEntries(members.map((m) => [m.id, m]));
  const debtTxns    = simplifyDebts(members, expenses, splits);
  const splitsByExpId = splits.reduce<Record<string, ExpenseSplit[]>>((acc, s) => {
    (acc[s.expense_id] = acc[s.expense_id] ?? []).push(s);
    return acc;
  }, {});

  // ── Dialog helpers ────────────────────────────────────────────────────────
  function openDialog() {
    setForm({ ...emptyDialog, paidBy: currentMemberId ?? members[0]?.id ?? "" });
    setIsOpen(true);
  }

  const parsedAmount   = parseFloat(form.amount) || 0;
  const participantCount = inMembers.length; // includes payer if payer is 'in'
  const perPerson      = participantCount > 1 ? parsedAmount / participantCount : parsedAmount;
  const customTotal = Object.values(form.customAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const customValid = Math.abs(customTotal - parsedAmount) <= 0.02;

  async function handleAddExpense() {
    if (!form.title.trim()) { toast.error("Enter a title"); return; }
    if (parsedAmount <= 0)  { toast.error("Enter a valid amount"); return; }
    if (form.splitType === "custom" && !customValid) {
      toast.error(`Split total must equal ${sym}${parsedAmount.toFixed(2)}`); return;
    }
    setIsAdding(true);
    try {
      const splitsPayload = form.splitType === "custom"
        ? Object.entries(form.customAmounts)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([memberId, v]) => ({ memberId, amount: parseFloat(v) }))
        : undefined;

      const result = await addExpense({
        tripId,
        title:     form.title.trim(),
        amount:    parsedAmount,
        paidBy:    form.paidBy,
        splitType: form.splitType,
        splits:    splitsPayload,
      });

      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Expense added");
      setIsOpen(false);
    } finally {
      setIsAdding(false);
    }
  }

  async function handleSettle(creditorId: string, debtorId: string) {
    const key = `${creditorId}:${debtorId}`;
    setSettlingPair(key);
    try {
      const result = await settleBetween({ tripId, creditorId, debtorId });
      if ("error" in result) { toast.error(result.error); return; }
      toast.success("Marked as settled");
    } finally {
      setSettlingPair(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Tab header + Add button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex bg-[#F0ECE6] rounded-full p-1 gap-0.5">
          {(["expenses", "balances"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize",
                tab === t ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "balances" && debtTxns.length > 0 && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold mr-1.5">
                  {debtTxns.length}
                </span>
              )}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <Button
          onClick={openDialog}
          className="gap-1.5 bg-[#1C2B4A] hover:bg-[#243558] text-white border-0 text-sm"
          size="sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Add expense
        </Button>
      </div>

      {/* ── Expenses tab ───────────────────────────────────────────────── */}
      {tab === "expenses" && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-10 text-center space-y-1">
              <p className="text-2xl">💸</p>
              <p className="text-sm text-muted-foreground">No expenses yet. Add the first one.</p>
            </div>
          ) : (
            expenses.map((exp) => {
              const payer    = memberById[exp.paid_by];
              const debtors  = (splitsByExpId[exp.id] ?? []).filter((s) => !s.settled && s.member_id !== exp.paid_by);
              return (
                <div key={exp.id} className="flex items-start justify-between rounded-xl border border-[#E8E4DE] bg-white px-4 py-3.5 shadow-sm">
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-foreground leading-tight truncate">{exp.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Paid by {payer ? `${payer.emoji} ${payer.name}` : "unknown"}
                    </p>
                    {debtors.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">Owed by</span>
                        <div className="flex -space-x-1">
                          {debtors.slice(0, 5).map((s) => {
                            const m = memberById[s.member_id];
                            return m ? (
                              <span key={s.id} title={m.name} className="text-base leading-none">{m.emoji}</span>
                            ) : null;
                          })}
                          {debtors.length > 5 && (
                            <span className="text-[11px] text-muted-foreground ml-1">+{debtors.length - 5}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="font-semibold text-foreground text-base ml-4 shrink-0">
                    {sym}{Number(exp.amount).toLocaleString()}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Balances tab ───────────────────────────────────────────────── */}
      {tab === "balances" && (
        <div className="space-y-3">
          {debtTxns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-10 text-center space-y-1">
              <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400" />
              <p className="text-sm font-medium text-foreground">All settled up!</p>
              <p className="text-xs text-muted-foreground">No outstanding balances.</p>
            </div>
          ) : (
            debtTxns.map((tx) => {
              const from = memberById[tx.fromId];
              const to   = memberById[tx.toId];
              if (!from || !to) return null;
              const key = `${tx.toId}:${tx.fromId}`;
              const isSettling = settlingPair === key;
              return (
                <div key={key} className="flex items-center justify-between rounded-xl border border-[#E8E4DE] bg-white px-4 py-3.5 shadow-sm">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <span className="mr-1">{from.emoji}</span>{from.name}
                      <span className="text-muted-foreground font-normal"> owes </span>
                      <span className="mr-1">{to.emoji}</span>{to.name}
                    </p>
                    <p className="text-xl font-semibold text-foreground">
                      {sym}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isSettling}
                    onClick={() => handleSettle(tx.toId, tx.fromId)}
                    className="shrink-0 ml-4 text-xs border-[#E8E4DE] hover:border-emerald-400 hover:text-emerald-600"
                  >
                    {isSettling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Mark settled"}
                  </Button>
                </div>
              );
            })
          )}

          {expenses.length > 0 && (
            <p className="text-[11px] text-center text-muted-foreground pt-2">
              Settle via UPI outside the app, then mark as settled here.
            </p>
          )}
        </div>
      )}

      {/* ── Add Expense Dialog ─────────────────────────────────────────── */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add expense</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Hotel, Dinner, Taxi"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                  {sym}
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8"
                  value={form.amount}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, amount: e.target.value, customAmounts: {} }));
                  }}
                />
              </div>
            </div>

            {/* Paid by */}
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Select
                value={form.paidBy}
                onValueChange={(v) => setForm((f) => ({ ...f, paidBy: v, customAmounts: {} }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.emoji} {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Split type */}
            <div className="space-y-2">
              <Label>Split</Label>
              <div className="flex gap-2">
                {(["equal", "custom"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, splitType: t, customAmounts: {} }))}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-sm font-medium transition-all",
                      form.splitType === t
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:border-foreground/40 text-foreground",
                    )}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Equal split preview */}
            {form.splitType === "equal" && parsedAmount > 0 && (
              <p className="text-xs text-muted-foreground bg-[#F4F1EC] rounded-lg px-3 py-2">
                {participantCount > 1
                  ? `${sym}${parsedAmount.toFixed(2)} split equally — ${sym}${perPerson.toFixed(2)} per person across ${participantCount} committed members`
                  : "No other committed members to split with — recorded as solo expense"}
              </p>
            )}

            {/* Custom split inputs */}
            {form.splitType === "custom" && parsedAmount > 0 && (
              <div className="space-y-2">
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {inMembers.filter((m) => m.id !== form.paidBy).map((m) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="text-base w-7 shrink-0">{m.emoji}</span>
                      <span className="text-sm flex-1 min-w-0 truncate">{m.name}</span>
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{sym}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          className="pl-6 text-right text-sm h-8"
                          value={form.customAmounts[m.id] ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              customAmounts: { ...f.customAmounts, [m.id]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className={cn(
                  "text-xs px-3 py-1.5 rounded-lg font-medium",
                  customValid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                )}>
                  Total: {sym}{customTotal.toFixed(2)} / {sym}{parsedAmount.toFixed(2)}
                  {!customValid && " — must match exactly"}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isAdding}>
              Cancel
            </Button>
            <Button
              onClick={handleAddExpense}
              disabled={isAdding || (form.splitType === "custom" && parsedAmount > 0 && !customValid)}
              className="bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
            >
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
