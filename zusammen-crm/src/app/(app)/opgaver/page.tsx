import Link from "next/link";
import { getLookups, getSession } from "@/lib/data";
import { addDays, todayISO } from "@/lib/labels";
import { NewTaskForm, TaskList, type TaskItem } from "@/components/TaskList";

type Raw = Omit<TaskItem, "company_name"> & { completed_at: string | null; company: { name: string } | null };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ visning?: string; ansvarlig?: string }>;
}) {
  const sp = await searchParams;
  const all = sp.visning === "alle";
  const { supabase, me } = await getSession();
  const { members } = await getLookups();
  const today = todayISO();
  const dow = (new Date(today + "T12:00:00Z").getUTCDay() + 6) % 7; // mandag = 0
  const sunday = addDays(today, 6 - dow);
  const since = addDays(today, -14);

  let query = supabase
    .from("tasks")
    .select("id,title,due_date,status,assignee_id,company_id,deal_id,completed_at, company:companies(name)")
    .or(`status.eq.open,completed_at.gte.${since}`)
    .order("due_date", { ascending: true, nullsFirst: false });

  const who = all ? sp.ansvarlig : me?.id;
  if (who === "ingen") query = query.is("assignee_id", null);
  else if (who) query = query.eq("assignee_id", who);

  const [{ data, error }, { data: companies }] = await Promise.all([
    query,
    supabase.from("companies").select("id,name").order("name"),
  ]);
  const tasks: (TaskItem & { completed_at: string | null })[] = ((data ?? []) as unknown as Raw[]).map((t) => ({
    ...t,
    company_name: t.company?.name ?? null,
  }));

  const open = tasks.filter((t) => t.status === "open");
  const groups: { title: string; tone?: string; items: TaskItem[] }[] = [
    { title: "Forfaldne", tone: "text-red-700", items: open.filter((t) => t.due_date && t.due_date < today) },
    { title: "I dag", items: open.filter((t) => t.due_date === today) },
    { title: "Resten af ugen", items: open.filter((t) => t.due_date && t.due_date > today && t.due_date <= sunday) },
    { title: "Senere", items: open.filter((t) => t.due_date && t.due_date > sunday) },
    { title: "Uden dato", tone: "text-amber-800", items: open.filter((t) => !t.due_date) },
  ];
  const done = tasks
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
  const memberLite = members.map((m) => ({ id: m.id, name: m.name, initials: m.initials }));

  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-200"}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Opgaver</h1>
        <div className="flex gap-1">
          <Link href="/opgaver" className={tab(!all)}>
            Mine opgaver
          </Link>
          <Link href="/opgaver?visning=alle" className={tab(all)}>
            Alle opgaver
          </Link>
        </div>
      </div>

      {all && (
        <div className="flex flex-wrap gap-1 text-sm">
          <Link href="/opgaver?visning=alle" className={tab(!sp.ansvarlig)}>
            Alle
          </Link>
          {members.map((m) => (
            <Link key={m.id} href={`/opgaver?visning=alle&ansvarlig=${m.id}`} className={tab(sp.ansvarlig === m.id)}>
              {m.name.split(" ")[0]}
            </Link>
          ))}
          <Link href="/opgaver?visning=alle&ansvarlig=ingen" className={tab(sp.ansvarlig === "ingen")}>
            Ingen ansvarlig
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-red-700">Kunne ikke hente opgaver: {error.message}</p>}

      <details className="card px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent">+ Ny opgave</summary>
        <div className="mt-3">
          <NewTaskForm members={memberLite} defaultAssignee={me?.id ?? null} companies={companies ?? []} today={today} />
        </div>
      </details>

      {open.length === 0 && (
        <div className="card p-8 text-center text-sm text-stone-500">Ingen åbne opgaver. Godt gået.</div>
      )}

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.title} className="card">
            <h2 className={`flex items-baseline justify-between border-b border-stone-100 px-4 py-3 text-sm font-semibold ${g.tone ?? ""}`}>
              {g.title}
              <span className="text-xs font-normal text-stone-400">{g.items.length}</span>
            </h2>
            <TaskList tasks={g.items} members={memberLite} today={today} showCompany />
          </section>
        ))}

      {done.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm text-stone-500">
            Udført de seneste 14 dage ({done.length})
          </summary>
          <TaskList tasks={done} members={memberLite} today={today} showCompany />
        </details>
      )}
    </div>
  );
}
