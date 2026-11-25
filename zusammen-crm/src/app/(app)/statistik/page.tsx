import Link from "next/link";
import { getLookups, getSession } from "@/lib/data";
import { presets, resolvePeriod } from "@/lib/period";
import { computeStats, type Group, type StatActivity, type StatCompany } from "@/lib/stats";
import { BarChart, BreakdownTable, PeriodFilter, StatTile } from "@/components/Charts";

const pct = (n: number | null) => (n == null ? "–" : `${Math.round(n * 100)} %`);
const dayText = (n: number | null) =>
  n == null ? "–" : `${n.toLocaleString("da-DK", { maximumFractionDigits: 1 })} dage`;

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; fra?: string; til?: string }>;
}) {
  const sp = await searchParams;
  const period = resolvePeriod(sp, "stats", "alt");
  const { supabase } = await getSession();
  const { stages, categories, members } = await getLookups();

  const [{ data: acts, error }, { data: comps }, { data: deals }, { data: settings }] = await Promise.all([
    supabase.from("activities").select("type,occurred_at,company_id").neq("type", "stage_changed"),
    supabase.from("companies").select("id,category_id,owner_id"),
    supabase.from("deals").select("stage_id"),
    supabase.from("app_settings").select("weekly_meeting_goal").eq("id", 1).maybeSingle(),
  ]);
  const goal = settings?.weekly_meeting_goal ?? 2;

  const s = computeStats({
    activities: (acts ?? []) as StatActivity[],
    companies: (comps ?? []) as StatCompany[],
    period,
    categoryName: (id) => categories.find((c) => c.id === id)?.name ?? "Uden kategori",
    ownerName: (id) => members.find((m) => m.id === id)?.name ?? "Ingen ansvarlig",
  });

  const stageCount = new Map<string, number>();
  for (const d of deals ?? []) stageCount.set(d.stage_id, (stageCount.get(d.stage_id) ?? 0) + 1);
  const dialogStage = stages.find((x) => x.name.toLowerCase() === "dialog");
  const inDialog = dialogStage ? (stageCount.get(dialogStage.id) ?? 0) : null;
  const all = period.key === "alt";

  const groupRows = (rows: Group[]) =>
    rows.map((g) => ({
      label: g.label,
      values: [g.reached, g.replied, pct(g.rate), dayText(g.avgDays)],
      raw: [g.rate ?? 0],
    }));
  const groupCols = ["Kontaktet", "Svar", "Svarprocent", "Gns. svartid"];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Statistik</h1>
        <p className="text-sm text-stone-500">De nøgletal, I før talte i hånden. Svarprocent regnes pr. virksomhed, der er kontaktet.</p>
      </div>

      <PeriodFilter path="/statistik" presets={presets("stats")} current={period} />

      {error && <p className="text-sm text-red-700">Kunne ikke hente aktiviteter: {error.message}</p>}

      {s.undatedTotal > 0 && (
        <p className="rounded-md bg-stone-100 p-3 text-xs text-stone-600">
          {s.undatedTotal} aktiviteter fra importen har ingen dato.{" "}
          {all
            ? "De tæller med i tallene her, men ikke i graferne pr. uge."
            : 'De tæller kun med under "Alt", fordi de ikke kan placeres i en periode.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Mails sendt" value={String(s.mailsSent)} sub={`+ ${s.linkedin} LinkedIn · ${s.reminders} rykkere`} />
        <StatTile label="Antal svar" value={String(s.replies)} sub={`${s.rejections} afslag`} />
        <StatTile label="Svarprocent" value={pct(s.total.rate)} sub={`${s.total.replied} af ${s.total.reached} kontaktede`} />
        <StatTile label="I dialog nu" value={inDialog == null ? "–" : String(inDialog)} sub="Deals i fasen Dialog" />
        <StatTile label="Møder booket" value={String(s.meetingsBooked)} sub={`${s.meetingsHeld} møder holdt`} />
        <StatTile
          label="Møder booket pr. uge"
          value={s.meetingsPerWeek.toLocaleString("da-DK", { maximumFractionDigits: 1 })}
          sub={`Mål: ${goal} · over ${s.weekCount} uge${s.weekCount === 1 ? "" : "r"}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BarChart
          title="Møder booket pr. uge"
          data={s.weeks.map((w) => ({ label: w.label, hint: w.hint, value: w.meetings }))}
          goal={goal}
          goalLabel={`Ugemål: ${goal}`}
          integer
        />
        <BarChart
          title="Mails sendt pr. uge"
          data={s.weeks.map((w) => ({ label: w.label, hint: w.hint, value: w.mails }))}
          integer
        />
      </div>
      <p className="-mt-3 text-xs text-stone-500">
        Graferne viser højst de seneste 26 uger. Ugemålet ændres under{" "}
        <Link href="/indstillinger" className="underline">
          Indstillinger
        </Link>
        .
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownTable title="Svar fordelt på kategori" columns={groupCols} rows={groupRows(s.byCategory)} />
        <BreakdownTable title="Svar fordelt på ansvarlig" columns={groupCols} rows={groupRows(s.byOwner)} />
        <BreakdownTable title="Svar fordelt på antal rykkere før svar" columns={groupCols} rows={groupRows(s.byReminders)} />
        <BreakdownTable
          title="Pipeline lige nu"
          columns={["Deals"]}
          rows={stages.map((st) => ({
            label: st.name,
            values: [stageCount.get(st.id) ?? 0],
            raw: [stageCount.get(st.id) ?? 0],
          }))}
        />
      </div>

      <p className="text-xs text-stone-500">
        Kontaktet = virksomheder med en mail eller LinkedIn-besked (i perioden: første henvendelse i perioden). Svartid = dage fra
        første henvendelse til første svar; kun hvor begge har en dato.
      </p>
    </div>
  );
}
