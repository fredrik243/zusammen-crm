import { inPeriod, localDate, type Period } from "@/lib/period";
import { todayISO } from "@/lib/labels";

export type RevDeal = {
  id: string;
  value: number | null;
  probability: number | null;
  stage_id: string;
  owner_id: string | null;
  closed_at: string | null;
  category_id: string | null;
};
export type RevStage = { id: string; kind: "open" | "won" | "lost"; default_probability: number };
export type RevLine = { deal_id: string; product: string; total: number };

export type Row = { label: string; won: number; pipeline: number; weighted: number };

const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function computeRevenue(input: {
  deals: RevDeal[];
  stages: RevStage[];
  lines: RevLine[];
  period: Period;
  categoryName: (id: string | null) => string;
  ownerName: (id: string | null) => string;
}) {
  const { deals, stages, lines, period } = input;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const linesByDeal = new Map<string, RevLine[]>();
  for (const l of lines) linesByDeal.set(l.deal_id, [...(linesByDeal.get(l.deal_id) ?? []), l]);

  const prob = (d: RevDeal) => (d.probability ?? stageById.get(d.stage_id)?.default_probability ?? 0) / 100;
  const val = (d: RevDeal) => Number(d.value ?? 0);
  const kind = (d: RevDeal) => stageById.get(d.stage_id)?.kind ?? "open";

  const won = deals.filter((d) => kind(d) === "won" && inPeriod(localDate(d.closed_at), period));
  const open = deals.filter((d) => kind(d) === "open");

  const wonTotal = won.reduce((s, d) => s + val(d), 0);
  const pipelineTotal = open.reduce((s, d) => s + val(d), 0);
  const weightedTotal = open.reduce((s, d) => s + val(d) * prob(d), 0);
  const openWithoutValue = open.filter((d) => d.value == null || Number(d.value) === 0).length;

  // Vundet pr. måned
  const today = todayISO();
  let from = period.from;
  const to = period.to && period.to < today ? period.to : period.to ? period.to : today;
  if (!from) {
    const firstWon = won.map((d) => localDate(d.closed_at)!).sort()[0];
    const d = new Date(today + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - 11);
    const twelveAgo = d.toISOString().slice(0, 7) + "-01";
    from = firstWon && firstWon < twelveAgo ? firstWon : twelveAgo;
  }
  const months: { key: string; label: string; hint: string; value: number }[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  while (`${y}-${String(m).padStart(2, "0")}` <= endKey && months.length < 36) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    months.push({ key, label: MONTHS[m - 1], hint: `${MONTHS[m - 1]}. ${y}`, value: 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  for (const d of won) {
    const k = localDate(d.closed_at)!.slice(0, 7);
    const row = months.find((x) => x.key === k);
    if (row) row.value += val(d);
  }

  // Fordelinger
  function group(keyOf: (d: RevDeal) => { label: string; share: number }[]): Row[] {
    const map = new Map<string, Row>();
    const add = (label: string, field: "won" | "pipeline" | "weighted", n: number) => {
      const r = map.get(label) ?? { label, won: 0, pipeline: 0, weighted: 0 };
      r[field] += n;
      map.set(label, r);
    };
    for (const d of won) for (const k of keyOf(d)) add(k.label, "won", k.share);
    for (const d of open) {
      for (const k of keyOf(d)) {
        add(k.label, "pipeline", k.share);
        add(k.label, "weighted", k.share * prob(d));
      }
    }
    return [...map.values()]
      .filter((r) => r.won || r.pipeline)
      .sort((a, b) => b.won - a.won || b.pipeline - a.pipeline);
  }

  const byProduct = group((d) => {
    const ls = linesByDeal.get(d.id);
    if (!ls?.length) return [{ label: "Uden produkter", share: val(d) }];
    return ls.map((l) => ({ label: l.product, share: l.total }));
  });
  const byCategory = group((d) => [{ label: input.categoryName(d.category_id), share: val(d) }]);
  const byOwner = group((d) => [{ label: input.ownerName(d.owner_id), share: val(d) }]);

  return {
    wonTotal,
    wonCount: won.length,
    pipelineTotal,
    weightedTotal,
    openCount: open.length,
    openWithoutValue,
    months,
    byProduct,
    byCategory,
    byOwner,
  };
}
