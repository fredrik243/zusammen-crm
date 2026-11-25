import { localDate } from "@/lib/period";

export const MONTH_NAMES = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export type BudgetDeal = {
  value: number | null;
  probability: number | null;
  stage_id: string;
  closed_at: string | null;
  expected_close_date: string | null;
};
export type BudgetStage = { id: string; kind: "open" | "won" | "lost"; default_probability: number };

export type BudgetMonth = {
  month: number; // 1-12
  label: string;
  target: number;
  won: number;
  weighted: number;
  costs: number;
  diff: number; // vundet − mål
  result: number; // vundet − omkostninger
};

type Totals = Omit<BudgetMonth, "month" | "label">;

export function computeBudget(input: {
  year: number;
  today: string; // YYYY-MM-DD
  targets: number[]; // 12
  costs: number[][]; // pr. post: 12 beløb
  deals: BudgetDeal[];
  stages: BudgetStage[];
}) {
  const { year, today } = input;
  const stageById = new Map(input.stages.map((s) => [s.id, s]));
  const kind = (d: BudgetDeal) => stageById.get(d.stage_id)?.kind ?? "open";
  const prob = (d: BudgetDeal) => (d.probability ?? stageById.get(d.stage_id)?.default_probability ?? 0) / 100;
  const val = (d: BudgetDeal) => Number(d.value ?? 0);

  const months: BudgetMonth[] = MONTH_NAMES.map((label, i) => {
    const target = Number(input.targets[i] ?? 0);
    const costs = input.costs.reduce((s, row) => s + Number(row[i] ?? 0), 0);
    return { month: i + 1, label, target, won: 0, weighted: 0, costs, diff: 0, result: 0 };
  });

  let weightedUndated = 0;
  let weightedOtherYears = 0;
  for (const d of input.deals) {
    if (kind(d) === "won") {
      const date = localDate(d.closed_at);
      if (date && Number(date.slice(0, 4)) === year) months[Number(date.slice(5, 7)) - 1].won += val(d);
    } else if (kind(d) === "open") {
      const w = val(d) * prob(d);
      const exp = d.expected_close_date;
      if (!exp) weightedUndated += w;
      else if (Number(exp.slice(0, 4)) === year) months[Number(exp.slice(5, 7)) - 1].weighted += w;
      else weightedOtherYears += w;
    }
  }
  for (const m of months) {
    m.diff = m.won - m.target;
    m.result = m.won - m.costs;
  }

  // År til dato: hele året, hvis det er forbi; ingen måneder, hvis det ligger i fremtiden
  const thisYear = Number(today.slice(0, 4));
  const ytdMonths = year < thisYear ? 12 : year > thisYear ? 0 : Number(today.slice(5, 7));

  const sum = (list: BudgetMonth[]): Totals => {
    const t = { target: 0, won: 0, weighted: 0, costs: 0, diff: 0, result: 0 };
    for (const m of list) {
      t.target += m.target;
      t.won += m.won;
      t.weighted += m.weighted;
      t.costs += m.costs;
    }
    t.diff = t.won - t.target;
    t.result = t.won - t.costs;
    return t;
  };

  const ytd = sum(months.slice(0, ytdMonths));
  const year_ = sum(months);
  const rest = sum(months.slice(ytdMonths));

  return { months, ytd, ytdMonths, year: year_, rest, weightedUndated, weightedOtherYears };
}
