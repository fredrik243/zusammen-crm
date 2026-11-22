// Viser hvordan importen fortolker en CSV – uden at gemme noget.
// Brug: npm run preview:import -- sti/til/bruttoliste.csv
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { parseRows } from "../src/lib/import/parse";
import { ACTIVITY_LABELS } from "../src/lib/labels";

const file = process.argv[2];
if (!file) {
  console.error("Angiv stien til CSV-filen");
  process.exit(1);
}
const { data } = Papa.parse<Record<string, string>>(readFileSync(file, "utf8"), { header: true, skipEmptyLines: false });
const companies = parseRows(data);
for (const c of companies) {
  console.log(`\n#${c.ref} ${c.name} [${c.stage}] ${c.category || "–"} · ${c.owner_key || "ingen ansvarlig"}${c.do_not_contact ? " · KONTAKT IKKE IGEN" : ""}`);
  for (const p of c.contacts) console.log(`   👤 ${p.name} | ${p.title || "–"} | ${p.email || "–"}`);
  if (c.general_email) console.log(`   ✉  generel: ${c.general_email}`);
  for (const t of c.tasks) console.log(`   ☐ ${t.title} ${t.due_date ? "(" + t.due_date + ")" : "(ingen dato)"}`);
  for (const a of c.activities) console.log(`   • ${ACTIVITY_LABELS[a.type]} ${a.date || "dato ukendt"}${a.source === "import_status" ? " (fra status)" : ""}`);
  for (const w of c.warnings) console.log(`   ⚠ ${w}`);
}
const sum = (f: (c: (typeof companies)[number]) => number) => companies.reduce((s, c) => s + f(c), 0);
console.log(`\n${companies.length} virksomheder, ${sum((c) => c.contacts.length)} personer, ${sum((c) => c.tasks.length)} opgaver, ${sum((c) => c.activities.length)} aktiviteter`);
