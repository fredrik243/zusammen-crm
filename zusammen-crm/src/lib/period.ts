import { addDays, todayISO } from "@/lib/labels";

export type Period = { key: string; label: string; from: string | null; to: string | null };

/** Mandag i ugen for en dato (YYYY-MM-DD). */
export function mondayOf(iso: string): string {
  const dow = (new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

/** ISO-ugenummer. */
export function isoWeek(iso: string): number {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1, 12);
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** Dato i dansk tid for et tidsstempel. */
export function localDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  if (ts.length === 10) return ts;
  return new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
}

const monthStart = (iso: string) => iso.slice(0, 8) + "01";

export function presets(kind: "stats" | "revenue"): Period[] {
  const t = todayISO();
  const y = t.slice(0, 4);
  if (kind === "stats") {
    return [
      { key: "uge", label: "Denne uge", from: mondayOf(t), to: t },
      { key: "4uger", label: "Sidste 4 uger", from: addDays(mondayOf(t), -21), to: t },
      { key: "maaned", label: "Denne måned", from: monthStart(t), to: t },
      { key: "aar", label: "I år", from: `${y}-01-01`, to: t },
      { key: "alt", label: "Alt", from: null, to: null },
    ];
  }
  const lastYear = String(Number(y) - 1);
  const twelve = new Date(t + "T12:00:00Z");
  twelve.setUTCMonth(twelve.getUTCMonth() - 11);
  return [
    { key: "aar", label: "I år", from: `${y}-01-01`, to: `${y}-12-31` },
    { key: "12mdr", label: "Sidste 12 mdr.", from: monthStart(twelve.toISOString().slice(0, 10)), to: t },
    { key: "sidsteaar", label: `${lastYear}`, from: `${lastYear}-01-01`, to: `${lastYear}-12-31` },
    { key: "alt", label: "Alt", from: null, to: null },
  ];
}

export function resolvePeriod(
  sp: { periode?: string; fra?: string; til?: string },
  kind: "stats" | "revenue",
  fallback: string,
): Period {
  const list = presets(kind);
  const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (valid(sp.fra) || valid(sp.til)) {
    const from = valid(sp.fra) ? sp.fra! : null;
    const to = valid(sp.til) ? sp.til! : null;
    return { key: "egen", label: "Egen periode", from, to };
  }
  return list.find((p) => p.key === sp.periode) ?? list.find((p) => p.key === fallback)!;
}

export function inPeriod(date: string | null | undefined, p: Period): boolean {
  if (!date) return p.from == null && p.to == null; // ukendt dato tæller kun med under "Alt"
  const d = date.slice(0, 10);
  return (p.from == null || d >= p.from) && (p.to == null || d <= p.to);
}
