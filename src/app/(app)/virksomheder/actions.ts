"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

function normalizeUrl(u: string | null) {
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export type FormState = { error?: string } | undefined;

function companyFields(f: FormData) {
  return {
    name: str(f, "name") ?? "",
    category_id: str(f, "category_id"),
    owner_id: str(f, "owner_id"),
    website: normalizeUrl(str(f, "website")),
    general_email: str(f, "general_email"),
    notes: str(f, "notes"),
    do_not_contact: f.get("do_not_contact") === "on",
    do_not_contact_reason: str(f, "do_not_contact_reason"),
    updated_at: new Date().toISOString(),
  };
}

export async function createCompany(_: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  const fields = companyFields(f);
  if (!fields.name) return { error: "Navn mangler" };
  const { data, error } = await supabase.from("companies").insert(fields).select("id").single();
  if (error) return { error: error.code === "23505" ? "Der findes allerede en virksomhed med det navn" : error.message };
  const { data: stage } = await supabase.from("stages").select("id").order("sort_order").limit(1).single();
  if (stage) {
    await supabase
      .from("deals")
      .insert({ company_id: data.id, title: fields.name, stage_id: stage.id, owner_id: fields.owner_id });
  }
  revalidatePath("/virksomheder");
  redirect(`/virksomheder/${data.id}`);
}

export async function updateCompany(_: FormState, f: FormData): Promise<FormState> {
  const supabase = await createClient();
  const id = String(f.get("id"));
  const fields = companyFields(f);
  if (!fields.name) return { error: "Navn mangler" };
  const { error } = await supabase.from("companies").update(fields).eq("id", id);
  if (error) return { error: error.code === "23505" ? "Der findes allerede en virksomhed med det navn" : error.message };
  revalidatePath(`/virksomheder/${id}`);
  revalidatePath("/virksomheder");
  redirect(`/virksomheder/${id}`);
}

export async function deleteCompany(f: FormData) {
  const supabase = await createClient();
  await supabase.from("companies").delete().eq("id", String(f.get("id")));
  revalidatePath("/virksomheder");
  redirect("/virksomheder");
}

export async function saveContact(f: FormData) {
  const supabase = await createClient();
  const company_id = String(f.get("company_id"));
  const id = str(f, "id");
  const fields = {
    name: str(f, "name") ?? "Uden navn",
    title: str(f, "title"),
    email: str(f, "email")?.toLowerCase() ?? null,
    phone: str(f, "phone"),
    linkedin_url: normalizeUrl(str(f, "linkedin_url")),
  };
  if (id) await supabase.from("contacts").update(fields).eq("id", id);
  else await supabase.from("contacts").insert({ ...fields, company_id });
  revalidatePath(`/virksomheder/${company_id}`);
}

export async function deleteContact(f: FormData) {
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", String(f.get("id")));
  revalidatePath(`/virksomheder/${String(f.get("company_id"))}`);
}

export async function addTask(f: FormData) {
  const supabase = await createClient();
  const company_id = String(f.get("company_id"));
  const title = str(f, "title");
  if (!title) return;
  await supabase.from("tasks").insert({
    title,
    due_date: str(f, "due_date"),
    assignee_id: str(f, "assignee_id"),
    company_id,
    deal_id: str(f, "deal_id"),
  });
  revalidatePath(`/virksomheder/${company_id}`);
  revalidatePath("/virksomheder");
}

export async function toggleTask(f: FormData) {
  const supabase = await createClient();
  const done = f.get("done") === "1";
  await supabase
    .from("tasks")
    .update({ status: done ? "done" : "open", completed_at: done ? new Date().toISOString() : null })
    .eq("id", String(f.get("id")));
  revalidatePath(`/virksomheder/${String(f.get("company_id"))}`);
  revalidatePath("/virksomheder");
}
