"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveMember(f: FormData) {
  const supabase = await createClient();
  await supabase
    .from("team_members")
    .update({
      name: String(f.get("name")).trim(),
      initials: String(f.get("initials")).trim().toUpperCase().slice(0, 3),
      email: String(f.get("email") ?? "").trim().toLowerCase() || null,
    })
    .eq("id", String(f.get("id")));
  revalidatePath("/", "layout");
}

export async function saveCategory(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const name = String(f.get("name")).trim();
  if (!name) return;
  if (id) await supabase.from("categories").update({ name }).eq("id", id);
  else {
    const { data } = await supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    await supabase.from("categories").insert({ name, sort_order: (data?.[0]?.sort_order ?? 0) + 1 });
  }
  revalidatePath("/", "layout");
}

export async function deleteCategory(f: FormData) {
  const supabase = await createClient();
  await supabase.from("categories").delete().eq("id", String(f.get("id")));
  revalidatePath("/", "layout");
}
