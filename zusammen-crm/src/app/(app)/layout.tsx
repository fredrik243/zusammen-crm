import { getSession } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { claimMember } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, members, user } = await getSession();

  if (!me) {
    const free = members.filter((m) => !m.user_id);
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-sm p-6">
          <h1 className="text-lg font-semibold">Hvem er du?</h1>
          <p className="mt-1 text-sm text-stone-500">
            Første gang du logger ind som {user.email}, skal din login kobles til dit navn. Det sker kun én gang.
          </p>
          <form action={claimMember} className="mt-5 space-y-2">
            {free.map((m) => (
              <button key={m.id} name="member_id" value={m.id} className="btn-secondary w-full justify-start">
                {m.name}
              </button>
            ))}
            {free.length === 0 && (
              <p className="text-sm text-stone-600">Begge pladser er taget. Kontakt den anden bruger.</p>
            )}
          </form>
        </div>
      </main>
    );
  }

  return (
    <>
      <Nav initials={me.initials} />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 md:pb-12">{children}</main>
    </>
  );
}
