"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  tripId:     z.string().uuid(),
  title:      z.string().min(1).max(200),
  description:z.string().max(500).optional(),
  assignedTo: z.string().uuid().optional(),
  dueDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function addTask(
  input: unknown
): Promise<{ error?: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const { tripId, title, description, assignedTo, dueDate } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("tasks").insert({
    trip_id:     tripId,
    title,
    description: description ?? null,
    assigned_to: assignedTo ?? null,
    due_date:    dueDate    ?? null,
    status:      "todo",
  });

  if (error) return { error: "Failed to add task. Try again." };
  return {};
}
