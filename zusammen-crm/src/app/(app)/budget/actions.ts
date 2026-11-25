"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BudgetPayload = {
  year: number;
  targets: number[];
  items: { id: string | null; name: string; amounts: number[] }[];
};

export async function saveBudget(payload: BudgetPayload): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_budget", { payload });
  if (error) {
    return {
      error: error.message.includes("duplicate")
        ? "To omkostningsposter har samme navn."
        : error.message,
    };
  }
  revalidatePath("/budget");
  return {};
}

export async function deleteCostItem(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("cost_items").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/budget");
  return {};
}
