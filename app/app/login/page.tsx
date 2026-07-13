"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      setError(`Senha incorreta (você digitou ${password.length} caracteres).`);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6 min-h-dvh">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <h1 className="text-2xl font-bold text-center tracking-widest text-zinc-100">
          CÉREBRO
        </h1>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
            autoFocus
            autoComplete="current-password"
            style={{ color: "#fafafa", caretColor: "#fafafa", backgroundColor: "#18181b" }}
            className="w-full rounded-lg border border-zinc-700 px-4 py-3 pr-16 text-base outline-none focus:border-zinc-400"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 underline"
          >
            {show ? "ocultar" : "ver"}
          </button>
        </div>
        <p className="text-zinc-500 text-xs text-center">
          {password.length > 0 ? `${password.length} caracteres digitados` : "digite a senha"}
        </p>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-zinc-100 text-zinc-950 py-3 font-semibold active:opacity-80 disabled:opacity-50"
        >
          {busy ? "entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
