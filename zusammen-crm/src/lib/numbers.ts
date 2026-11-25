/** Læser et tal skrevet på dansk ("15.000", "15.000,50", "12,5") eller almindeligt ("15000.5"). */
export function parseNumber(v: string | null | undefined): number | null {
  if (v == null) return null;
  const t = String(v).replace(/\s|kr\.?|%/gi, "");
  if (!t) return null;
  const n = Number(t.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
}

export const kr = (n: number) =>
  n.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 });

export const pct = (n: number) => `${Math.round(n * 100)} %`;
