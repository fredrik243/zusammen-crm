"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function moveDeal(dealId: string, stageId: string, position: number): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_deal", { p_deal: dealId, p_stage: stageId, p_position: position });
  if (error) return { error: error.message };
  revalidatePath("/virksomheder", "layout");
  return {};
}
