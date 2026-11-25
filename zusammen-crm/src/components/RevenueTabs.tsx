import Link from "next/link";

export function RevenueTabs({ active }: { active: "omsaetning" | "budget" }) {
  const tab = (on: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${on ? "bg-stone-800 text-white" : "text-stone-600 hover:bg-stone-200"}`;
  return (
    <div className="flex gap-1">
      <Link href="/omsaetning" className={tab(active === "omsaetning")}>
        Omsætning
      </Link>
      <Link href="/budget" className={tab(active === "budget")}>
        Budget
      </Link>
    </div>
  );
}
