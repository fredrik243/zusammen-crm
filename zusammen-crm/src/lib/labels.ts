export const ACTIVITY_TYPES = [
  "mail_sent",
  "reminder_sent",
  "linkedin_message",
  "reply_received",
  "meeting_booked",
  "meeting_held",
  "rejection",
  "stage_changed",
  "note",
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  mail_sent: "Mail sendt",
  reminder_sent: "Rykker sendt",
  linkedin_message: "LinkedIn-besked",
  reply_received: "Svar modtaget",
  meeting_booked: "Møde booket",
  meeting_held: "Møde holdt",
  rejection: "Afslag",
  stage_changed: "Fase ændret",
  note: "Note",
};

export function formatDate(d: string | null | undefined, withYear = true): string {
  if (!d) return "Dato ukendt";
  const date = new Date(d.length === 10 ? d + "T12:00:00" : d);
  return date.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Europe/Copenhagen",
  });
}

export function todayISO(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Copenhagen" });
}

/** Aktiviteter, man selv kan registrere (fase ændret logges automatisk) */
export const QUICK_TYPES: ActivityType[] = [
  "mail_sent",
  "reminder_sent",
  "linkedin_message",
  "reply_received",
  "meeting_booked",
  "meeting_held",
  "rejection",
];

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
