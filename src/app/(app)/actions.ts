"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimMember(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase
    .from("team_members")
    .update({ user_id: data.user.id, email: data.user.email })
    .eq("id", String(formData.get("member_id")))
    .is("user_id", null);
  revalidatePath("/", "layout");
}
