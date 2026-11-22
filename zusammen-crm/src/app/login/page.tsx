"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false, // kun inviterede brugere kan logge ind
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setState("error");
      setMessage(
        error.message.includes("Signups not allowed")
          ? "Den e-mail har ikke adgang. Bed om en invitation."
          : "Det gik ikke at sende linket. Prøv igen om lidt.",
      );
    } else setState("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-lg font-semibold">Zusammen CRM</h1>
        <p className="mt-1 text-sm text-stone-500">Log ind med din e-mail. Du får et link tilsendt.</p>

        {params.get("fejl") === "link" && state === "idle" && (
          <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Linket virkede ikke. Det kan være udløbet, eller det blev åbnet i en anden browser end den,
            du bad om det fra. Bed om et nyt.
          </p>
        )}

        {state === "sent" ? (
          <p className="mt-6 rounded-md bg-accent-soft p-3 text-sm text-accent">
            Tjek din indbakke. Åbn linket på samme enhed og i samme browser.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <label className="label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-primary w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sender…" : "Send login-link"}
            </button>
            {state === "error" && <p className="text-sm text-red-700">{message}</p>}
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
