import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-lg font-semibold">Siden findes ikke</h1>
      <Link href="/virksomheder" className="btn-secondary">Til kontaktbanken</Link>
    </main>
  );
}
