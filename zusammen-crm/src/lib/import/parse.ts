// Fortolker bruttoliste.csv til virksomheder, personer, opgaver og aktiviteter.
// Ren logik uden afhængigheder, så den kan testes direkte (npm run test:import).

import type { ActivityType } from "@/lib/labels";

export type ImportContact = { name: string; title: string; email: string };
export type ImportTask = { title: string; due_date: string };
export type ImportActivity = {
  type: ActivityType;
  date: string; // YYYY-MM-DD eller "" = dato ukendt
  note: string;
  source: "import" | "import_status";
};

export type ImportCompany = {
  ref: number; // rækkenummer i CSV
  include: boolean;
  name: string;
  stage: string;
  category: string;
  owner_key: string; // "Fredrik", "Kahr" eller ""
  general_email: string;
  do_not_contact: boolean;
  do_not_contact_reason: string;
  contacts: ImportContact[];
  tasks: ImportTask[];
  activities: ImportActivity[];
  warnings: string[];
  source: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Beslutninger truffet med Fredrik (20.11.2026)
// ---------------------------------------------------------------------------
const IMPORT_YEAR = 2026;
const TODAY = () => new Date().toISOString().slice(0, 10);

const CATEGORY_OVERRIDES: Record<string, string> = {
  kilroy: "Rejser",
  silvan: "Hobby",
};
const DO_NOT_CONTACT_OVERRIDES: Record<string, boolean> = {
  jesperhus: true,
};

const STATUS_TO_STAGE: Record<string, string> = {
  "ikke kontaktet": "Ikke kontaktet",
  kontaktet: "Kontaktet",
  dialog: "Dialog",
  afslag: "Tabt",
};

// ---------------------------------------------------------------------------
// Hjælpere
// ---------------------------------------------------------------------------
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "aa")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------------------
// Personer: "Navn, titel", "titel Navn", "Navn, Navn, titel", "titel, Navn / titel Navn"
// ---------------------------------------------------------------------------
const TITLE_WORDS = new Set(
  (
    "ceo coo cfo cmo cto cco vp svp evp direktør direktører direktor director directors chef head of and og for " +
    "manager lead marketing brand strategy business development commercial kommerciel kommerciel adm adm. global " +
    "digital nordic group innovation services creative indehaver ejer founder co-founder partner officer denmark " +
    "danmark international senior junior chief executive operating presse kommunikation pr & i ansvarlig " +
    "salgschef salg sales communications communication brand-director country"
  ).split(" "),
);
const TITLE_SUFFIXES = ["chef", "direktør", "director", "manager", "officer", "ansvarlig"];
const NAME_PARTICLES = new Set(["von", "van", "de", "af", "du", "la", "le", "der", "den"]);

function isTitleToken(tok: string): boolean {
  return tok.split("/").every((sub) => {
    const w = sub.toLowerCase().replace(/[.,]$/, "");
    if (!w) return true;
    if (TITLE_WORDS.has(w) || TITLE_WORDS.has(w + ".")) return true;
    if (TITLE_SUFFIXES.some((s) => w.endsWith(s))) return true;
    // Små bogstaver = ikke et navn (bortset fra navnepartikler)
    const first = sub.charAt(0);
    const isUpper = first === first.toUpperCase() && first !== first.toLowerCase();
    return !isUpper && !NAME_PARTICLES.has(w);
  });
}

type Part = { name: string; title: string };

