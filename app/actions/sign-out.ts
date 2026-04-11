"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Clear the last-trip cookie so the landing page is clean after sign-out
  const cookieStore = await cookies();
  cookieStore.delete("last_trip_id");

  redirect("/");
}
