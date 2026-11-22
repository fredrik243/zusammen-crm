import Link from "next/link";
import { Suspense } from "react";
import { Plus, Download, Ban, CalendarClock, CircleAlert } from "lucide-react";
import { getLookups, getSession, type Company, type Contact, type Task } from "@/lib/data";
import { FilterBar } from "@/components/FilterBar";
import { StageBadge, Initials } from "@/components/Badges";
import { fold } from "@/lib/import/parse";
import { formatDate, todayISO } from "@/lib/labels";

type Row = Company & {
  contacts: Pick<Contact, "name" | "email">[];
  deals: { stage_id: string }[];
  tasks: Pick<Task, "title" | "due_date" | "status">[];
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { supabase } = await getSession();
  const { categories, stages, members } = await getLookups();

  const { data } = await supabase
    .from("companies")
    .select("*, contacts(name,email), deals(stage_id), tasks(title,due_date,status)")
    .order("name");
  let rows = (data ?? []) as Row[];

  const q = fold(sp.q ?? "");
  if (q) {
    rows = rows.filter((r) =>
      fold([r.name, r.general_email, ...r.contacts.flatMap((c) => [c.name, c.email])].join(" ")).includes(q),
    );
  }
  if (sp.kategori) rows = rows.filter((r) => r.category_id === sp.kategori);
  if (sp.ansvarlig) rows = rows.filter((r) => (sp.ansvarlig === "ingen" ? !r.owner_id : r.owner_id === sp.ansvarlig));
  if (sp.fase) rows = rows.filter((r) => r.deals.some((d) => d.stage_id === sp.fase));

  const today = todayISO();
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const catById = new Map(categories.map((c) => [c.id, c.name]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const view = rows.map((r) => {
    const open = r.tasks.filter((t) => t.status === "open");
    const dated = open.filter((t) => t.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    const stage = stageById.get(r.deals[0]?.stage_id ?? "");
    return {
      ...r,
      stage,
      next: dated[0] ?? open[0] ?? null,
      planned: dated.length > 0,
      closed: stage?.kind !== "open",
      owner: memberById.get(r.owner_id ?? ""),
      category: catById.get(r.category_id ?? "") ?? "",
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Kontaktbank</h1>
          <p className="text-sm text-stone-500">{view.length} virksomheder</p>
        </div>
        <div className="flex gap-2">
          <a href="/eksport" className="btn-secondary">
            <Download size={16} /> <span className="hidden sm:inline">Eksportér CSV</span>
          </a>
          <Link href="/virksomheder/ny" className="btn-primary">
            <Plus size={16} /> <span className="hidden sm:inline">Ny virksomhed</span>
          </Link>
        </div>
      </div>

      <Suspense>
        <FilterBar
          filters={[
            { key: "kategori", label: "Alle kategorier", options: categories.map((c) => ({ value: c.id, label: c.name })) },
            {
              key: "ansvarlig",
              label: "Alle ansvarlige",
              options: [...members.map((m) => ({ value: m.id, label: m.name })), { value: "ingen", label: "Ingen ansvarlig" }],
            },
            { key: "fase", label: "Alle faser", options: stages.map((s) => ({ value: s.id, label: s.name })) },
          ]}
        />
      </Suspense>

      {view.length === 0 && (
        <div className="card p-8 text-center text-sm text-stone-500">
          Ingen virksomheder. <Link href="/import" className="text-accent underline">Importér bruttolisten</Link> eller
          opret en ny.
        </div>
      )}

      {/* Mobil: kort */}
      <ul className="space-y-2 md:hidden">
        {view.map((r) => (
          <li key={r.id}>
            <Link href={`/virksomheder/${r.id}`} className="card block p-3 active:bg-stone-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    {r.do_not_contact && <Ban size={14} className="shrink-0 text-red-600" />}
                    <span className="truncate">{r.name}</span>
                  </div>
                  <div className="truncate text-xs text-stone-500">
                    {[r.category, r.contacts[0]?.name].filter(Boolean).join(" · ") || "–"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StageBadge stage={r.stage} />
                  <Initials text={r.owner?.initials} title={r.owner?.name} />
                </div>
              </div>
              <NextTask next={r.next} planned={r.planned} closed={r.closed || r.do_not_contact} today={today} />
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: tabel */}
      {view.length > 0 && (
        <div className="card hidden overflow-hidden md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Virksomhed</th>
                <th className="px-4 py-2 font-medium">Kategori</th>
                <th className="px-4 py-2 font-medium">Fase</th>
                <th className="px-4 py-2 font-medium">Ansvarlig</th>
                <th className="px-4 py-2 font-medium">Næste skridt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {view.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/virksomheder/${r.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                      {r.do_not_contact && <Ban size={14} className="text-red-600" aria-label="Kontakt ikke igen" />}
                      {r.name}
                    </Link>
                    <div className="text-xs text-stone-500">{r.contacts.map((c) => c.name).join(", ") || "–"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-stone-600">{r.category || "–"}</td>
                  <td className="px-4 py-2.5">
                    <StageBadge stage={r.stage} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Initials text={r.owner?.initials} title={r.owner?.name} />
                  </td>
                  <td className="max-w-xs px-4 py-2.5">
                    <NextTask next={r.next} planned={r.planned} closed={r.closed || r.do_not_contact} today={today} compact />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NextTask({
  next,
  planned,
  closed,
  today,
  compact,
}: {
  next: Pick<Task, "title" | "due_date"> | null;
  planned: boolean;
  closed: boolean;
  today: string;
  compact?: boolean;
}) {
  const overdue = next?.due_date && next.due_date < today;
  return (
    <div className={`${compact ? "" : "mt-2"} flex items-start gap-1.5 text-xs`}>
      {next ? (
        <>
          <CalendarClock size={14} className={`mt-px shrink-0 ${overdue ? "text-red-600" : "text-stone-400"}`} />
          <span className="line-clamp-2 text-stone-700">
            {next.due_date && (
              <span className={`mr-1 font-medium ${overdue ? "text-red-700" : ""}`}>{formatDate(next.due_date, false)}</span>
            )}
            {next.title}
          </span>
        </>
      ) : null}
      {!planned && !closed && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
          <CircleAlert size={12} /> Intet planlagt
        </span>
      )}
    </div>
  );
}
