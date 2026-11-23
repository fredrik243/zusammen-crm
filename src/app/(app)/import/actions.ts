"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ImportPayload = {
  companies: {
    name: string;
    stage: string;
    category: string;
    owner_id: string | null;
    general_email: string;
    do_not_contact: boolean;
    do_not_contact_reason: string;
    source: Record<string, string>;
    contacts: { name: string; title: string; email: string }[];
    tasks: { title: string; due_date: string; assignee_id: string | null }[];
    activities: { type: string; date: string; note: string; source: string; member_id: string | null }[];
  }[];
};

export async function runImport(payload: ImportPayload): Promise<{ created?: number; skipped?: string[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_companies", { payload });
  if (error) return { error: error.message };
  revalidatePath("/virksomheder");
  return data as { created: number; skipped: string[] };
}
