import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Package, Trash2, Upload } from "lucide-react";
import { getLookups, getSession } from "@/lib/data";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteCategory, deleteStage, moveStage, saveCategory, saveMember, saveStage, saveWeeklyGoal } from "./actions";

export default async function SettingsPage() {
  const { me, supabase } = await getSession();
  const { categories, members, stages } = await getLookups();
  const [{ data: dealStages }, { data: settings }] = await Promise.all([
    supabase.from("deals").select("stage_id"),
    supabase.from("app_settings").select("weekly_meeting_goal").eq("id", 1).maybeSingle(),
  ]);
  const dealCount = new Map<string, number>();
  for (const d of dealStages ?? []) dealCount.set(d.stage_id, (dealCount.get(d.stage_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Indstillinger</h1>

      <nav className="card divide-y divide-stone-100">
        <Link href="/indstillinger/produkter" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50">
          <Package size={16} className="text-stone-500" />
          <span className="flex-1">
            <span className="font-medium">Produkter</span>
            <span className="block text-xs text-stone-500">Katalog med priser, som kan lægges på deals</span>
          </span>
          <ChevronRight size={16} className="text-stone-400" />
        </Link>
        <Link href="/import" className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50">
          <Upload size={16} className="text-stone-500" />
          <span className="flex-1">
            <span className="font-medium">Import</span>
            <span className="block text-xs text-stone-500">Indlæs virksomheder fra en CSV-fil</span>
          </span>
          <ChevronRight size={16} className="text-stone-400" />
        </Link>
      </nav>

      <section className="card">
        <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Ugemål</h2>
        <form action={saveWeeklyGoal} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
          <label htmlFor="goal">Møder booket pr. uge:</label>
          <input
            id="goal"
            name="weekly_meeting_goal"
            defaultValue={settings?.weekly_meeting_goal ?? 2}
            inputMode="numeric"
            className="input w-20"
          />
          <button className="btn-secondary">Gem</button>
          <span className="text-xs text-stone-500">Vises som mållinje på statistiksiden.</span>
        </form>
      </section>

      <section className="card">
        <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Team</h2>
        <ul className="divide-y divide-stone-100">
          {members.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <form action={saveMember} className="grid gap-2 sm:grid-cols-[1fr_5rem_1fr_auto] sm:items-center">
                <input type="hidden" name="id" value={m.id} />
                <input name="name" defaultValue={m.name} className="input" aria-label="Navn" />
                <input name="initials" defaultValue={m.initials} className="input" aria-label="Initialer" />
                <input name="email" defaultValue={m.email ?? ""} className="input" placeholder="Login-e-mail" aria-label="E-mail" />
                <button className="btn-secondary">Gem</button>
              </form>
              <p className="mt-1 text-xs text-stone-400">
                {m.id === me?.id ? "Det er dig." : m.user_id ? "Har logget ind." : "Har ikke logget ind endnu."}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Pipeline-faser</h2>
          <p className="text-xs text-stone-500">
            Rækkefølgen her er rækkefølgen på tavlen. Sandsynligheden bruges, når en deal ikke har sin egen.
          </p>
        </div>
        <ul className="divide-y divide-stone-100">
          {stages.map((s, i) => {
            const n = dealCount.get(s.id) ?? 0;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <div className="flex flex-col">
                  <form action={moveStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button className="btn-ghost p-0.5 disabled:opacity-20" disabled={i === 0} aria-label={`Flyt ${s.name} op`}>
                      <ArrowUp size={14} />
                    </button>
                  </form>
                  <form action={moveStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      className="btn-ghost p-0.5 disabled:opacity-20"
                      disabled={i === stages.length - 1}
                      aria-label={`Flyt ${s.name} ned`}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </form>
                </div>
                <form action={saveStage} className="grid flex-1 grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[1fr_5rem_8rem_auto]">
                  <input type="hidden" name="id" value={s.id} />
                  <input name="name" defaultValue={s.name} className="input" aria-label="Fasenavn" />
                  <input
                    name="default_probability"
                    defaultValue={s.default_probability}
                    inputMode="numeric"
                    className="input"
                    aria-label="Standard-sandsynlighed i procent"
                    title="Standard-sandsynlighed i procent"
                  />
                  <select name="kind" defaultValue={s.kind} className="input" aria-label="Type">
                    <option value="open">Åben</option>
                    <option value="won">Vundet</option>
                    <option value="lost">Tabt</option>
                  </select>
                  <button className="btn-secondary">Gem</button>
                </form>
                <span className="w-14 text-right text-xs text-stone-400">{n} deals</span>
                {n === 0 ? (
                  <form action={deleteStage}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton message={`Slet fasen ${s.name}?`} className="btn-ghost px-2 text-stone-400 hover:text-red-700">
                      <Trash2 size={15} />
                    </ConfirmButton>
                  </form>
                ) : (
                  <span className="w-[31px]" title="Flyt deals ud af fasen, før den kan slettes" />
                )}
              </li>
            );
          })}
        </ul>
        <form action={saveStage} className="grid grid-cols-[1fr_5rem_auto] gap-2 border-t border-stone-100 px-4 py-3">
          <input type="hidden" name="kind" value="open" />
          <input name="name" className="input" placeholder="Ny fase" required />
          <input name="default_probability" className="input" placeholder="%" inputMode="numeric" />
          <button className="btn-primary">Tilføj</button>
        </form>
      </section>

      <section className="card">
        <h2 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Kategorier</h2>
        <ul className="divide-y divide-stone-100">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-2">
              <form action={saveCategory} className="flex flex-1 gap-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="name" defaultValue={c.name} className="input" aria-label="Kategorinavn" />
                <button className="btn-secondary">Gem</button>
              </form>
              <form action={deleteCategory}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmButton
                  message={`Slet kategorien ${c.name}? Virksomheder i kategorien bliver ukategoriserede.`}
                  className="btn-ghost px-2 text-stone-400 hover:text-red-700"
                >
                  <Trash2 size={15} />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveCategory} className="flex gap-2 border-t border-stone-100 px-4 py-3">
          <input name="name" className="input" placeholder="Ny kategori" required />
          <button className="btn-primary">Tilføj</button>
        </form>
      </section>

    </div>
  );
}
