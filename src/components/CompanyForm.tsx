"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Category, Company, Member } from "@/lib/data";
import type { FormState } from "@/app/(app)/virksomheder/actions";

export function CompanyForm({
  action,
  company,
  categories,
  members,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  company?: Company;
  categories: Category[];
  members: Member[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {company && <input type="hidden" name="id" value={company.id} />}
      <div>
        <label className="label">Navn *</label>
        <input name="name" required defaultValue={company?.name} className="input" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Kategori</label>
          <select name="category_id" defaultValue={company?.category_id ?? ""} className="input">
            <option value="">Ingen</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ansvarlig</label>
          <select name="owner_id" defaultValue={company?.owner_id ?? ""} className="input">
            <option value="">Ingen ansvarlig</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Website</label>
          <input name="website" defaultValue={company?.website ?? ""} className="input" placeholder="eksempel.dk" />
        </div>
        <div>
          <label className="label">Generel e-mail</label>
          <input name="general_email" defaultValue={company?.general_email ?? ""} className="input" placeholder="info@…" />
        </div>
      </div>
      <div>
        <label className="label">Noter</label>
        <textarea name="notes" rows={4} defaultValue={company?.notes ?? ""} className="input" />
      </div>
      <div className="rounded-md border border-stone-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="do_not_contact" defaultChecked={company?.do_not_contact} className="h-4 w-4" />
          Kontakt ikke igen
        </label>
        <input
          name="do_not_contact_reason"
          defaultValue={company?.do_not_contact_reason ?? ""}
          className="input mt-2"
          placeholder="Begrundelse (valgfri)"
        />
      </div>
      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Gemmer…" : "Gem"}
        </button>
        <Link href={cancelHref} className="btn-ghost">
          Annullér
        </Link>
      </div>
    </form>
  );
}
