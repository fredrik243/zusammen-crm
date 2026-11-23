"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { ACTIVITY_LABELS, QUICK_TYPES, type ActivityType } from "@/lib/labels";
import { logActivity } from "@/lib/actions";

/** Lille knap på pipeline-kortet: registrér en aktivitet med ét klik (dato = i dag). */
export function ActivityMenu({ companyId, dealId, companyName }: { companyId: string; dealId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (open) return setOpen(false);
    // Menuen placeres fast på skærmen, så den ikke bliver klippet af tavlens scroll-område
    const r = btn.current!.getBoundingClientRect();
    const h = QUICK_TYPES.length * 32 + 10;
    const top = r.bottom + h + 8 < window.innerHeight ? r.bottom + 4 : Math.max(8, r.top - h - 4);
    setPos({ top, left: Math.max(8, Math.min(r.left, window.innerWidth - 184)) });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const hide = () => setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [open]);

  function pick(type: ActivityType) {
    setOpen(false);
    start(async () => {
      const res = await logActivity({ companyId, dealId, type });
      setDone(res.error ? `Fejl: ${res.error}` : ACTIVITY_LABELS[type]);
      setTimeout(() => setDone(null), 2500);
    });
  }

  // Stop klik her fra at starte et træk af kortet
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div ref={ref} className="relative" onMouseDown={stop} onTouchStart={stop} onPointerDown={stop} onKeyDown={stop}>
      {done ? (
        <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
          <Check size={12} /> {done}
        </span>
      ) : (
        <button
          type="button"
          ref={btn}
          onClick={toggle}
          disabled={pending}
          className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50"
          aria-label={`Registrér aktivitet for ${companyName}`}
          aria-expanded={open}
        >
          <Plus size={12} /> {pending ? "Gemmer…" : "Aktivitet"}
        </button>
      )}
      {open && pos && (
        <ul
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-44 overflow-hidden rounded-md border border-stone-200 bg-white py-1 text-sm shadow-lg"
        >
          {QUICK_TYPES.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => pick(t)} className="w-full px-3 py-1.5 text-left hover:bg-stone-100">
                {ACTIVITY_LABELS[t]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
