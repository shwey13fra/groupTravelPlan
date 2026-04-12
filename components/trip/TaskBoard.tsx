"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createClient }      from "@/lib/supabase/client";
import { addTask }           from "@/app/actions/add-task";
import { updateTaskStatus }  from "@/app/actions/update-task-status";
import type { Task, TripMember } from "@/lib/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────
function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "done") return false;
  const due   = new Date(dueDate + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due < today;
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

const STATUS_LABELS: Record<string, string> = {
  todo:        "To Do",
  in_progress: "In Progress",
  done:        "Done",
};

const COLUMN_ORDER = ["todo", "in_progress", "done"] as const;

const COLUMN_STYLES: Record<string, { header: string; dot: string; empty: string }> = {
  todo:        { header: "text-foreground",     dot: "bg-muted-foreground/40", empty: "No tasks yet" },
  in_progress: { header: "text-amber-600",      dot: "bg-amber-400",           empty: "Nothing in progress" },
  done:        { header: "text-emerald-600",    dot: "bg-emerald-400",         empty: "Nothing done yet" },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  tripId:          string;
  isOrganizer:     boolean;
  currentMemberId: string | null;
  members:         TripMember[];
  initialTasks:    Task[];
}

export default function TaskBoard({
  tripId,
  isOrganizer,
  currentMemberId,
  members,
  initialTasks,
}: Props) {
  const [tasks,       setTasks]       = useState<Task[]>(initialTasks);
  const [addOpen,     setAddOpen]     = useState(false);
  const [adding,      setAdding]      = useState(false);
  const [updatingId,  setUpdatingId]  = useState<string | null>(null);

  // Add-task form state
  const [title,      setTitle]      = useState("");
  const [desc,       setDesc]       = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate,    setDueDate]    = useState("");

  // Committed members for assignee dropdown; fall back to all if none committed
  const committedMembers = members.filter((m) => m.commitment_status === "in");
  const assignableMembers = committedMembers.length > 0 ? committedMembers : members;

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const client = createClient();

    async function refetchTasks() {
      const { data } = await client
        .from("tasks")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (data) setTasks(data as Task[]);
    }

    const channel = client
      .channel(`trip-tasks-${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `trip_id=eq.${tripId}` },
        refetchTasks
      )
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [tripId]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const assignedCount   = tasks.filter((t) => t.assigned_to !== null).length;
  const completedCount  = tasks.filter((t) => t.status === "done").length;

  const tasksByStatus = COLUMN_ORDER.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s] = tasks.filter((t) => t.status === s);
    return acc;
  }, {} as Record<string, Task[]>);

  function findMember(id: string | null): TripMember | undefined {
    return id ? members.find((m) => m.id === id) : undefined;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  function resetForm() {
    setTitle(""); setDesc(""); setAssigneeId(""); setDueDate("");
  }

  async function handleAddTask() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    setAdding(true);
    const result = await addTask({
      tripId,
      title:      title.trim(),
      description:desc.trim() || undefined,
      assignedTo: assigneeId || undefined,
      dueDate:    dueDate    || undefined,
    });
    setAdding(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Task added.");
    resetForm();
    setAddOpen(false);
    // Realtime will push the new task
  }

  async function handleStatusChange(taskId: string, status: string) {
    if (!currentMemberId) return;
    setUpdatingId(taskId);
    const result = await updateTaskStatus({
      taskId,
      status: status as "todo" | "in_progress" | "done",
      requestingMemberId: currentMemberId,
    });
    setUpdatingId(null);
    if (result.error) { toast.error(result.error); return; }
    // Realtime will push the update
  }

  function handleNudge(task: Task) {
    const member = findMember(task.assigned_to);
    toast.success(`Nudge sent to ${member?.name ?? "assignee"}.`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Tasks
            </h2>
            {tasks.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {assignedCount} of {tasks.length} assigned
                {completedCount > 0 && ` · ${completedCount} completed`}
              </p>
            )}
          </div>
          {isOrganizer && (
            <Button
              size="sm"
              onClick={() => { resetForm(); setAddOpen(true); }}
              className="gap-1.5 h-8 text-xs bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </Button>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D5D0C8] bg-white/60 px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isOrganizer
                ? "No tasks yet. Add one to get things moving."
                : "No tasks assigned yet."}
            </p>
          </div>
        ) : (
          /* Three columns */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMN_ORDER.map((status) => {
              const style      = COLUMN_STYLES[status];
              const columnTasks = tasksByStatus[status];

              return (
                <div key={status} className="space-y-2">
                  {/* Column header */}
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                    <span className={`text-xs font-semibold ${style.header}`}>
                      {STATUS_LABELS[status]}
                    </span>
                    <span className="text-xs text-muted-foreground/60 tabular-nums">
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Task cards */}
                  <div className="space-y-2 min-h-[60px]">
                    {columnTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 px-1 pt-1">
                        {style.empty}
                      </p>
                    ) : (
                      columnTasks.map((task) => {
                        const assignee      = findMember(task.assigned_to);
                        const overdue       = isOverdue(task.due_date, task.status);
                        const canEdit       = isOrganizer || task.assigned_to === currentMemberId;
                        const isUpdating    = updatingId === task.id;
                        const showNudge     = isOrganizer && overdue && task.status === "todo";

                        return (
                          <div
                            key={task.id}
                            className="rounded-xl border border-[#E8E4DE] bg-white px-3 py-3 space-y-2.5"
                          >
                            {/* Title */}
                            <p className="text-sm font-medium text-foreground leading-snug">
                              {task.title}
                            </p>

                            {/* Assignee + due date */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              {assignee ? (
                                <div className="flex items-center gap-1.5 rounded-full bg-[#F4F1EC] px-2 py-0.5">
                                  <span className="text-sm leading-none">{assignee.emoji}</span>
                                  <span className="text-xs text-foreground/70 font-medium whitespace-nowrap">
                                    {assignee.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground/50 italic">Unassigned</span>
                              )}
                              {task.due_date && (
                                <span className={`text-xs font-medium tabular-nums ${
                                  overdue ? "text-rose-500" : "text-muted-foreground/60"
                                }`}>
                                  {overdue ? "⚠ " : ""}{formatDate(task.due_date)}
                                </span>
                              )}
                            </div>

                            {/* Status dropdown + nudge */}
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                {isUpdating ? (
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground h-8">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Saving…
                                  </div>
                                ) : (
                                  <select
                                    value={task.status}
                                    disabled={!canEdit}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                    className={`w-full rounded-lg border text-xs px-2 py-1.5 h-8 appearance-none cursor-pointer transition-colors
                                      ${canEdit
                                        ? "border-[#E8E4DE] bg-white text-foreground hover:border-[#C8C4BE] focus:outline-none focus:ring-1 focus:ring-[#1C2B4A]/20"
                                        : "border-transparent bg-transparent text-muted-foreground cursor-default"
                                      }`}
                                  >
                                    <option value="todo">To Do</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="done">Done</option>
                                  </select>
                                )}
                              </div>
                              {showNudge && (
                                <button
                                  onClick={() => handleNudge(task)}
                                  className="shrink-0 flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium transition-colors"
                                  title={`Nudge ${assignee?.name}`}
                                >
                                  <Bell className="h-3 w-3" />
                                  Nudge
                                </button>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed border-t border-[#F0EDE8] pt-2">
                                {task.description}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Add task dialog ──────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) setAddOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Add task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                placeholder="e.g. Book airport transfers"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="task-desc"
                placeholder="Any extra context…"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="resize-none min-h-[64px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-assignee">
                Assignee <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger id="task-assignee" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  {assignableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.emoji} {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due">
                Due date <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddTask}
              disabled={adding}
              className="w-full min-h-[44px] bg-[#1C2B4A] hover:bg-[#243558] text-white border-0"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
