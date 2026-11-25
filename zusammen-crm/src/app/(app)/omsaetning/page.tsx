import Link from "next/link";
import { getLookups, getSession } from "@/lib/data";
import { presets, resolvePeriod } from "@/lib/period";
import { computeRevenue, type RevDeal, type RevLine, type Row } from "@/lib/revenue";
import { kr } from "@/lib/numbers";
import { BarChart, BreakdownTable, PeriodFilter, StatTile } from "@/components/Charts";
import { RevenueTabs } from "@/components/RevenueTabs";

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; fra?: string; til?: string }>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp, "revenue", "aar");
  const { supabase } = await getSession();
  const { stages, categories, members } = await getLookups();

  const [{ data: dealRows, error }, { data: lineRows, error: lineError }] = await Promise.all([
    supabase.from("deals").select("id,value,probability,stage_id,owner_id,closed_at, company:companies(category_id)"),
    supabase.from("deal_products").select("deal_id,quantity,unit_price,discount_pct, product:products(name)"),
  ]);

  const deals: RevDeal[] = ((dealRows ?? []) as unknown as (Omit<RevDeal, "category_id"> & { company: { category_id: string | null } | null })[]).map(
    (d) => ({ ...d, category_id: d.company?.category_id ?? null }),
  );
  const lines: RevLine[] = ((lineRows ?? []) as unknown as {
    deal_id: string;
    quantity: number;
    unit_price: number;
    discount_pct: number;
    product: { name: string } | null;
  }[]).map((l) => ({
    deal_id: l.deal_id,
    product: l.product?.name ?? "Ukendt produkt",
    total: Number(l.quantity) * Number(l.unit_price) * (1 - Number(l.discount_pct) / 100),
  }));

  const r = computeRevenue({
    deals,
    stages,
    lines,
    period,
    categoryName: (id) => categories.find((c) => c.id === id)?.name ?? "Uden kategori",
    ownerName: (id) => members.find((m) => m.id === id)?.name ?? "Ingen ansvarlig",
  });

  const toRows = (rows: Row[]) =>
    rows.map((x) => ({
      label: x.label,
      values: [kr(x.won), kr(x.pipeline), kr(x.weighted)],
      raw: [x.won, x.pipeline, x.weighted],
    }));
  const cols = [`Vundet (${period.label.toLowerCase()})`, "Pipeline", "Vægtet"];
  const anyWon = r.wonTotal > 0;

  return (
    <div className="space-y-5">
      <RevenueTabs active="omsaetning" />
      <div>
        <h1 className="text-xl font-semibold">Omsætning</h1>
        <p className="text-sm text-stone-500">
          Vundet omsætning tælles på den dato, en deal blev flyttet til Vundet. Pipeline og vægtet pipeline er åbne deals lige nu.
        </p>
      </div>

      <PeriodFilter path="/omsaetning" presets={presets("revenue")} current={period} />

      {(error || lineError) && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Noget kunne ikke hentes{lineError ? ". Er supabase/03_fase4.sql kørt?" : ""} ({(error ?? lineError)!.message})
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Vundet omsætning" value={kr(r.wonTotal)} sub={`${r.wonCount} vundne deals · ${period.label}`} />
        <StatTile label="Samlet pipeline" value={kr(r.pipelineTotal)} sub={`${r.openCount} åbne deals`} />
        <StatTile label="Vægtet pipeline" value={kr(r.weightedTotal)} sub="Værdi × sandsynlighed" />
        <StatTile
          label="Åbne deals uden værdi"
          value={String(r.openWithoutValue)}
          sub={r.openWithoutValue ? "Tæller som 0 kr." : "Alle har en værdi"}
        />
      </div>

      <BarChart
        title="Vundet omsætning pr. måned"
        data={r.months.map((m) => ({ label: m.label, hint: m.hint, value: m.value }))}
        format={kr}
      />
      {!anyWon && (
        <p className="-mt-3 text-xs text-stone-500">
          Ingen vundne deals i perioden endnu. Træk en deal til Vundet i pipelinen, så dukker den op her.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownTable title="Fordelt på produkt" columns={cols} rows={toRows(r.byProduct)} barColumn={anyWon ? 0 : 2} />
        <BreakdownTable title="Fordelt på kategori" columns={cols} rows={toRows(r.byCategory)} barColumn={anyWon ? 0 : 2} />
        <BreakdownTable title="Fordelt på ansvarlig" columns={cols} rows={toRows(r.byOwner)} barColumn={anyWon ? 0 : 2} />
      </div>

      <p className="text-xs text-stone-500">
        Sandsynligheden er dealens egen eller fasens standard (sættes under{" "}
        <Link href="/indstillinger" className="underline">
          Indstillinger
        </Link>
        ). Deals med produkter fordeles på produkterne; resten står under &quot;Uden produkter&quot;.
      </p>
    </div>
  );
}
