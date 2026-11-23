import { getSession } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { claimMember } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { me, members, user, membersError } = await getSession();

  if (!me && (membersError || members.length === 0)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-md p-6">
          <h1 className="text-lg font-semibold">Appen kan ikke læse teamet</h1>
          <p className="mt-2 text-sm text-stone-600">
            Du er logget ind som {user.email}, men databasen returnerer ingen teammedlemmer. Kør
            supabase/01_fase1.sql igen i Supabases SQL Editor. Se også &quot;Hvis noget driller&quot; i README.
          </p>
          {membersError && <p className="mt-3 rounded bg-stone-100 p-2 font-mono text-xs text-stone-700">{membersError}</p>}
          <form action="/auth/logout" method="post" className="mt-4">
            <button className="btn-secondary">Log ud</button>
          </form>
        </div>
      </main>
    );
  }

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
              <p className="text-sm text-stone-600">Begge navne er allerede koblet til et andet login. Er du logget ind med en anden e-mail end sidst? Ellers se &quot;Hvis noget driller&quot; i README.</p>
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
