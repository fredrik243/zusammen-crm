import { getLookups, getSession } from "@/lib/data";
import { todayISO } from "@/lib/labels";
import { Board, type BoardDeal } from "./Board";

type Raw = {
  id: string;
  title: string;
  stage_id: string;
  owner_id: string | null;
  value: number | null;
  position: number;
  company: {
    id: string;
    name: string;
    category_id: string | null;
    do_not_contact: boolean;
    tasks: { title: string; due_date: string | null; status: string }[];
    contacts: { name: string }[];
  } | null;
  contact: { name: string } | null;
};

export default async function PipelinePage() {
  const { supabase } = await getSession();
  const { stages, members, categories } = await getLookups();
  const { data, error } = await supabase
    .from("deals")
    .select(
      "id,title,stage_id,owner_id,value,position, company:companies(id,name,category_id,do_not_contact, tasks(title,due_date,status), contacts(name)), contact:contacts(name)",
    )
    .order("position");

  const today = todayISO();
  const memberById = new Map(members.map((m) => [m.id, m]));
  const deals: BoardDeal[] = ((data ?? []) as unknown as Raw[])
    .filter((d) => d.company)
    .map((d) => {
      const open = d.company!.tasks.filter((t) => t.status === "open");
      const dated = open.filter((t) => t.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
      const next = dated[0] ?? open[0] ?? null;
      return {
        id: d.id,
        stageId: d.stage_id,
        position: d.position,
        companyId: d.company!.id,
        companyName: d.company!.name,
        categoryId: d.company!.category_id,
        doNotContact: d.company!.do_not_contact,
        contactName: d.contact?.name ?? d.company!.contacts[0]?.name ?? null,
        ownerId: d.owner_id,
        ownerInitials: memberById.get(d.owner_id ?? "")?.initials ?? null,
        ownerName: memberById.get(d.owner_id ?? "")?.name ?? null,
        value: d.value == null ? null : Number(d.value),
        nextTitle: next?.title ?? null,
        nextDate: next?.due_date ?? null,
        overdue: !!next?.due_date && next.due_date < today,
        planned: dated.length > 0,
      };
    });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <p className="text-sm text-stone-500">Træk et kort til en ny fase. Flytningen bliver logget på virksomheden.</p>
      </div>
      {error && <p className="text-sm text-red-700">Kunne ikke hente deals: {error.message}</p>}
      <Board
        stages={stages}
        initialDeals={deals}
        members={members.map((m) => ({ id: m.id, name: m.name }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
