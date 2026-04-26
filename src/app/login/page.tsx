"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Sign in</h1>
        <p className="mb-6 text-sm text-slate-600">
          We&apos;ll email you a one-time sign-in link.
        </p>

        {sent ? (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 text-green-700">
              Sent a sign-in link to <strong>{email}</strong>. Click the link to continue.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="mt-3 text-sm font-medium text-green-800 underline hover:text-green-900"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </label>

            {error && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
