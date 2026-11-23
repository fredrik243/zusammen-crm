"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { ACTIVITY_LABELS, QUICK_TYPES, todayISO, type ActivityType } from "@/lib/labels";
import { logActivity } from "@/lib/actions";

/** Knapper på virksomhedssiden: ét klik logger i dag; "Anden dato eller note" giver flere felter. */
export function ActivityQuickLog({ companyId, dealId }: { companyId: string; dealId: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<ActivityType>("mail_sent");

  function save(t: ActivityType, d?: string, n?: string) {
    start(async () => {
      const res = await logActivity({ companyId, dealId, type: t, date: d || null, note: n || null });
      setMsg(res.error ? `Fejl: ${res.error}` : `${ACTIVITY_LABELS[t]} registreret`);
      if (!res.error) {
        setNote("");
        setDate("");
      }
      setTimeout(() => setMsg(null), 3000);
    });
  }

  return (
    <div className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => save(t)}
            className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs text-stone-700 hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {ACTIVITY_LABELS[t]}
          </button>
        ))}
      </div>
      {msg && (
        <p className="flex items-center gap-1 text-xs text-accent">
          <Check size={13} /> {msg}
        </p>
      )}
      <details>
        <summary className="cursor-pointer list-none text-xs text-stone-500 hover:text-stone-800">
          Anden dato eller note…
        </summary>
        <form
          className="mt-2 grid gap-2 sm:grid-cols-[10rem_10rem_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            save(type, date, note);
          }}
        >
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ActivityType)} aria-label="Type">
            {QUICK_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTIVITY_LABELS[t]}
              </option>
            ))}
          </select>
          <input type="date" className="input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="Dato" />
          <input className="input" placeholder="Note (valgfri)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary" disabled={pending}>
            Gem
          </button>
        </form>
      </details>
    </div>
  );
}
