"use client";

import { useState, useTransition } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { MONTH_NAMES } from "@/lib/budget";
import { parseNumber } from "@/lib/numbers";
import { deleteCostItem, saveBudget } from "./actions";

type Row = { key: string; id: string | null; name: string; cells: string[] };

const fmt = (n: number) => (n ? n.toLocaleString("da-DK", { maximumFractionDigits: 2 }) : "");
const total = (cells: string[]) => cells.reduce((s, c) => s + (parseNumber(c) ?? 0), 0);

export function BudgetEditor({
  year,
  targets,
  items,
}: {
  year: number;
  targets: number[];
  items: { id: string; name: string; amounts: number[] }[];
}) {
  const [target, setTarget] = useState<string[]>(targets.map(fmt));
  const [rows, setRows] = useState<Row[]>(
    items.map((i) => ({ key: i.id, id: i.id, name: i.name, cells: i.amounts.map(fmt) })),
  );
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const touch = () => {
    setDirty(true);
    setMsg(null);
  };

  function setCell(rowKey: string | "target", i: number, v: string) {
    touch();
    if (rowKey === "target") setTarget((t) => t.map((x, j) => (j === i ? v : x)));
    else setRows((rs) => rs.map((r) => (r.key === rowKey ? { ...r, cells: r.cells.map((x, j) => (j === i ? v : x)) } : r)));
  }

  function fillRow(rowKey: string | "target") {
    const v = window.prompt("Beløb pr. måned (fylder alle 12 måneder):");
    if (v == null) return;
    const n = parseNumber(v);
    if (n == null) return;
    const cells = Array(12).fill(fmt(n));
    touch();
    if (rowKey === "target") setTarget(cells);
    else setRows((rs) => rs.map((r) => (r.key === rowKey ? { ...r, cells } : r)));
  }

  function addRow() {
    touch();
    setRows((rs) => [...rs, { key: `ny-${Date.now()}`, id: null, name: "", cells: Array(12).fill("") }]);
  }

  function removeRow(r: Row) {
    if (r.id && !window.confirm(`Slet posten "${r.name}" og alle dens beløb (alle år)?`)) return;
    setRows((rs) => rs.filter((x) => x.key !== r.key));
    if (r.id) start(async () => void (await deleteCostItem(r.id!)));
  }

  function save() {
    const bad = [...target, ...rows.flatMap((r) => r.cells)].some((c) => c.trim() && parseNumber(c) == null);
    if (bad) return setMsg({ ok: false, text: "Et eller flere felter er ikke et tal." });
    start(async () => {
      const res = await saveBudget({
        year,
        targets: target.map((c) => parseNumber(c) ?? 0),
        items: rows
          .filter((r) => r.name.trim())
          .map((r) => ({ id: r.id, name: r.name.trim(), amounts: r.cells.map((c) => parseNumber(c) ?? 0) })),
      });
      if (res.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: "Budgettet er gemt" });
        setDirty(false);
      }
    });
  }

  const costTotals = MONTH_NAMES.map((_, i) => rows.reduce((s, r) => s + (parseNumber(r.cells[i]) ?? 0), 0));
  const cell = "input w-24 px-2 py-1 text-right tabular-nums md:text-sm";

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Budget {year}</h2>
          <p className="text-xs text-stone-500">Beløb i kr. pr. måned. Klik &quot;Alle mdr.&quot; for at fylde en række med samme beløb.</p>
        </div>
        <div className="flex items-center gap-3">
          {msg && (
            <span className={`flex items-center gap-1 text-xs ${msg.ok ? "text-accent" : "text-red-700"}`}>
              {msg.ok && <Check size={13} />} {msg.text}
            </span>
          )}
          <button className="btn-primary" onClick={save} disabled={pending || !dirty}>
            {pending ? "Gemmer…" : dirty ? "Gem budget" : "Gemt"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead className="text-xs text-stone-500">
            <tr>
              <th className="sticky left-0 z-10 bg-white px-4 py-2 text-left font-medium">Post</th>
              {MONTH_NAMES.map((m) => (
                <th key={m} className="px-1 py-2 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="px-4 py-2 text-right font-medium">I alt</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr className="bg-accent-soft/40">
              <td className="sticky left-0 z-10 bg-[#f3f7f5] px-4 py-1.5">
                <div className="w-40 font-medium">Omsætningsmål</div>
                <button className="text-xs text-accent underline" onClick={() => fillRow("target")}>
                  Alle mdr.
                </button>
              </td>
              {target.map((c, i) => (
                <td key={i} className="px-1 py-1.5">
                  <input className={cell} inputMode="decimal" value={c} onChange={(e) => setCell("target", i, e.target.value)} aria-label={`Omsætningsmål ${MONTH_NAMES[i]}`} />
                </td>
              ))}
              <td className="px-4 py-1.5 text-right font-medium tabular-nums">{total(target).toLocaleString("da-DK")}</td>
              <td />
            </tr>

            <tr>
              <td colSpan={15} className="px-4 pb-1 pt-4 text-xs font-medium text-stone-500">
                Omkostninger
              </td>
            </tr>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-stone-100">
                <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                  <input
                    className="input w-40 px-2 py-1 md:text-sm"
                    placeholder="Fx Løn"
                    value={r.name}
                    onChange={(e) => {
                      touch();
                      setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)));
                    }}
                    aria-label="Navn på post"
                  />
                  <button className="text-xs text-accent underline" onClick={() => fillRow(r.key)}>
                    Alle mdr.
                  </button>
                </td>
                {r.cells.map((c, i) => (
                  <td key={i} className="px-1 py-1.5">
                    <input className={cell} inputMode="decimal" value={c} onChange={(e) => setCell(r.key, i, e.target.value)} aria-label={`${r.name || "Post"} ${MONTH_NAMES[i]}`} />
                  </td>
                ))}
                <td className="px-4 py-1.5 text-right tabular-nums">{total(r.cells).toLocaleString("da-DK")}</td>
                <td className="pr-3">
                  <button onClick={() => removeRow(r)} className="btn-ghost p-1 text-stone-400 hover:text-red-700" aria-label={`Slet ${r.name || "post"}`}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-stone-200 text-xs text-stone-600">
              <td className="sticky left-0 z-10 bg-white px-4 py-2 font-medium">Omkostninger i alt</td>
              {costTotals.map((t, i) => (
                <td key={i} className="px-1 py-2 pr-3 text-right tabular-nums">
                  {t ? t.toLocaleString("da-DK") : "–"}
                </td>
              ))}
              <td className="px-4 py-2 text-right font-medium tabular-nums">
                {costTotals.reduce((s, x) => s + x, 0).toLocaleString("da-DK")}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="border-t border-stone-100 px-4 py-3">
        <button className="flex items-center gap-1 text-sm font-medium text-accent" onClick={addRow}>
          <Plus size={15} /> Tilføj omkostningspost
        </button>
      </div>
    </section>
  );
}
