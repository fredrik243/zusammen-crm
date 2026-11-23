"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { ChevronDown, ChevronRight, TriangleAlert, Trash2, Plus, Ban, CheckCircle2 } from "lucide-react";
import { parseRows, fold, type ImportCompany } from "@/lib/import/parse";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/labels";
import { runImport } from "./actions";

type MemberLite = { id: string; name: string; initials: string };
const EDITABLE_TYPES: ActivityType[] = [
  "mail_sent", "reminder_sent", "linkedin_message", "reply_received", "meeting_booked", "meeting_held", "rejection",
];

export function ImportClient({
  members,
  stages,
  existing,
}: {
  members: MemberLite[];
  stages: string[];
  existing: string[];
}) {
  const [rows, setRows] = useState<ImportCompany[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [filter, setFilter] = useState<"alle" | "advarsler">("alle");
  const [result, setResult] = useState<{ created?: number; skipped?: string[]; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const existingSet = useMemo(() => new Set(existing), [existing]);

  function onFile(file: File) {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: false,
      complete: ({ data }) => {
        const parsed = parseRows(data);
        setRows(parsed);
        const keys = [...new Set(parsed.map((r) => r.owner_key).filter(Boolean))];
        const map: Record<string, string> = {};
        for (const k of keys) {
          const m = members.find((m) => fold(m.name).split(" ").includes(fold(k)));
          map[k] = m?.id ?? "";
        }
        setOwnerMap(map);
      },
    });
  }

  const update = (i: number, fn: (c: ImportCompany) => ImportCompany) =>
    setRows((rs) => rs!.map((r, j) => (j === i ? fn(structuredClone(r)) : r)));

  if (result?.created !== undefined) {
    return (
      <div className="card space-y-3 p-6">
        <div className="flex items-center gap-2 text-lg font-medium text-accent">
          <CheckCircle2 /> {result.created} virksomheder importeret
        </div>
        {result.skipped && result.skipped.length > 0 && (
          <p className="text-sm text-stone-600">Sprunget over, fordi de allerede fandtes: {result.skipped.join(", ")}</p>
        )}
        <Link href="/virksomheder" className="btn-primary">
          Gå til kontaktbanken
        </Link>
      </div>
    );
  }

  if (!rows) {
    return (
      <label className="card flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-10 text-center hover:bg-stone-50">
        <span className="font-medium">Vælg bruttoliste.csv</span>
        <span className="text-sm text-stone-500">Kolonner: Virksomhed, Status, Person, Kontaktoplysninger, Next step, Ansvarlig, Kategori</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
    );
  }

  const isDup = (r: ImportCompany) => existingSet.has(r.name.toLowerCase());
  const selected = rows.filter((r) => r.include && !isDup(r));
  const count = (f: (r: ImportCompany) => number) => selected.reduce((s, r) => s + f(r), 0);
  const visible = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => filter === "alle" || r.warnings.length > 0 || isDup(r));

  function submit() {
    const payload = {
      companies: selected.map((r) => {
        const owner = ownerMap[r.owner_key] || null;
        return {
          name: r.name.trim(),
          stage: r.stage,
          category: r.category.trim(),
          owner_id: owner,
          general_email: r.general_email,
          do_not_contact: r.do_not_contact,
          do_not_contact_reason: r.do_not_contact_reason,
          source: r.source,
          contacts: r.contacts.filter((c) => c.name.trim()),
          tasks: r.tasks.filter((t) => t.title.trim()).map((t) => ({ ...t, assignee_id: owner })),
          activities: r.activities.map((a) => ({ ...a, member_id: owner })),
        };
      }),
    };
    start(async () => setResult(await runImport(payload)));
  }

  return (
    <div className="space-y-4">
      {/* Opsummering */}
      <div className="card grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="text-sm text-stone-500">{fileName}</div>
          <div className="mt-1 text-sm">
            <b>{selected.length}</b> virksomheder · <b>{count((r) => r.contacts.length)}</b> personer ·{" "}
            <b>{count((r) => r.tasks.length)}</b> opgaver · <b>{count((r) => r.activities.length)}</b> aktiviteter
            {" · "}
            <b>{selected.filter((r) => r.do_not_contact).length}</b> med &quot;Kontakt ikke igen&quot;
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            {Object.keys(ownerMap).map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <span className="text-stone-500">&quot;{k}&quot; er</span>
                <select
                  className="input w-auto py-1"
                  value={ownerMap[k]}
                  onChange={(e) => setOwnerMap({ ...ownerMap, [k]: e.target.value })}
                >
                  <option value="">Ingen</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setRows(null)}>
            Vælg anden fil
          </button>
          <button className="btn-primary" disabled={pending || selected.length === 0} onClick={submit}>
            {pending ? "Importerer…" : `Importér ${selected.length} virksomheder`}
          </button>
        </div>
        {result?.error && <p className="text-sm text-red-700 md:col-span-2">Importen fejlede, og intet blev gemt: {result.error}</p>}
      </div>

      <div className="flex gap-1 text-sm">
        {(["alle", "advarsler"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 ${filter === f ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-200"}`}
          >
            {f === "alle" ? `Alle (${rows.length})` : `Kræver opmærksomhed (${rows.filter((r) => r.warnings.length || isDup(r)).length})`}
          </button>
        ))}
        <button
          className="ml-auto text-xs text-stone-500 underline"
          onClick={() => setOpen(Object.fromEntries(rows.map((_, i) => [i, !Object.values(open).some(Boolean)])))}
        >
          Fold alle ud / ind
        </button>
      </div>

      <ul className="space-y-2">
        {visible.map(({ r, i }) => {
          const dup = isDup(r);
          return (
            <li key={r.ref} className={`card ${!r.include || dup ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={r.include && !dup}
                  disabled={dup}
                  onChange={(e) => update(i, (c) => ({ ...c, include: e.target.checked }))}
                  aria-label={`Medtag ${r.name}`}
                />
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen({ ...open, [i]: !open[i] })}>
                  {open[i] ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
                  <span className="truncate font-medium">{r.name}</span>
                  {r.do_not_contact && <Ban size={14} className="shrink-0 text-red-600" />}
                  {dup && <span className="shrink-0 rounded bg-stone-200 px-1.5 text-xs">findes allerede</span>}
                  {r.warnings.length > 0 && <TriangleAlert size={14} className="shrink-0 text-amber-600" />}
                </button>
                <span className="hidden text-xs text-stone-500 sm:inline">
                  {r.stage} · {r.category || "–"} · {r.contacts.length} pers. · {r.tasks.length} opg. · {r.activities.length} akt.
                </span>
              </div>

              {open[i] && (
                <div className="space-y-4 border-t border-stone-100 px-3 py-3 text-sm">
                  <div className="rounded bg-stone-50 p-2 text-xs text-stone-500">
                    <b>Fra CSV (række {r.ref}):</b> {r.source.Person || "–"} · {r.source.Kontaktoplysninger || "–"} ·{" "}
                    {r.source["Next step"] || "–"}
                  </div>
                  {r.warnings.map((w) => (
                    <p key={w} className="flex items-center gap-1.5 text-amber-800">
                      <TriangleAlert size={14} /> {w}
                    </p>
                  ))}

                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="Navn">
                      <input className="input" value={r.name} onChange={(e) => update(i, (c) => ({ ...c, name: e.target.value }))} />
                    </Field>
                    <Field label="Fase">
                      <select className="input" value={r.stage} onChange={(e) => update(i, (c) => ({ ...c, stage: e.target.value }))}>
                        {stages.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Kategori">
                      <input className="input" value={r.category} onChange={(e) => update(i, (c) => ({ ...c, category: e.target.value }))} />
                    </Field>
                  </div>

                  <div>
                    <div className="label">Personer</div>
                    <div className="space-y-2">
                      {r.contacts.map((p, k) => (
                        <div key={k} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                          <input className="input" placeholder="Navn" value={p.name}
                            onChange={(e) => update(i, (c) => { c.contacts[k].name = e.target.value; return c; })} />
                          <input className="input max-sm:col-start-1" placeholder="Titel" value={p.title}
                            onChange={(e) => update(i, (c) => { c.contacts[k].title = e.target.value; return c; })} />
                          <input className="input max-sm:col-start-1" placeholder="E-mail" value={p.email}
                            onChange={(e) => update(i, (c) => { c.contacts[k].email = e.target.value; return c; })} />
                          <button className="btn-ghost px-2 max-sm:col-start-2 max-sm:row-start-1" aria-label="Fjern person"
                            onClick={() => update(i, (c) => { c.contacts.splice(k, 1); return c; })}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button className="flex items-center gap-1 text-xs text-accent"
                        onClick={() => update(i, (c) => { c.contacts.push({ name: "", title: "", email: "" }); return c; })}>
                        <Plus size={13} /> Tilføj person
                      </button>
                    </div>
                  </div>

                  <Field label="Generel e-mail (ikke knyttet til en person)">
                    <input className="input" value={r.general_email} onChange={(e) => update(i, (c) => ({ ...c, general_email: e.target.value }))} />
                  </Field>

                  <div>
                    <div className="label">Opgaver</div>
                    <div className="space-y-2">
                      {r.tasks.map((t, k) => (
                        <div key={k} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_10rem_auto]">
                          <input className="input" value={t.title}
                            onChange={(e) => update(i, (c) => { c.tasks[k].title = e.target.value; return c; })} />
                          <input type="date" className="input max-sm:col-start-1" value={t.due_date}
                            onChange={(e) => update(i, (c) => { c.tasks[k].due_date = e.target.value; return c; })} />
                          <button className="btn-ghost px-2 max-sm:col-start-2 max-sm:row-start-1" aria-label="Fjern opgave"
                            onClick={() => update(i, (c) => { c.tasks.splice(k, 1); return c; })}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {r.tasks.length === 0 && <p className="text-xs text-stone-400">Ingen opgave.</p>}
                    </div>
                  </div>

                  <div>
                    <div className="label">Aktiviteter</div>
                    <div className="space-y-2">
                      {r.activities.map((a, k) => (
                        <div key={k} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[12rem_10rem_1fr_auto]">
                          <select className="input" value={a.type}
                            onChange={(e) => update(i, (c) => { c.activities[k].type = e.target.value as ActivityType; return c; })}>
                            {EDITABLE_TYPES.map((t) => (
                              <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>
                            ))}
                          </select>
                          <input type="date" className="input max-sm:col-start-1" value={a.date} title="Tom = dato ukendt"
                            onChange={(e) => update(i, (c) => { c.activities[k].date = e.target.value; return c; })} />
                          <span className="text-xs text-stone-400 max-sm:col-start-1">
                            {a.date ? "" : "Dato ukendt · "}
                            {a.source === "import_status" ? "udledt af status" : "fra Next step"}
                          </span>
                          <button className="btn-ghost px-2 max-sm:col-start-2 max-sm:row-start-1" aria-label="Fjern aktivitet"
                            onClick={() => update(i, (c) => { c.activities.splice(k, 1); return c; })}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4" checked={r.do_not_contact}
                      onChange={(e) => update(i, (c) => ({ ...c, do_not_contact: e.target.checked }))} />
                    Kontakt ikke igen
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}
