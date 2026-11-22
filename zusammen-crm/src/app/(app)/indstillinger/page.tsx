import { Trash2 } from "lucide-react";
import { getLookups, getSession } from "@/lib/data";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteCategory, saveCategory, saveMember } from "./actions";

export default async function SettingsPage() {
  const { me } = await getSession();
  const { categories, members } = await getLookups();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Indstillinger</h1>

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

      <p className="text-xs text-stone-400">Pipeline-faser og ugemål kan redigeres her fra fase 2 og 4.</p>
    </div>
  );
}
