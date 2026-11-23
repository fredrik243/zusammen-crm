import type { Stage } from "@/lib/data";

export function StageBadge({ stage }: { stage?: Stage }) {
  if (!stage) return null;
  const color =
    stage.kind === "won"
      ? "bg-emerald-50 text-emerald-800"
      : stage.kind === "lost"
        ? "bg-stone-100 text-stone-500"
        : "bg-sky-50 text-sky-800";
  return <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${color}`}>{stage.name}</span>;
}

export function Initials({ text, title }: { text?: string | null; title?: string }) {
  if (!text) return <span className="text-xs text-stone-400">–</span>;
  return (
    <span
      title={title}
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-[10px] font-semibold text-stone-700"
    >
      {text}
    </span>
  );
}
