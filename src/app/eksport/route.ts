import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/labels";

// Eksport af kontaktbanken. Én række pr. person (virksomheder uden personer får én række).
// Semikolon og BOM, så filen åbner korrekt i dansk Excel og Numbers.
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Ikke logget ind", { status: 401 });

  const [{ data: companies }, { data: categories }, { data: members }, { data: stages }] = await Promise.all([
    supabase.from("companies").select("*, contacts(*), deals(stage_id)").order("name"),
    supabase.from("categories").select("id,name"),
    supabase.from("team_members").select("id,name"),
    supabase.from("stages").select("id,name"),
  ]);
  const name = (list: { id: string; name: string }[] | null, id: string | null) =>
    list?.find((x) => x.id === id)?.name ?? "";

  const header = [
    "Virksomhed", "Kategori", "Fase", "Ansvarlig", "Website", "Generel e-mail", "Kontakt ikke igen",
    "Person", "Titel", "E-mail", "Telefon", "LinkedIn", "Noter",
  ];
  const rows: string[][] = [];
  for (const c of companies ?? []) {
    const base = [
      c.name,
      name(categories, c.category_id),
      name(stages, c.deals?.[0]?.stage_id ?? null),
      name(members, c.owner_id),
      c.website ?? "",
      c.general_email ?? "",
      c.do_not_contact ? "Ja" : "",
    ];
    const people = c.contacts?.length ? c.contacts : [{}];
    for (const p of people) {
      rows.push([...base, p.name ?? "", p.title ?? "", p.email ?? "", p.phone ?? "", p.linkedin_url ?? "", c.notes ?? ""]);
    }
  }
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = "﻿" + [header, ...rows].map((r) => r.map((v) => esc(String(v))).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zusammen-kontakter-${todayISO()}.csv"`,
    },
  });
}
