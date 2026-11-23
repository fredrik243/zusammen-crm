import { getLookups, getSession } from "@/lib/data";
import { ImportClient } from "./ImportClient";

export default async function ImportPage() {
  const { supabase } = await getSession();
  const { members, stages } = await getLookups();
  const { data } = await supabase.from("companies").select("name");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Importér bruttoliste</h1>
        <p className="text-sm text-stone-500">
          Vælg CSV-filen. Du ser først, hvordan den bliver fortolket, og kan rette til. Intet gemmes, før du trykker
          &quot;Importér&quot;.
        </p>
      </div>
      <ImportClient
        members={members.map((m) => ({ id: m.id, name: m.name, initials: m.initials }))}
        stages={stages.map((s) => s.name)}
        existing={(data ?? []).map((c) => c.name.toLowerCase())}
      />
    </div>
  );
}
