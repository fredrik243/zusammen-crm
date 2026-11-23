"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";

type Option = { value: string; label: string };

export function FilterBar({ filters }: { filters: { key: string; label: string; options: Option[] }[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update("q", q);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className={`flex flex-col gap-2 md:flex-row ${pending ? "opacity-70" : ""}`}>
      <div className="relative md:flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input
          className="input pl-9"
          placeholder="Søg virksomhed, person eller mail"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 md:flex">
        {filters.map((f) => (
          <select
            key={f.key}
            className="input md:w-44"
            value={params.get(f.key) ?? ""}
            onChange={(e) => update(f.key, e.target.value)}
            aria-label={f.label}
          >
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
