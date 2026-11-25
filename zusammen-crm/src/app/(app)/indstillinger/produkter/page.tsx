import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getSession } from "@/lib/data";
import { ConfirmButton } from "@/components/ConfirmButton";
import { deleteProduct, saveProduct, setProductActive } from "./actions";

type Product = {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  unit: string;
  active: boolean;
};

export default async function ProductsPage() {
  const { supabase } = await getSession();
  const [{ data, error }, { data: lines }] = await Promise.all([
    supabase.from("products").select("*").order("active", { ascending: false }).order("name"),
    supabase.from("deal_products").select("product_id"),
  ]);
  const used = new Map<string, number>();
  for (const l of lines ?? []) used.set(l.product_id, (used.get(l.product_id) ?? 0) + 1);
  const products = (data ?? []) as Product[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/indstillinger" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={14} /> Indstillinger
      </Link>
      <div>
        <h1 className="text-xl font-semibold">Produkter</h1>
        <p className="text-sm text-stone-500">
          Produkterne kan lægges på deals med antal, pris og rabat. Standardprisen foreslås, når et produkt lægges på.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Produkttabellen findes ikke endnu. Kør supabase/03_fase4.sql i Supabases SQL Editor. ({error.message})
        </p>
      )}

      <section className="card">
        <ul className="divide-y divide-stone-100">
          {products.map((p) => {
            const n = used.get(p.id) ?? 0;
            return (
              <li key={p.id} className={`px-4 py-3 ${p.active ? "" : "bg-stone-50"}`}>
                <form action={saveProduct} className="grid gap-2 sm:grid-cols-[1fr_8rem_6rem_auto]">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="name" defaultValue={p.name} className="input" aria-label="Navn" required />
                  <input
                    name="default_price"
                    defaultValue={Number(p.default_price).toLocaleString("da-DK")}
                    inputMode="decimal"
                    className="input"
                    aria-label="Standardpris i kr."
                    title="Standardpris i kr."
                  />
                  <input name="unit" defaultValue={p.unit} className="input" aria-label="Enhed" title="Enhed" />
                  <button className="btn-secondary">Gem</button>
                  <input
                    name="description"
                    defaultValue={p.description ?? ""}
                    className="input sm:col-span-4"
                    placeholder="Beskrivelse"
                    aria-label="Beskrivelse"
                  />
                </form>
                <div className="mt-2 flex items-center gap-3 text-xs text-stone-500">
                  <span>{n === 0 ? "Ikke brugt på deals" : `Brugt ${n} gang${n === 1 ? "" : "e"} på deals`}</span>
                  <form action={setProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="active" value={p.active ? "0" : "1"} />
                    <button className="underline hover:text-stone-800">{p.active ? "Skjul fra listen" : "Vis igen"}</button>
                  </form>
                  {!p.active && <span className="rounded bg-stone-200 px-1.5">Skjult</span>}
                  {n === 0 && (
                    <form action={deleteProduct} className="ml-auto">
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message={`Slet produktet ${p.name}?`} className="flex items-center gap-1 text-stone-400 hover:text-red-700">
                        <Trash2 size={13} /> Slet
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
          {products.length === 0 && !error && <li className="px-4 py-3 text-sm text-stone-500">Ingen produkter endnu.</li>}
        </ul>
        <form action={saveProduct} className="grid gap-2 border-t border-stone-100 px-4 py-3 sm:grid-cols-[1fr_8rem_6rem_auto]">
          <input name="name" className="input" placeholder="Nyt produkt" required />
          <input name="default_price" className="input" placeholder="Pris (kr.)" inputMode="decimal" />
          <input name="unit" className="input" placeholder="Enhed" defaultValue="stk." />
          <button className="btn-primary">Tilføj</button>
          <input name="description" className="input sm:col-span-4" placeholder="Beskrivelse (valgfri)" />
        </form>
      </section>
    </div>
  );
}
