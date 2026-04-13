"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { refreshNudge } from "@/app/actions/refresh-nudge";

const schema = z.object({
  taskId:             z.string().uuid(),
  status:             z.enum(["todo", "in_progress", "done"]),
  requestingMemberId: z.string().uuid(),
});

export async function updateTaskStatus(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { taskId, status, requestingMemberId } = parsed.data;
  const supabase = await createClient();

  // Fetch task + requesting member in parallel
  const [{ data: task }, { data: member }] = await Promise.all([
    supabase.from("tasks").select("assigned_to, trip_id").eq("id", taskId).maybeSingle(),
    supabase.from("trip_members").select("is_organizer").eq("id", requestingMemberId).maybeSingle(),
  ]);

  if (!task)   return { error: "Task not found." };
  if (!member) return { error: "Member not found." };

  const isAssignee  = task.assigned_to === requestingMemberId;
  const isOrganizer = member.is_organizer;

  if (!isAssignee && !isOrganizer) {
    return { error: "Only the assignee or organizer can change this task's status." };
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) return { error: "Failed to update task. Try again." };

  try { await refreshNudge(task.trip_id); } catch {}
  return {};
}
