"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseNumber } from "@/lib/numbers";

export async function saveProduct(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id") ?? "");
  const name = String(f.get("name") ?? "").trim();
  if (!name) return;
  const fields = {
    name,
    description: String(f.get("description") ?? "").trim() || null,
    default_price: parseNumber(String(f.get("default_price") ?? "")) ?? 0,
    unit: String(f.get("unit") ?? "").trim() || "stk.",
  };
  if (id) await supabase.from("products").update(fields).eq("id", id);
  else await supabase.from("products").insert(fields);
  revalidatePath("/indstillinger/produkter");
}

export async function setProductActive(f: FormData) {
  const supabase = await createClient();
  await supabase
    .from("products")
    .update({ active: f.get("active") === "1" })
    .eq("id", String(f.get("id")));
  revalidatePath("/indstillinger/produkter");
}

export async function deleteProduct(f: FormData) {
  const supabase = await createClient();
  const id = String(f.get("id"));
  const { count } = await supabase.from("deal_products").select("id", { count: "exact", head: true }).eq("product_id", id);
  if (count) return; // bruges på deals; kan kun skjules
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/indstillinger/produkter");
}
