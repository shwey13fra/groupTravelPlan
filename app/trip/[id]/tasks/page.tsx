import { notFound } from "next/navigation";
import { createClient }       from "@/lib/supabase/server";
import { getCurrentMemberId }  from "@/lib/server/current-member";
import TaskBoard               from "@/components/trip/TaskBoard";
import type { Task } from "@/lib/types/database";

export default async function TasksPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [membersRes, tasksRes, currentMemberId] = await Promise.all([
    supabase
      .from("trip_members")
      .select("*")
      .eq("trip_id", params.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("tasks")
      .select("*")
      .eq("trip_id", params.id)
      .order("created_at", { ascending: true }),
    getCurrentMemberId(params.id),
  ]);

  // Verify trip exists via members response (layout already guards notFound)
  if (!membersRes.data) notFound();

  const members     = membersRes.data ?? [];
  const tasks       = (tasksRes.data ?? []) as Task[];
  const currentMember = members.find((m) => m.id === currentMemberId) ?? null;
  const isOrganizer   = currentMember?.is_organizer ?? false;

  return (
    <TaskBoard
      tripId={params.id}
      isOrganizer={isOrganizer}
      currentMemberId={currentMemberId}
      members={members}
      initialTasks={tasks}
    />
  );
}
