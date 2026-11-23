"use server";

// Fælles handlinger for aktiviteter og opgaver. Bruges fra pipeline, virksomhedssiden og opgavesiden.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/labels";

async function ctx() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Ikke logget ind");
  const { data: me } = await supabase.from("team_members").select("id").eq("user_id", data.user.id).maybeSingle();
  return { supabase, meId: (me?.id as string | undefined) ?? null };
}

function refresh(companyId?: string | null) {
  if (companyId) revalidatePath(`/virksomheder/${companyId}`);
  revalidatePath("/virksomheder");
  revalidatePath("/pipeline");
  revalidatePath("/opgaver");
}

export async function logActivity(input: {
  companyId: string;
  dealId?: string | null;
  type: ActivityType;
  date?: string | null; // YYYY-MM-DD, standard i dag
  note?: string | null;
}): Promise<{ error?: string }> {
  if (!ACTIVITY_TYPES.includes(input.type) || input.type === "stage_changed") return { error: "Ukendt aktivitetstype" };
  const { supabase, meId } = await ctx();

  let dealId = input.dealId ?? null;
  let contactId: string | null = null;
  if (!dealId) {
    const { data } = await supabase.from("deals").select("id,contact_id").eq("company_id", input.companyId).limit(1);
    dealId = data?.[0]?.id ?? null;
    contactId = data?.[0]?.contact_id ?? null;
  } else {
    const { data } = await supabase.from("deals").select("contact_id").eq("id", dealId).maybeSingle();
    contactId = data?.contact_id ?? null;
  }

  // I dag: tidspunktet nu. Anden dato: midt på dagen dansk tid.
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
  const occurred_at =
    !input.date || input.date === today ? new Date().toISOString() : `${input.date}T12:00:00+01:00`;

  const { error } = await supabase.from("activities").insert({
    type: input.type,
    occurred_at,
    company_id: input.companyId,
    deal_id: dealId,
    contact_id: contactId,
    member_id: meId,
    note: input.note?.trim() || null,
    source: "manual",
  });
  if (error) return { error: error.message };
  refresh(input.companyId);
  return {};
}

export async function deleteActivity(id: string, companyId: string): Promise<void> {
  const { supabase } = await ctx();
  await supabase.from("activities").delete().eq("id", id).neq("source", "system");
  refresh(companyId);
}

export async function setTaskDone(id: string, done: boolean): Promise<{ error?: string }> {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("tasks")
    .update({ status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select("company_id")
    .single();
  if (error) return { error: error.message };
  refresh(data?.company_id);
  return {};
}

export async function createTask(input: {
  title: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  companyId?: string | null;
  dealId?: string | null;
}): Promise<{ error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "Titel mangler" };
  const { supabase } = await ctx();
  let dealId = input.dealId ?? null;
  if (!dealId && input.companyId) {
    const { data } = await supabase.from("deals").select("id").eq("company_id", input.companyId).limit(1);
    dealId = data?.[0]?.id ?? null;
  }
  const { error } = await supabase.from("tasks").insert({
    title,
    due_date: input.dueDate || null,
    assignee_id: input.assigneeId || null,
    company_id: input.companyId || null,
    deal_id: dealId,
  });
  if (error) return { error: error.message };
  refresh(input.companyId);
  return {};
}

export async function updateTask(input: {
  id: string;
  title: string;
  dueDate?: string | null;
  assigneeId?: string | null;
}): Promise<{ error?: string }> {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("tasks")
    .update({ title: input.title.trim(), due_date: input.dueDate || null, assignee_id: input.assigneeId || null })
    .eq("id", input.id)
    .select("company_id")
    .single();
  if (error) return { error: error.message };
  refresh(data?.company_id);
  return {};
}

export async function deleteTask(id: string): Promise<void> {
  const { supabase } = await ctx();
  const { data } = await supabase.from("tasks").delete().eq("id", id).select("company_id").maybeSingle();
  refresh(data?.company_id);
}
