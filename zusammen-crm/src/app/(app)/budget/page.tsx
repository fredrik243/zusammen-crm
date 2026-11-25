import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLookups, getSession } from "@/lib/data";
import { todayISO } from "@/lib/labels";
import { kr } from "@/lib/numbers";
import { computeBudget, MONTH_NAMES, type BudgetDeal } from "@/lib/budget";
import { BarChart, StatTile } from "@/components/Charts";
import { RevenueTabs } from "@/components/RevenueTabs";
import { BudgetEditor } from "./BudgetEditor";

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ aar?: string }> }) {
  const sp = await searchParams;
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  const year = /^\d{4}$/.test(sp.aar ?? "") ? Number(sp.aar) : thisYear;
  const { supabase } = await getSession();
  const { stages } = await getLookups();

  const from = `${year}-01-01`;
  const to = `${year}-12-01`;
  const [{ data: targetRows, error }, { data: itemRows }, { data: costRows }, { data: dealRows }] = await Promise.all([
    supabase.from("revenue_targets").select("month,amount").gte("month", from).lte("month", to),
    supabase.from("cost_items").select("id,name,sort_order").order("sort_order").order("name"),
    supabase.from("cost_budgets").select("cost_item_id,month,amount").gte("month", from).lte("month", to),
    supabase.from("deals").select("value,probability,stage_id,closed_at,expected_close_date"),
  ]);

  const monthIndex = (m: string) => Number(m.slice(5, 7)) - 1;
  const targets = Array(12).fill(0) as number[];
  for (const t of targetRows ?? []) targets[monthIndex(t.month)] = Number(t.amount);
  const items = (itemRows ?? []).map((i) => {
    const amounts = Array(12).fill(0) as number[];
    for (const c of costRows ?? []) if (c.cost_item_id === i.id) amounts[monthIndex(c.month)] = Number(c.amount);
    return { id: i.id as string, name: i.name as string, amounts };
  });

  const b = computeBudget({
    year,
    today,
    targets,
    costs: items.map((i) => i.amounts),
    deals: (dealRows ?? []) as BudgetDeal[],
    stages,
  });

  const signed = (n: number) => (n > 0 ? `+${kr(n)}` : kr(n));
  const tone = (n: number) => (n < 0 ? "text-red-700" : n > 0 ? "text-emerald-700" : "");
  const ytdLabel =
    b.ytdMonths === 12 ? `Hele ${year}` : b.ytdMonths === 0 ? "Året er ikke begyndt" : `Jan–${MONTH_NAMES[b.ytdMonths - 1]}. ${year}`;
  const reached = b.ytd.target ? Math.round((b.ytd.won / b.ytd.target) * 100) : null;

  return (
    <div className="space-y-5">
      <RevenueTabs active="budget" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Budget</h1>
          <p className="text-sm text-stone-500">Mål og omkostninger sammenlignet med vundet omsætning og vægtet pipeline.</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/budget?aar=${year - 1}`} className="btn-ghost px-2" aria-label="Forrige år">
            <ChevronLeft size={16} />
          </Link>
          <span className="w-14 text-center font-semibold tabular-nums">{year}</span>
          <Link href={`/budget?aar=${year + 1}`} className="btn-ghost px-2" aria-label="Næste år">
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Budgettabellerne findes ikke endnu. Kør supabase/04_fase5.sql i Supabases SQL Editor. ({error.message})
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Mål år til dato" value={kr(b.ytd.target)} sub={ytdLabel} />
        <StatTile
          label="Vundet år til dato"
          value={kr(b.ytd.won)}
          sub={reached == null ? "Intet mål sat" : `${reached} % af målet (${signed(b.ytd.diff)})`}
        />
        <StatTile label="Omkostninger år til dato" value={kr(b.ytd.costs)} sub="Budgetteret" />
        <StatTile label="Resultat år til dato" value={kr(b.ytd.result)} sub="Vundet − omkostninger" />
        <StatTile
          label="Vægtet pipeline resten af året"
          value={kr(b.rest.weighted)}
          sub={`Mål resten af året: ${kr(b.rest.target)}`}
        />
      </div>

      <BarChart
        title={`Vundet omsætning pr. måned ${year} mod mål`}
        data={b.months.map((m) => ({ label: m.label, hint: `${m.label}. ${year}`, value: m.won, target: m.target }))}
        format={kr}
        goalLabel="Mål pr. måned"
      />

      <section className="card overflow-hidden">
        <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Sammenligning pr. måned</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Måned</th>
                <th className="px-4 py-2 text-right font-medium">Mål</th>
                <th className="px-4 py-2 text-right font-medium">Vundet</th>
                <th className="px-4 py-2 text-right font-medium">Afvigelse</th>
                <th className="px-4 py-2 text-right font-medium whitespace-nowrap">Vægtet pipeline</th>
                <th className="px-4 py-2 text-right font-medium">Omkostninger</th>
                <th className="px-4 py-2 text-right font-medium">Resultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular-nums">
              {b.months.map((m) => {
                const future = m.month > b.ytdMonths;
                return (
                  <tr key={m.month} className={future ? "text-stone-500" : ""}>
                    <td className="px-4 py-2">{m.label}.</td>
                    <td className="px-4 py-2 text-right">{kr(m.target)}</td>
                    <td className="px-4 py-2 text-right">{kr(m.won)}</td>
                    <td className={`px-4 py-2 text-right ${future ? "" : tone(m.diff)}`}>{future ? "–" : signed(m.diff)}</td>
                    <td className="px-4 py-2 text-right">{kr(m.weighted)}</td>
                    <td className="px-4 py-2 text-right">{kr(m.costs)}</td>
                    <td className={`px-4 py-2 text-right ${future ? "" : tone(m.result)}`}>{kr(m.result)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-stone-200 font-medium tabular-nums">
              {[
                { label: `År til dato`, t: b.ytd },
                { label: `Hele ${year}`, t: b.year },
              ].map(({ label, t }) => (
                <tr key={label}>
                  <td className="px-4 py-2 whitespace-nowrap">{label}</td>
                  <td className="px-4 py-2 text-right">{kr(t.target)}</td>
                  <td className="px-4 py-2 text-right">{kr(t.won)}</td>
                  <td className={`px-4 py-2 text-right ${tone(t.diff)}`}>{signed(t.diff)}</td>
                  <td className="px-4 py-2 text-right">{kr(t.weighted)}</td>
                  <td className="px-4 py-2 text-right">{kr(t.costs)}</td>
                  <td className={`px-4 py-2 text-right ${tone(t.result)}`}>{kr(t.result)}</td>
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        {(b.weightedUndated > 0 || b.weightedOtherYears > 0) && (
          <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
            Vægtet pipeline fordeles efter forventet lukkedato.{" "}
            {b.weightedUndated > 0 && <>{kr(b.weightedUndated)} ligger på deals uden forventet lukkedato og er ikke med. </>}
            {b.weightedOtherYears > 0 && <>{kr(b.weightedOtherYears)} forventes lukket i andre år.</>}
          </p>
        )}
      </section>

      <BudgetEditor key={year} year={year} targets={targets} items={items} />
    </div>
  );
}
