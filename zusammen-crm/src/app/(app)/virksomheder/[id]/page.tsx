import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Ban, Globe, Mail, Phone, Link2, Pencil, Plus, Trash2,
} from "lucide-react";
import { getLookups, getSession, type Activity, type Company, type Contact, type Deal, type Task } from "@/lib/data";
import { CompanyForm } from "@/components/CompanyForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StageBadge, Initials } from "@/components/Badges";
import { ACTIVITY_LABELS, formatDate, todayISO } from "@/lib/labels";
import { deleteCompany, deleteContact, saveContact, updateCompany, updateDeal } from "../actions";
import { deleteActivity } from "@/lib/actions";
import { TaskList, NewTaskForm, type TaskItem } from "@/components/TaskList";
import { ActivityQuickLog } from "@/components/ActivityQuickLog";

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rediger?: string }>;
}) {
  const { id } = await params;
  const { rediger } = await searchParams;
  const { supabase, me } = await getSession();
  const { categories, stages, members } = await getLookups();

  const [{ data: company }, { data: contacts }, { data: deals }, { data: tasks }, { data: activities }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", id).maybeSingle(),
      supabase.from("contacts").select("*").eq("company_id", id).order("created_at"),
      supabase.from("deals").select("*").eq("company_id", id).order("created_at"),
      supabase.from("tasks").select("*").eq("company_id", id).order("due_date", { nullsFirst: false }),
      supabase.from("activities").select("*").eq("company_id", id).order("occurred_at", { ascending: false, nullsFirst: false }),
    ]);
  if (!company) notFound();
  const c = company as Company;

  const memberById = new Map(members.map((m) => [m.id, m]));
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const category = categories.find((x) => x.id === c.category_id)?.name;
  const owner = memberById.get(c.owner_id ?? "");
  const today = todayISO();
  const openTasks = ((tasks ?? []) as Task[]).filter((t) => t.status === "open");
  const doneTasks = ((tasks ?? []) as Task[]).filter((t) => t.status === "done");
  const people = (contacts ?? []) as Contact[];
  const contactById = new Map(people.map((p) => [p.id, p]));
  const memberLite = members.map((m) => ({ id: m.id, name: m.name, initials: m.initials }));
  const toItem = (t: Task): TaskItem => ({ ...t, company_name: c.name });

  if (rediger) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-semibold">Redigér {c.name}</h1>
        <div className="card p-4 md:p-6">
          <CompanyForm
            action={updateCompany}
            company={c}
            categories={categories}
            members={members}
            cancelHref={`/virksomheder/${c.id}`}
          />
        </div>
        <form action={deleteCompany} className="text-right">
          <input type="hidden" name="id" value={c.id} />
          <ConfirmButton
            message={`Slet ${c.name} med alle personer, deals, opgaver og aktiviteter? Det kan ikke fortrydes.`}
            className="btn-ghost text-red-700"
          >
            <Trash2 size={16} /> Slet virksomhed
          </ConfirmButton>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/virksomheder" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={14} /> Kontaktbank
      </Link>

      {/* Hoved */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500">
            {category && <span>{category}</span>}
            <span className="flex items-center gap-1.5">
              <Initials text={owner?.initials} /> {owner?.name ?? "Ingen ansvarlig"}
            </span>
            {c.website && (
              <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-accent">
                <Globe size={14} /> {c.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {c.general_email && (
              <span className="flex items-center gap-1">
                <Mail size={14} />
                {c.general_email.split(",").map((e, i) => (
                  <a key={i} href={`mailto:${e.trim()}`} className="hover:text-accent">
                    {e.trim()}
                    {i < c.general_email!.split(",").length - 1 ? ", " : ""}
                  </a>
                ))}
              </span>
            )}
          </div>
        </div>
        <Link href={`/virksomheder/${c.id}?rediger=1`} className="btn-secondary">
          <Pencil size={14} /> Redigér
        </Link>
      </div>

      {c.do_not_contact && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <Ban size={18} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Kontakt ikke igen</div>
            {c.do_not_contact_reason && <div className="text-red-700">{c.do_not_contact_reason}</div>}
          </div>
        </div>
      )}

      {c.notes && <p className="card whitespace-pre-wrap p-4 text-sm text-stone-700">{c.notes}</p>}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          {/* Personer */}
          <section className="card">
            <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Personer</h2>
            <ul className="divide-y divide-stone-100">
              {people.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{p.name}</div>
                        {p.title && <div className="text-xs text-stone-500">{p.title}</div>}
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                          {p.email && (
                            <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-accent">
                              <Mail size={13} /> {p.email}
                            </a>
                          )}
                          {p.phone && (
                            <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-accent">
                              <Phone size={13} /> {p.phone}
                            </a>
                          )}
                          {p.linkedin_url && (
                            <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-accent">
                              <Link2 size={13} /> LinkedIn
                            </a>
                          )}
                        </div>
                      </div>
                      <Pencil size={14} className="mt-1 shrink-0 text-stone-400 group-open:text-accent" />
                    </summary>
                    <ContactForm companyId={c.id} contact={p} />
                    <form action={deleteContact} className="mt-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="company_id" value={c.id} />
                      <ConfirmButton message={`Slet ${p.name}?`} className="btn-ghost px-0 text-xs text-red-700">
                        <Trash2 size={13} /> Slet person
                      </ConfirmButton>
                    </form>
                  </details>
                </li>
              ))}
              {people.length === 0 && <li className="px-4 py-3 text-sm text-stone-500">Ingen personer endnu.</li>}
            </ul>
            <details className="border-t border-stone-100 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent">
                <Plus size={15} /> Tilføj person
              </summary>
              <ContactForm companyId={c.id} />
            </details>
          </section>

          {/* Deals */}
          <section className="card">
            <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Deals</h2>
            <ul className="divide-y divide-stone-100">
              {((deals ?? []) as Deal[]).map((d) => {
                const stage = stageById.get(d.stage_id);
                return (
                  <li key={d.id} className="px-4 py-3 text-sm">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <span className="min-w-0 truncate">{d.title}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          {d.value != null && (
                            <span className="text-stone-600">{Number(d.value).toLocaleString("da-DK")} kr.</span>
                          )}
                          <StageBadge stage={stage} />
                          <Pencil size={13} className="text-stone-400" />
                        </span>
                      </summary>
                      <form action={updateDeal} className="mt-3 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="company_id" value={c.id} />
                        <label className="sm:col-span-2">
                          <span className="label">Titel</span>
                          <input name="title" defaultValue={d.title} className="input" />
                        </label>
                        <label>
                          <span className="label">Fase</span>
                          <select name="stage_id" defaultValue={d.stage_id} className="input">
                            {stages.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="label">Ansvarlig</span>
                          <select name="owner_id" defaultValue={d.owner_id ?? ""} className="input">
                            <option value="">Ingen</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span className="label">Dealværdi (kr.)</span>
                          <input name="value" inputMode="decimal" defaultValue={d.value ?? ""} className="input" />
                        </label>
                        <label>
                          <span className="label">Sandsynlighed (%)</span>
                          <input
                            name="probability"
                            inputMode="numeric"
                            defaultValue={d.probability ?? ""}
                            placeholder={`${stage?.default_probability ?? 0} (fasens standard)`}
                            className="input"
                          />
                        </label>
                        <label>
                          <span className="label">Forventet lukkedato</span>
                          <input type="date" name="expected_close_date" defaultValue={d.expected_close_date ?? ""} className="input" />
                        </label>
                        <div className="flex items-end">
                          <button className="btn-primary">Gem deal</button>
                        </div>
                      </form>
                    </details>
                  </li>
                );
              })}
              {(deals ?? []).length === 0 && <li className="px-4 py-3 text-sm text-stone-500">Ingen deals.</li>}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          {/* Opgaver */}
          <section className="card">
            <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Opgaver</h2>
            <TaskList
              tasks={openTasks.map(toItem)}
              members={memberLite}
              today={today}
              emptyText={c.do_not_contact ? undefined : "Intet planlagt næste skridt."}
            />
            <details className="border-t border-stone-100 px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent">
                <Plus size={15} /> Ny opgave
              </summary>
              <div className="mt-3">
                <NewTaskForm members={memberLite} defaultAssignee={c.owner_id ?? me?.id ?? null} companyId={c.id} today={today} />
              </div>
            </details>
            {doneTasks.length > 0 && (
              <details className="border-t border-stone-100">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs text-stone-500">
                  {doneTasks.length} udførte opgaver
                </summary>
                <TaskList tasks={doneTasks.map(toItem)} members={memberLite} today={today} />
              </details>
            )}
          </section>

          {/* Tidslinje */}
          <section className="card">
            <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Aktiviteter</h2>
            <ActivityQuickLog companyId={c.id} dealId={(deals ?? [])[0]?.id ?? null} />
            <ol className="space-y-0 border-t border-stone-100 px-4 py-3">
              {((activities ?? []) as Activity[]).map((a) => (
                <li key={a.id} className="relative border-l border-stone-200 pb-4 pl-4 pr-6 last:pb-0">
                  <span className="absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">
                      {a.type === "stage_changed"
                        ? `Flyttet til ${stageById.get(a.to_stage_id ?? "")?.name ?? "?"}`
                        : ACTIVITY_LABELS[a.type]}
                    </span>
                    <span className={`text-xs ${a.occurred_at ? "text-stone-500" : "italic text-stone-400"}`}>
                      {formatDate(a.occurred_at)}
                    </span>
                    {memberById.get(a.member_id ?? "") && (
                      <span className="text-xs text-stone-400">· {memberById.get(a.member_id!)!.initials}</span>
                    )}
                    {a.contact_id && contactById.get(a.contact_id) && (
                      <span className="text-xs text-stone-400">· {contactById.get(a.contact_id)!.name}</span>
                    )}
                  </div>
                  {a.note && <p className="mt-0.5 text-xs text-stone-500">{a.note}</p>}
                  {a.source === "manual" && (
                    <form action={deleteActivity.bind(null, a.id, c.id)} className="absolute right-0 top-0">
                      <ConfirmButton
                        message={`Slet "${ACTIVITY_LABELS[a.type]}" fra tidslinjen?`}
                        className="p-1 text-stone-300 hover:text-red-700"
                      >
                        <Trash2 size={12} />
                      </ConfirmButton>
                    </form>
                  )}
                  {a.source.startsWith("import") && (
                    <span className="mt-1 inline-block rounded bg-stone-100 px-1.5 text-[10px] text-stone-500">
                      {a.source === "import_status" ? "udledt af status ved import" : "fra import"}
                    </span>
                  )}
                </li>
              ))}
              {(activities ?? []).length === 0 && <li className="text-sm text-stone-500">Ingen aktiviteter endnu.</li>}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function ContactForm({ companyId, contact }: { companyId: string; contact?: Contact }) {
  return (
    <form action={saveContact} className="mt-3 grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="company_id" value={companyId} />
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <input name="name" required defaultValue={contact?.name} className="input" placeholder="Navn" />
      <input name="title" defaultValue={contact?.title ?? ""} className="input" placeholder="Titel" />
      <input name="email" type="email" defaultValue={contact?.email ?? ""} className="input" placeholder="E-mail" />
      <input name="phone" type="tel" defaultValue={contact?.phone ?? ""} className="input" placeholder="Telefon" />
      <input name="linkedin_url" defaultValue={contact?.linkedin_url ?? ""} className="input sm:col-span-2" placeholder="LinkedIn-URL" />
      <div>
        <button className="btn-primary">{contact ? "Gem person" : "Tilføj person"}</button>
      </div>
    </form>
  );
}
