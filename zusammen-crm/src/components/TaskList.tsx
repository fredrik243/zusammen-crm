"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Trash2, CornerDownRight } from "lucide-react";
import { addDays, formatDate } from "@/lib/labels";
import { createTask, deleteTask, setTaskDone, updateTask } from "@/lib/actions";

export type TaskItem = {
  id: string;
  title: string;
  due_date: string | null;
  status: "open" | "done";
  assignee_id: string | null;
  company_id: string | null;
  company_name?: string | null;
  deal_id: string | null;
};

type MemberLite = { id: string; name: string; initials: string };

export function TaskList({
  tasks,
  members,
  today,
  showCompany = false,
  emptyText,
}: {
  tasks: TaskItem[];
  members: MemberLite[];
  today: string;
  showCompany?: boolean;
  emptyText?: string;
}) {
  const [statusOverride, setStatusOverride] = useState<Record<string, "open" | "done">>({});
  const [prompt, setPrompt] = useState<TaskItem | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [, start] = useTransition();
  const memberById = new Map(members.map((m) => [m.id, m]));

  function toggle(t: TaskItem) {
    const next = (statusOverride[t.id] ?? t.status) === "open" ? "done" : "open";
    setStatusOverride((s) => ({ ...s, [t.id]: next }));
    if (next === "done") setPrompt(t);
    else if (prompt?.id === t.id) setPrompt(null);
    start(async () => {
      const res = await setTaskDone(t.id, next === "done");
      if (res.error) setStatusOverride((s) => ({ ...s, [t.id]: t.status }));
    });
  }

  if (tasks.length === 0 && !prompt) {
    return emptyText ? <p className="px-4 py-3 text-sm text-stone-500">{emptyText}</p> : null;
  }

  // Når en udført opgave forsvinder fra listen (fordi siden opdateres), vises forslaget stadig
  const orphanPrompt = prompt && !tasks.some((t) => t.id === prompt.id) ? prompt : null;

  return (
    <ul className="divide-y divide-stone-100">
      {orphanPrompt && (
        <li className="px-4 py-3 text-sm">
          <div className="flex items-center gap-3 text-stone-400">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-accent bg-accent text-white">
              <Check size={13} />
            </span>
            <span className="line-through">{orphanPrompt.title}</span>
          </div>
          <NextTaskPrompt from={orphanPrompt} members={members} today={today} onClose={() => setPrompt(null)} />
        </li>
      )}
      {tasks.map((t) => {
        const status = statusOverride[t.id] ?? t.status;
        const done = status === "done";
        const overdue = !done && t.due_date && t.due_date < today;
        const who = memberById.get(t.assignee_id ?? "");
        return (
          <li key={t.id} className="px-4 py-3 text-sm">
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggle(t)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  done ? "border-accent bg-accent text-white" : "border-stone-300 hover:border-accent"
                }`}
                aria-label={done ? `Genåbn ${t.title}` : `Markér ${t.title} som udført`}
              >
                {done && <Check size={13} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={done ? "text-stone-400 line-through" : ""}>{t.title}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                  <span className={overdue ? "font-medium text-red-700" : t.due_date ? "text-stone-500" : "text-amber-700"}>
                    {t.due_date ? formatDate(t.due_date) : "Ingen dato"}
                  </span>
                  {who && <span className="text-stone-400">· {who.initials}</span>}
                  {showCompany && t.company_id && (
                    <Link href={`/virksomheder/${t.company_id}`} className="text-accent hover:underline">
                      {t.company_name}
                    </Link>
                  )}
                </div>
              </div>
              <button
                onClick={() => setEditing(editing === t.id ? null : t.id)}
                className="btn-ghost p-1 text-stone-400"
                aria-label={`Redigér ${t.title}`}
              >
                <Pencil size={13} />
              </button>
            </div>

            {editing === t.id && <EditTask t={t} members={members} onDone={() => setEditing(null)} />}

            {prompt?.id === t.id && done && (
              <NextTaskPrompt
                from={t}
                members={members}
                today={today}
                onClose={() => setPrompt(null)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function NextTaskPrompt({
  from,
  members,
  today,
  onClose,
}: {
  from: TaskItem;
  members: MemberLite[];
  today: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(addDays(today, 7));
  const [assignee, setAssignee] = useState(from.assignee_id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  return (
    <form
      className="ml-8 mt-3 space-y-2 rounded-md border border-accent/30 bg-accent-soft/50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createTask({
            title,
            dueDate: date,
            assigneeId: assignee || null,
            companyId: from.company_id,
            dealId: from.deal_id,
          });
          if (res.error) setError(res.error);
          else onClose();
        });
      }}
    >
      <p className="flex items-center gap-1 text-xs font-medium text-accent">
        <CornerDownRight size={13} /> Udført. Hvad er næste skridt{from.company_name ? ` for ${from.company_name}` : ""}?
      </p>
      <input
        className="input"
        autoFocus
        required
        placeholder="Fx Ring og følg op på tilbud"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Dato" />
        <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Ansvarlig">
          <option value="">Ingen</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Opretter…" : "Opret opgave"}
        </button>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Ikke nu
        </button>
      </div>
    </form>
  );
}

function EditTask({ t, members, onDone }: { t: TaskItem; members: MemberLite[]; onDone: () => void }) {
  const [title, setTitle] = useState(t.title);
  const [date, setDate] = useState(t.due_date ?? "");
  const [assignee, setAssignee] = useState(t.assignee_id ?? "");
  const [pending, start] = useTransition();

  return (
    <form
      className="ml-8 mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await updateTask({ id: t.id, title, dueDate: date || null, assigneeId: assignee || null });
          onDone();
        });
      }}
    >
      <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titel" />
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Dato" />
        <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Ansvarlig">
          <option value="">Ingen</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button className="btn-primary" disabled={pending}>
          Gem
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Annullér
        </button>
        <button
          type="button"
          className="btn-ghost ml-auto text-red-700"
          onClick={() => {
            if (!window.confirm(`Slet opgaven "${t.title}"?`)) return;
            start(async () => {
              await deleteTask(t.id);
              onDone();
            });
          }}
        >
          <Trash2 size={13} /> Slet
        </button>
      </div>
    </form>
  );
}

export function NewTaskForm({
  members,
  defaultAssignee,
  companyId,
  companies,
  today,
}: {
  members: MemberLite[];
  defaultAssignee: string | null;
  companyId?: string;
  companies?: { id: string; name: string }[];
  today: string;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(addDays(today, 7));
  const [assignee, setAssignee] = useState(defaultAssignee ?? "");
  const [company, setCompany] = useState(companyId ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createTask({ title, dueDate: date || null, assigneeId: assignee || null, companyId: company || null });
          if (res.error) setMsg(res.error);
          else {
            setTitle("");
            setMsg("Opgaven er oprettet");
            setTimeout(() => setMsg(""), 2500);
          }
        });
      }}
    >
      <input className="input" required placeholder="Hvad skal der ske?" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className={`grid gap-2 ${companies ? "sm:grid-cols-3" : "grid-cols-2"}`}>
        {companies && (
          <select className="input" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Virksomhed">
            <option value="">Ingen virksomhed</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Dato" />
        <select className="input" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Ansvarlig">
          <option value="">Ingen</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Opretter…" : "Tilføj opgave"}
        </button>
        {msg && <span className="text-xs text-accent">{msg}</span>}
      </div>
    </form>
  );
}
