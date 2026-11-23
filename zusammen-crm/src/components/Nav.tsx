"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, KanbanSquare, ListTodo, Upload, Settings, LogOut } from "lucide-react";

const ITEMS = [
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/virksomheder", label: "Kontakter", icon: Building2 },
  { href: "/opgaver", label: "Opgaver", icon: ListTodo },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/indstillinger", label: "Indstillinger", icon: Settings },
];

export function Nav({ initials }: { initials: string }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      {/* Top (alle skærme) */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/pipeline" className="font-semibold tracking-tight">
            Zusammen <span className="font-normal text-stone-400">CRM</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {ITEMS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`rounded-md px-3 py-1.5 text-sm ${active(i.href) ? "bg-accent-soft font-medium text-accent" : "text-stone-600 hover:bg-stone-100"}`}
              >
                {i.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
              {initials}
            </span>
            <form action="/auth/logout" method="post">
              <button className="btn-ghost px-2" title="Log ud" aria-label="Log ud">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Bund-navigation på mobil */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active(i.href) ? "text-accent" : "text-stone-500"}`}
          >
            <i.icon size={20} />
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
