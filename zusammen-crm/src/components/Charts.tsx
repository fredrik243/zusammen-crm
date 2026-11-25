import Link from "next/link";
import type { Period } from "@/lib/period";

/** Periodevælger: faste perioder som knapper + egen fra/til-dato. Bevarer ingen andre parametre. */
export function PeriodFilter({ path, presets, current }: { path: string; presets: Period[]; current: Period }) {
  const chip = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${active ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-200"}`;
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        {presets.map((p) => (
          <Link key={p.key} href={`${path}?periode=${p.key}`} className={chip(current.key === p.key)}>
            {p.label}
          </Link>
        ))}
      </div>
      <form action={path} className="flex items-center gap-2 text-sm">
        <input type="date" name="fra" defaultValue={current.from ?? ""} className="input min-w-0 flex-1 py-1 lg:w-auto lg:flex-none" aria-label="Fra dato" />
        <span className="text-stone-400">–</span>
        <input type="date" name="til" defaultValue={current.to ?? ""} className="input min-w-0 flex-1 py-1 lg:w-auto lg:flex-none" aria-label="Til dato" />
        <button className={`btn-secondary py-1 ${current.key === "egen" ? "border-stone-800" : ""}`}>Vis</button>
      </form>
    </div>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

/**
 * Enkel søjlegraf med én serie (én farve). Valgfri mållinje.
 * Hover viser værdien; tabelvisning findes som skjult tabel for skærmlæsere.
 */
export function BarChart({
  title,
  data,
  format = (n) => String(n),
  goal,
  goalLabel,
  height = 160,
  integer = false,
}: {
  integer?: boolean;
  title: string;
  data: { label: string; value: number; hint?: string; target?: number }[];
  format?: (n: number) => string;
  goal?: number;
  goalLabel?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.target ?? 0)), goal ?? 0);
  const hasTargets = data.some((d) => d.target != null && d.target > 0);
  const step = integer ? Math.max(1, niceStep(max)) : niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // Vis kun hver n'te etiket, så de ikke støder sammen
  const every = Math.max(1, Math.ceil(data.length / 8));

  return (
    <figure className="card p-4">
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {(goal != null || hasTargets) && (
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="inline-block w-4 border-t-2 border-dashed border-stone-500" /> {goalLabel ?? "Mål"}
          </span>
        )}
      </figcaption>
      <div className="flex gap-2">
        {/* y-akse */}
        <div className="relative w-12 shrink-0 text-right text-[10px] text-stone-400" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 tabular-nums" style={{ bottom: `${(t / top) * 100}%`, transform: "translateY(50%)" }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-stone-100" style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
            <div className="absolute inset-x-0 bottom-0 border-t border-stone-300" />
            {goal != null && goal > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-stone-500"
                style={{ bottom: `${(goal / top) * 100}%` }}
              />
            )}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {data.map((d, i) => (
                <div key={i} className="group relative flex h-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-10 rounded-t bg-accent transition-opacity group-hover:opacity-80"
                    style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
                  />
                  {d.target != null && d.target > 0 && (
                    <div
                      className="pointer-events-none absolute left-1/2 z-10 w-full max-w-12 -translate-x-1/2 border-t-2 border-dashed border-stone-500"
                      style={{ bottom: `${(d.target / top) * 100}%` }}
                    />
                  )}
                  <div className="pointer-events-none absolute bottom-full z-20 mb-1 hidden whitespace-nowrap rounded bg-stone-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                    <div className="font-medium tabular-nums">{format(d.value)}</div>
                    {d.target != null && d.target > 0 && (
                      <div className="text-stone-300 tabular-nums">Mål: {format(d.target)}</div>
                    )}
                    <div className="text-stone-300">{d.hint ?? d.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-[2px] text-[10px] text-stone-500">
            {data.map((d, i) => (
              <div key={i} className="flex-1 truncate text-center">
                {i % every === 0 ? d.label : ""}
              </div>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th>{d.hint ?? d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function niceStep(max: number): number {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("da-DK", { maximumFractionDigits: 1 })} mio.`;
  return n.toLocaleString("da-DK", { maximumFractionDigits: 1 });
}

/** Tabel med indbyggede mængdesøjler (én farve) i første talkolonne. */
export function BreakdownTable({
  title,
  columns,
  rows,
  barColumn = 0,
  empty = "Ingen data i perioden.",
}: {
  title: string;
  columns: string[];
  rows: { label: string; values: (string | number)[]; raw?: number[] }[];
  barColumn?: number;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.raw?.[barColumn] ?? 0));
  return (
    <section className="card overflow-hidden">
      <h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-stone-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium" />
                {columns.map((c) => (
                  <th key={c} className="px-4 py-2 text-right font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="px-4 py-2">
                    <div className="truncate">{r.label}</div>
                    {r.raw && (
                      <div className="mt-1 h-1.5 rounded-full bg-stone-100">
                        <div
                          className="h-1.5 rounded-full bg-accent"
                          style={{ width: `${((r.raw[barColumn] ?? 0) / max) * 100}%` }}
                        />
                      </div>
                    )}
                  </td>
                  {r.values.map((v, i) => (
                    <td key={i} className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
