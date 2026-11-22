import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActivityType } from "@/lib/labels";

export type Member = { id: string; name: string; initials: string; email: string | null; user_id: string | null };
export type Category = { id: string; name: string; sort_order: number };
export type Stage = { id: string; name: string; sort_order: number; default_probability: number; kind: "open" | "won" | "lost" };

export type Contact = {
  id: string;
  company_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
};

export type Task = {
  id: string;
  title: string;
  due_date: string | null;
  status: "open" | "done";
  assignee_id: string | null;
  company_id: string | null;
  deal_id: string | null;
};

export type Activity = {
  id: string;
  type: ActivityType;
  occurred_at: string | null;
  note: string | null;
  source: string;
  member_id: string | null;
  contact_id: string | null;
  from_stage_id: string | null;
  to_stage_id: string | null;
  created_at: string;
};

export type Deal = {
  id: string;
  title: string;
  stage_id: string;
  owner_id: string | null;
  value: number | null;
  probability: number | null;
  expected_close_date: string | null;
};

export type Company = {
  id: string;
  name: string;
  category_id: string | null;
  website: string | null;
  general_email: string | null;
  notes: string | null;
  owner_id: string | null;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;
  created_at: string;
};

/** Den indloggede bruger + teamet. Sender til /login, hvis man ikke er logget ind. */
export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const { data: members } = await supabase.from("team_members").select("*").order("name");
  const list = (members ?? []) as Member[];
  let me = list.find((m) => m.user_id === data.user!.id) ?? null;

  // Første login: kobl automatisk på teammedlem med samme e-mail
  if (!me && data.user.email) {
    const byEmail = list.find((m) => m.email?.toLowerCase() === data.user!.email!.toLowerCase() && !m.user_id);
    if (byEmail) {
      await supabase.from("team_members").update({ user_id: data.user.id }).eq("id", byEmail.id);
      me = { ...byEmail, user_id: data.user.id };
    }
  }
  return { supabase, user: data.user, members: list, me };
}

export async function getLookups() {
  const supabase = await createClient();
  const [{ data: categories }, { data: stages }, { data: members }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("stages").select("*").order("sort_order"),
    supabase.from("team_members").select("*").order("name"),
  ]);
  return {
    categories: (categories ?? []) as Category[],
    stages: (stages ?? []) as Stage[],
    members: (members ?? []) as Member[],
  };
}
