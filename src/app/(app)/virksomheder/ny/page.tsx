import { getLookups } from "@/lib/data";
import { CompanyForm } from "@/components/CompanyForm";
import { createCompany } from "../actions";

export default async function NewCompanyPage() {
  const { categories, members } = await getLookups();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Ny virksomhed</h1>
      <div className="card p-4 md:p-6">
        <CompanyForm action={createCompany} categories={categories} members={members} cancelHref="/virksomheder" />
      </div>
    </div>
  );
}
