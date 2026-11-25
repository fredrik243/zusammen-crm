// Beregning af nøgletal til statistiksiden. Ren logik, så den kan testes direkte mod data.

import { addDays, todayISO } from "@/lib/labels";
import { inPeriod, isoWeek, localDate, mondayOf, type Period } from "@/lib/period";

export type StatActivity = { type: string; occurred_at: string | null; company_id: string | null };
export type StatCompany = { id: string; category_id: string | null; owner_id: string | null };

export type Group = { label: string; reached: number; replied: number; rate: number | null; avgDays: number | null };

const OUTREACH = new Set(["mail_sent", "linkedin_message"]);
const DAY = 86400000;
const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY);

export function computeStats(input: {
  activities: StatActivity[];
  companies: StatCompany[];
  period: Period;
  categoryName: (id: string | null) => string;
  ownerName: (id: string | null) => string;
}) {
  const { period } = input;
  const all = period.from == null && period.to == null;
  const acts = input.activities.map((a) => ({ ...a, date: localDate(a.occurred_at) }));

  const count = (type: string) => acts.filter((a) => a.type === type && inPeriod(a.date, period)).length;
  const mailsSent = count("mail_sent");
  const linkedin = count("linkedin_message");
  const reminders = count("reminder_sent");
  const replies = count("reply_received");
  const meetingsBooked = count("meeting_booked");
  const meetingsHeld = count("meeting_held");
  const rejections = count("rejection");
  const undatedTotal = acts.filter((a) => !a.date && a.type !== "stage_changed").length;

  // ---- Svar pr. virksomhed ----
  const byCompany = new Map<string, typeof acts>();
  for (const a of acts) {
    if (!a.company_id) continue;
    byCompany.set(a.company_id, [...(byCompany.get(a.company_id) ?? []), a]);
  }

  type Outcome = { company: StatCompany; replied: boolean; days: number | null; remindersBefore: number };
  const outcomes: Outcome[] = [];
  for (const c of input.companies) {
    const list = byCompany.get(c.id) ?? [];
    const outreach = list.filter((a) => OUTREACH.has(a.type));
    if (!outreach.length) continue;
    const datedOut = outreach.filter((a) => a.date).map((a) => a.date!).sort();
    const first = datedOut[0] ?? null;
    // Med i perioden, hvis første henvendelse ligger i perioden (eller altid under "Alt")
    if (!all && !(first && inPeriod(first, period))) continue;

    const replies = list.filter((a) => a.type === "reply_received");
    const datedReplies = replies.filter((a) => a.date && (!first || a.date >= first)).map((a) => a.date!).sort();
    const firstReply = datedReplies[0] ?? null;
    const replied = datedReplies.length > 0 || replies.some((a) => !a.date);

    const rem = list.filter((a) => a.type === "reminder_sent");
    const remindersBefore = replied
      ? rem.filter((a) => !a.date || ((!first || a.date >= first) && (!firstReply || a.date <= firstReply))).length
      : rem.length;

    outcomes.push({
      company: c,
      replied,
      days: first && firstReply ? days(first, firstReply) : null,
      remindersBefore,
    });
  }

  function summarize(label: string, list: Outcome[]): Group {
    const replied = list.filter((o) => o.replied).length;
    const d = list.map((o) => o.days).filter((x): x is number => x != null);
    return {
      label,
      reached: list.length,
      replied,
      rate: list.length ? replied / list.length : null,
      avgDays: d.length ? d.reduce((s, x) => s + x, 0) / d.length : null,
    };
  }
  function groupBy(key: (o: Outcome) => string, order?: string[]): Group[] {
    const map = new Map<string, Outcome[]>();
    for (const o of outcomes) map.set(key(o), [...(map.get(key(o)) ?? []), o]);
    const rows = [...map.entries()].map(([k, v]) => summarize(k, v));
    return order
      ? rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
      : rows.sort((a, b) => b.reached - a.reached);
  }

  const total = summarize("I alt", outcomes);
  const byCategory = groupBy((o) => input.categoryName(o.company.category_id));
  const byOwner = groupBy((o) => input.ownerName(o.company.owner_id));
  const reminderLabel = (n: number) => (n === 0 ? "Ingen rykkere" : n === 1 ? "1 rykker" : n === 2 ? "2 rykkere" : "3 eller flere");
  const byReminders = groupBy((o) => reminderLabel(o.remindersBefore), [
    "Ingen rykkere",
    "1 rykker",
    "2 rykkere",
    "3 eller flere",
  ]);

  // ---- Uger ----
  const today = todayISO();
  const datedDates = acts.map((a) => a.date).filter((d): d is string => !!d).sort();
  let start = period.from ?? (datedDates[0] && datedDates[0] > addDays(today, -7 * 26) ? datedDates[0] : addDays(today, -7 * 11));
  const end = period.to && period.to < today ? period.to : today;
  if (start > end) start = end;
  let monday = mondayOf(start);
  const weeks: { monday: string; label: string; hint: string; meetings: number; mails: number }[] = [];
  while (monday <= end) {
    weeks.push({
      monday,
      label: `u${isoWeek(monday)}`,
      hint: `Uge ${isoWeek(monday)} (${monday.slice(8, 10)}/${monday.slice(5, 7)})`,
      meetings: 0,
      mails: 0,
    });
    monday = addDays(monday, 7);
  }
  const shown = weeks.slice(-26);
  for (const a of acts) {
    if (!a.date || !inPeriod(a.date, { ...period, from: period.from ?? start })) continue;
    const w = shown.find((x) => a.date! >= x.monday && a.date! <= addDays(x.monday, 6));
    if (!w) continue;
    if (a.type === "meeting_booked") w.meetings++;
    if (a.type === "mail_sent") w.mails++;
  }
  const datedMeetings = acts.filter(
    (a) => a.type === "meeting_booked" && a.date && inPeriod(a.date, { ...period, from: period.from ?? start }),
  ).length;
  const meetingsPerWeek = weeks.length ? datedMeetings / weeks.length : 0;

  return {
    mailsSent,
    linkedin,
    reminders,
    replies,
    meetingsBooked,
    meetingsHeld,
    rejections,
    undatedTotal,
    total,
    byCategory,
    byOwner,
    byReminders,
    weeks: shown,
    weekCount: weeks.length,
    meetingsPerWeek,
  };
}