function splitPart(part: string): Part {
  const toks = part.split(/\s+/).filter(Boolean);
  const kinds = toks.map((t) => (isTitleToken(t) ? "T" : "N"));
  if (kinds.every((k) => k === "N")) return { name: toks.join(" "), title: "" };
  if (kinds.every((k) => k === "T")) return { name: "", title: toks.join(" ") };
  // Navn til sidst: "CEO Tobias Nielsen"
  let i = toks.length;
  while (i > 0 && kinds[i - 1] === "N") i--;
  if (i < toks.length && kinds.slice(0, i).every((k) => k === "T")) {
    return { name: toks.slice(i).join(" "), title: toks.slice(0, i).join(" ") };
  }
  // Navn først: "Andreas Karlsson Group CEO"
  let j = 0;
  while (j < toks.length && kinds[j] === "N") j++;
  if (j > 0 && kinds.slice(j).every((k) => k === "T")) {
    return { name: toks.slice(0, j).join(" "), title: toks.slice(j).join(" ") };
  }
  return { name: toks.join(" "), title: "" };
}

export function parsePersons(raw: string): { name: string; title: string }[] {
  const out: { name: string; title: string }[] = [];
  const text = raw.trim();
  if (!text) return out;
  for (const group of text.split(/\s+\/\s+/)) {
    const persons: { name: string; title: string }[] = [];
    let pendingTitle = "";
    for (const piece of group.split(",").map((s) => s.trim()).filter(Boolean)) {
      const { name, title } = splitPart(piece);
      if (name) {
        persons.push({ name, title: title || pendingTitle });
        pendingTitle = "";
      } else if (title) {
        const untitled = persons.filter((p) => !p.title);
        if (untitled.length) untitled.forEach((p) => (p.title = title));
        else pendingTitle = title;
      }
    }
    out.push(...persons.map((p) => ({ name: p.name, title: cap(p.title.replace(/^direktører$/i, "direktør")) })));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mails → personer
// ---------------------------------------------------------------------------
const GENERIC_LOCALS = new Set([
  "info", "kontakt", "contact", "museum", "mail", "post", "hello", "hej", "office", "presse", "press", "sales", "salg",
]);

function emailScore(local: string, name: string): number {
  const l = fold(local).replace(/[^a-z]/g, "");
  const parts = fold(name).split(" ").filter(Boolean);
  if (!l || !parts.length) return 0;
  if (parts.some((p) => p.length >= 3 && l.includes(p))) return 3;
  const initials = parts.map((p) => p[0]).join("");
  if (l === initials) return 3;
  // Forbogstaver af fornavn + start på et senere navn: "lve", "loto", "chdr", "ka"
  const first = parts[0];
  for (let i = 1; i <= Math.min(first.length, l.length - 1); i++) {
    if (!first.startsWith(l.slice(0, i))) break;
    const rest = l.slice(i);
    if (parts.slice(1).some((p) => p.startsWith(rest))) return 2;
  }
  if (l.length >= 2 && initials.startsWith(l)) return 1;
  return 0;
}

function assignEmails(
  persons: { name: string; title: string }[],
  emails: string[],
): { contacts: ImportContact[]; general: string[]; unmatched: string[] } {
  const contacts: ImportContact[] = persons.map((p) => ({ ...p, email: "" }));
  const general: string[] = [];
  const rest: string[] = [];
  for (const e of emails) {
    const local = e.split("@")[0];
    if (GENERIC_LOCALS.has(local.toLowerCase())) general.push(e);
    else rest.push(e);
  }
  const unmatched: string[] = [];
  for (const e of rest) {
    const local = e.split("@")[0];
    const scored = contacts
      .map((c, i) => ({ i, s: c.email ? 0 : emailScore(local, c.name) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);
    if (scored.length && (scored.length === 1 || scored[0].s > scored[1].s)) {
      contacts[scored[0].i].email = e;
    } else unmatched.push(e);
  }
  // Én person uden mail + én mail tilbage → par dem
  const free = contacts.filter((c) => !c.email);
  if (free.length === 1 && unmatched.length === 1) {
    free[0].email = unmatched.pop()!;
  }
  return { contacts, general, unmatched };
}

// ---------------------------------------------------------------------------
// Datoer og hændelser i "Next step"
// ---------------------------------------------------------------------------
const MONTHS: [RegExp, number][] = [
  [/^jan/, 1], [/^feb/, 2], [/^mar/, 3], [/^apr/, 4], [/^maj/, 5], [/^jun/, 6],
  [/^jul/, 7], [/^aug/, 8], [/^sep/, 9], [/^okt/, 10], [/^nov/, 11], [/^dec/, 12],
];
const MONTH_WORD =
  "(januar|jan|februar|feb|marts|mar|april|apr|maj|juni|jun|juli|jul|august|aug|september|sept|sep|oktober|okt|november|nov|december|dec)";
const DATE_RE = new RegExp(
  `(\\d{1,2})[/.](\\d{1,2})(?!\\d)|(\\d{1,2})\\.?\\s+${MONTH_WORD}\\b\\.?`,
  "gi",
);

const monthNo = (w: string) => MONTHS.find(([re]) => re.test(w.toLowerCase()))?.[1] ?? 0;
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type FoundDate = { index: number; end: number; date: string };

export function findDates(text: string): FoundDate[] {
  const out: FoundDate[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const d = Number(m[1] ?? m[3]);
    const mo = m[2] ? Number(m[2]) : monthNo(m[4]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      out.push({ index: m.index!, end: m.index! + m[0].length, date: iso(IMPORT_YEAR, mo, d) });
    }
  }
  return out;
}

/** Fremadrettede formuleringer → opgavens dato */
export function forwardDate(text: string): string {
  const t = text.toLowerCase();
  if (/ved årsskiftet|ved nytår/.test(t)) return iso(IMPORT_YEAR + 1, 1, 5);
  const m = t.match(new RegExp(`\\btil\\s+${MONTH_WORD}\\b`));
  if (m) {
    const mo = monthNo(m[1]);
    // Måneder, der er passeret i importåret, betyder næste år
    const year = mo >= 11 || mo === 12 ? IMPORT_YEAR : IMPORT_YEAR + 1;
    return iso(year, mo, 1);
  }
  return "";
}

function typeForDate(text: string, prevEnd: number, d: FoundDate): ActivityType | null {
  const after = text.slice(d.end, d.end + 18).toLowerCase();
  if (/linked-?in/.test(after)) return "linkedin_message";
  const before = text.slice(prevEnd, d.index).toLowerCase();
  const hits: [number, ActivityType | "meeting"][] = [
    [before.lastIndexOf("rykker"), "reminder_sent"],
    [before.lastIndexOf("materiale"), "mail_sent"],
    [before.lastIndexOf("mail"), "mail_sent"],
    [before.lastIndexOf("møde"), "meeting"],
  ];
  const best = hits.filter(([i]) => i >= 0).sort((a, b) => b[0] - a[0])[0];
  if (!best) {
    // "+ 28. sept." efter en rykker arver typen fra forrige dato
    return null;
  }
  if (best[1] === "meeting") return d.date <= TODAY() ? "meeting_held" : "meeting_booked";
  return best[1];
}

export function parseNextStep(text: string): ImportActivity[] {
  const acts: ImportActivity[] = [];
  const note = text.trim();
  const dates = findDates(note);
  let prevEnd = 0;
  let prevType: ActivityType | null = null;
  for (const d of dates) {
    // "Kontakt igen til maj" og lignende er ikke hændelser
    const type: ActivityType | null = typeForDate(note, prevEnd, d) ?? prevType;
    if (type) {
      acts.push({ type, date: d.date, note, source: "import" });
      if (type === "meeting_held") {
        acts.push({ type: "meeting_booked", date: "", note, source: "import" });
      }
      prevType = type === "linkedin_message" ? prevType : type;
    }
    prevEnd = d.end;
  }
  const t = note.toLowerCase();
  const has = (ty: ActivityType) => acts.some((a) => a.type === ty);
  const undated = (ty: ActivityType) => {
    if (!has(ty)) acts.push({ type: ty, date: "", note, source: "import" });
  };
  if (/mail sendt|introduktion sendt|materiale sendt/.test(t)) undated("mail_sent");
  if (/rykker( også)? sendt|har fulgt op/.test(t)) undated("reminder_sent");
  if (/linked-?in/.test(t)) undated("linkedin_message");
  if (/møde var/.test(t)) {
    undated("meeting_held");
    undated("meeting_booked");
  }
  return acts;
}

// ---------------------------------------------------------------------------
// Hele filen
// ---------------------------------------------------------------------------
export function parseRows(rows: Record<string, string>[]): ImportCompany[] {
  const out: ImportCompany[] = [];
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const get = (k: string) => (r[k] ?? "").trim();
    const name = get("Virksomhed");
    if (name.toLowerCase() === "opsummering") break; // opsummeringsblokken nederst
    if (!name) continue;

    const warnings: string[] = [];
    const key = name.toLowerCase();
    const status = get("Status");
    const stage = STATUS_TO_STAGE[status.toLowerCase()] ?? "Ikke kontaktet";
    if (!STATUS_TO_STAGE[status.toLowerCase()]) warnings.push(`Ukendt status "${status}" – sat til Ikke kontaktet`);

    const category = CATEGORY_OVERRIDES[key] ?? get("Kategori");
    if (!category) warnings.push("Mangler kategori");

    const owner_key = get("Ansvarlig");

    const info = get("Kontaktoplysninger");
    const emails = info
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@"));
    const persons = parsePersons(get("Person"));
    const { contacts, general, unmatched } = assignEmails(persons, emails);
    if (unmatched.length) warnings.push(`Mail uden person: ${unmatched.join(", ")} – gemt som generel mail`);
    const general_email = [...general, ...unmatched].join(", ");

    const next = get("Next step");
    let do_not_contact = /kontakt ikke igen/i.test(next);
    if (DO_NOT_CONTACT_OVERRIDES[key]) do_not_contact = true;

    // Aktiviteter fra teksten
    const activities = next ? parseNextStep(next) : [];
    if (/linked-?in/i.test(info) && !activities.some((a) => a.type === "linkedin_message")) {
      activities.push({ type: "linkedin_message", date: "", note: info, source: "import" });
    }

    // Aktiviteter udledt af status, så statistikken ikke starter fra nul
    const statusNote = `Udledt af status "${status}" i bruttolisten`;
    const add = (type: ActivityType) => {
      if (!activities.some((a) => a.type === type)) {
        activities.push({ type, date: "", note: statusNote, source: "import_status" });
      }
    };
    if (stage !== "Ikke kontaktet") {
      // Første henvendelse: mail, medmindre den alene skete via LinkedIn
      const has = (t: ActivityType) => activities.some((a) => a.type === t);
      if (!(has("linkedin_message") && !has("reminder_sent"))) add("mail_sent");
    }
    if (stage === "Dialog" || stage === "Tabt") add("reply_received");
    if (stage === "Tabt") add("rejection");

    // Opgave fra "Next step"
    const tasks: ImportTask[] = [];
    if (next && !do_not_contact) {
      const isEventOnly = activities.some((a) => a.source === "import");
      const due = forwardDate(next);
      if (!(stage === "Tabt" && isEventOnly)) {
        let title = next.replace(/\s+/g, " ").replace(/[.\s]+$/, "");
        if (isEventOnly && !due && !/^følg op/i.test(title)) title = `Følg op: ${title}`;
        tasks.push({ title, due_date: due });
      }
    }

    out.push({
      ref: idx + 2,
      include: true,
      name,
      stage,
      category,
      owner_key,
      general_email,
      do_not_contact,
      do_not_contact_reason: do_not_contact ? next : "",
      contacts,
      tasks,
      activities: activities.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999")),
      warnings,
      source: Object.fromEntries(
        ["Virksomhed", "Status", "Person", "Kontaktoplysninger", "Next step", "Ansvarlig", "Kategori"].map((k) => [k, get(k)]),
      ),
    });
  }
  return out;
}
