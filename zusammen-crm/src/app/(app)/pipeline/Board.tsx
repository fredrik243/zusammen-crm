"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Ban, CalendarClock, CircleAlert, Search } from "lucide-react";
import type { Stage } from "@/lib/data";
import { fold } from "@/lib/import/parse";
import { formatDate } from "@/lib/labels";
import { moveDeal } from "./actions";
import { ActivityMenu } from "@/components/ActivityMenu";

export type BoardDeal = {
  id: string;
  stageId: string;
  position: number;
  companyId: string;
  companyName: string;
  categoryId: string | null;
  doNotContact: boolean;
  contactName: string | null;
  ownerId: string | null;
  ownerInitials: string | null;
  ownerName: string | null;
  value: number | null;
  nextTitle: string | null;
  nextDate: string | null;
  overdue: boolean;
  planned: boolean;
};

const kr = (n: number) =>
  n.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 });

const COL = "col:";

// Kolonner først, når markøren er over et tomt område i dem
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const card = hits.find((h) => !String(h.id).startsWith(COL));
    return card ? [card] : hits;
  }
  return rectIntersection(args);
};

export function Board({
  stages,
  initialDeals,
  members,
  categories,
  move = moveDeal,
}: {
  move?: (dealId: string, stageId: string, position: number) => Promise<{ error?: string }>;
  stages: Stage[];
  initialDeals: BoardDeal[];
  members: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [owner, setOwner] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const origin = useRef<{ stageId: string; position: number } | null>(null);
  const lastDragEnd = useRef(0);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const visible = useMemo(() => {
    const needle = fold(q);
    return deals.filter(
      (d) =>
        (!needle || fold(`${d.companyName} ${d.contactName ?? ""}`).includes(needle)) &&
        (!cat || d.categoryId === cat) &&
        (!owner || (owner === "ingen" ? !d.ownerId : d.ownerId === owner)),
    );
  }, [deals, q, cat, owner]);

  const columns = useMemo(
    () =>
      stages.map((s) => {
        const items = visible.filter((d) => d.stageId === s.id).sort((a, b) => a.position - b.position);
        return { stage: s, items, total: items.reduce((sum, d) => sum + (d.value ?? 0), 0) };
      }),
    [stages, visible],
  );

  const active = deals.find((d) => d.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    const d = deals.find((x) => x.id === e.active.id);
    if (!d) return;
    origin.current = { stageId: d.stageId, position: d.position };
    setActiveId(d.id);
    setError("");
  }

  function targetFor(e: DragOverEvent | DragEndEvent): { stageId: string; position: number } | null {
    const over = e.over;
    if (!over) return null;
    const overId = String(over.id);
    const id = String(e.active.id);

    if (overId.startsWith(COL)) {
      const stageId = overId.slice(COL.length);
      const list = visible.filter((d) => d.stageId === stageId && d.id !== id);
      const last = list.reduce((m, d) => Math.max(m, d.position), 0);
      const current = deals.find((d) => d.id === id);
      if (current?.stageId === stageId) return { stageId, position: current.position };
      return { stageId, position: last + 1 };
    }

    const overDeal = deals.find((d) => d.id === overId);
    if (!overDeal || overDeal.id === id) return null;
    const list = visible
      .filter((d) => d.stageId === overDeal.stageId && d.id !== id)
      .sort((a, b) => a.position - b.position);
    const i = list.findIndex((d) => d.id === overDeal.id);
    const activeRect = e.active.rect.current.translated;
    const below = activeRect ? activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2 : false;
    if (below) {
      const next = list[i + 1];
      return { stageId: overDeal.stageId, position: next ? (overDeal.position + next.position) / 2 : overDeal.position + 1 };
    }
    const prev = list[i - 1];
    return { stageId: overDeal.stageId, position: prev ? (prev.position + overDeal.position) / 2 : overDeal.position - 1 };
  }

  function place(id: string, t: { stageId: string; position: number }) {
    setDeals((ds) => ds.map((d) => (d.id === id ? { ...d, stageId: t.stageId, position: t.position } : d)));
  }

  function onDragOver(e: DragOverEvent) {
    const t = targetFor(e);
    const cur = deals.find((d) => d.id === e.active.id);
    if (t && cur && (t.stageId !== cur.stageId || t.position !== cur.position)) place(cur.id, t);
  }

  async function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const from = origin.current;
    setActiveId(null);
    lastDragEnd.current = Date.now();
    origin.current = null;
    const cur = deals.find((d) => d.id === id);
    if (!from || !cur) return;
    if (!e.over) {
      place(id, from);
      return;
    }
    const t = targetFor(e) ?? { stageId: cur.stageId, position: cur.position };
    place(id, t);
    if (t.stageId === from.stageId && t.position === from.position) return;
    const res = await move(id, t.stageId, t.position);
    if (res.error) {
      place(id, from);
      setError(`Kortet kunne ikke flyttes: ${res.error}`);
    }
  }

  function onDragCancel() {
    if (activeId && origin.current) place(activeId, origin.current);
    setActiveId(null);
    origin.current = null;
  }

  const guardClick = (e: React.MouseEvent) => {
    if (Date.now() - lastDragEnd.current < 300) e.preventDefault();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative md:flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            className="input pl-9"
            placeholder="Søg virksomhed eller person"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <select className="input md:w-44" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
            <option value="">Alle kategorier</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input md:w-44" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Ansvarlig">
            <option value="">Alle ansvarlige</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            <option value="ingen">Ingen ansvarlig</option>
          </select>
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:snap-none">
          {columns.map(({ stage, items, total }) => (
            <Column key={stage.id} stage={stage} count={items.length} total={total}>
              {items.map((d) => (
                <DraggableCard key={d.id} deal={d} closed={stage.kind !== "open"} dimmed={d.id === activeId} onLinkClick={guardClick} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <Card deal={active} closed={stages.find((s) => s.id === active.stageId)?.kind !== "open"} lifted /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  count,
  total,
  children,
}: {
  stage: Stage;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: COL + stage.id });
  const tone =
    stage.kind === "won" ? "bg-emerald-50/70" : stage.kind === "lost" ? "bg-stone-200/40" : "bg-stone-100";
  return (
    <section className={`flex w-[78vw] max-w-72 shrink-0 snap-start flex-col rounded-lg ${tone} sm:w-72`}>
      <header className="px-3 pb-2 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{stage.name}</h2>
          <span className="text-xs text-stone-500">{count}</span>
        </div>
        <div className="text-xs text-stone-500">{kr(total)}</div>
      </header>
      <div
        ref={setNodeRef}
        className={`flex min-h-[55vh] flex-1 flex-col gap-2 rounded-b-lg px-2 pb-2 transition-colors ${isOver ? "bg-accent-soft" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}

function DraggableCard({
  deal,
  closed,
  dimmed,
  onLinkClick,
}: {
  deal: BoardDeal;
  closed: boolean;
  dimmed: boolean;
  onLinkClick: (e: React.MouseEvent) => void;
}) {
  const drag = useDraggable({ id: deal.id });
  const drop = useDroppable({ id: deal.id });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      {...drag.listeners}
      {...drag.attributes}
      className={`touch-manipulation ${dimmed ? "opacity-30" : ""}`}
    >
      <Card deal={deal} closed={closed} onLinkClick={onLinkClick} />
    </div>
  );
}

function Card({
  deal: d,
  closed,
  lifted,
  onLinkClick,
}: {
  deal: BoardDeal;
  closed: boolean;
  lifted?: boolean;
  onLinkClick?: (e: React.MouseEvent) => void;
}) {
  const unplanned = !closed && !d.planned && !d.doNotContact;
  return (
    <article
      className={`cursor-grab select-none rounded-md border bg-white p-2.5 text-sm active:cursor-grabbing ${
        unplanned ? "border-amber-300 border-l-4 border-l-amber-400" : "border-stone-200"
      } ${lifted ? "rotate-1 shadow-lg" : "shadow-xs"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/virksomheder/${d.companyId}`}
          onClick={onLinkClick}
          className="flex min-w-0 items-center gap-1 font-medium hover:underline"
          draggable={false}
        >
          {d.doNotContact && <Ban size={13} className="shrink-0 text-red-600" aria-label="Kontakt ikke igen" />}
          <span className="truncate">{d.companyName}</span>
        </Link>
        {d.ownerInitials ? (
          <span
            title={d.ownerName ?? ""}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700"
          >
            {d.ownerInitials}
          </span>
        ) : (
          <span className="text-xs text-stone-400" title="Ingen ansvarlig">
            –
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-stone-500">
        <span className="truncate">{d.contactName ?? "Ingen kontaktperson"}</span>
        {d.value != null && <span className="shrink-0 font-medium text-stone-700">{kr(d.value)}</span>}
      </div>
      {d.nextTitle && (
        <div className="mt-2 flex items-start gap-1.5 text-xs">
          <CalendarClock size={13} className={`mt-px shrink-0 ${d.overdue ? "text-red-600" : "text-stone-400"}`} />
          <span className="line-clamp-2 text-stone-700">
            {d.nextDate && (
              <span className={`mr-1 font-medium ${d.overdue ? "text-red-700" : ""}`}>{formatDate(d.nextDate, false)}</span>
            )}
            {d.nextTitle}
          </span>
        </div>
      )}
      {(unplanned || !lifted) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {unplanned ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              <CircleAlert size={12} /> Intet planlagt
            </span>
          ) : (
            <span />
          )}
          {!lifted && <ActivityMenu companyId={d.companyId} dealId={d.id} companyName={d.companyName} />}
        </div>
      )}
    </article>
  );
}
