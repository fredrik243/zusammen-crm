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

export async function saveStage(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const name = String(f.get("name") ?? "").trim();
  if (!name) return;
  const p = Number(f.get("default_probability") ?? 0);
  const fields = {
    name,
    default_probability: Number.isFinite(p) ? Math.max(0, Math.min(100, Math.round(p))) : 0,
    kind: ["open", "won", "lost"].includes(String(f.get("kind"))) ? String(f.get("kind")) : "open",
  };
  if (id) await supabase.from("stages").update(fields).eq("id", id);
  else {
    // Nye faser lægges før Vundet/Tabt
    const { data: stages } = await supabase.from("stages").select("id,sort_order,kind").order("sort_order");
    const list = stages ?? [];
    const firstClosed = list.findIndex((s) => s.kind !== "open");
    const at = firstClosed === -1 ? list.length : firstClosed;
    for (const s of list.slice(at)) {
      await supabase.from("stages").update({ sort_order: s.sort_order + 1 }).eq("id", s.id);
    }
    const order = at === 0 ? 1 : list[at - 1].sort_order + 1;
    await supabase.from("stages").insert({ ...fields, sort_order: order });
  }
  revalidatePath("/", "layout");
}

export async function moveStage(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id"));
  const dir = f.get("dir") === "up" ? -1 : 1;
  const { data } = await supabase.from("stages").select("id,sort_order").order("sort_order");
  const list = data ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = list[i];
  const b = list[j];
  // Undgå konflikt ved at bytte via en midlertidig værdi
  await supabase.from("stages").update({ sort_order: -1 }).eq("id", a.id);
  await supabase.from("stages").update({ sort_order: a.sort_order }).eq("id", b.id);
  await supabase.from("stages").update({ sort_order: b.sort_order }).eq("id", a.id);
  revalidatePath("/", "layout");
}

export async function deleteStage(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id"));
  const { count } = await supabase.from("deals").select("id", { count: "exact", head: true }).eq("stage_id", id);
  if (count) return; // knappen er skjult, når der er deals i fasen
  await supabase.from("stages").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function saveWeeklyGoal(f: FormData) {
  const supabase = await createClient();
  const n = Number(String(f.get("weekly_meeting_goal") ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return;
  await supabase.from("app_settings").update({ weekly_meeting_goal: Math.round(n) }).eq("id", 1);
  revalidatePath("/indstillinger");
  revalidatePath("/statistik");
}
