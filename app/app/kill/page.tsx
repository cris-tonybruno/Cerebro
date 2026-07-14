"use client";

import { useEffect, useState } from "react";

// Protocolo Blackout — acessível de QUALQUER browser, sem login.
export default function KillPage() {
  const [lockdown, setLockdown] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/kill")
      .then((r) => r.json())
      .then((j) => setLockdown(Boolean(j.lockdown)))
      .catch(() => setLockdown(null));
  }, []);

  async function fire(action: "kill" | "restore") {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/kill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, totp, action }),
      });
      const j = await res.json();
      if (res.ok) {
        setLockdown(j.lockdown);
        setMsg(
          j.lockdown
            ? "🔴 BLACKOUT ATIVO. App trancado, sessões mortas, Telegram mudo."
            : "🟢 Restaurado. Faça login de novo (as sessões antigas morreram)."
        );
        setPassword("");
        setTotp("");
      } else {
        setMsg(`⚠️ ${j.error ?? "falhou"}`);
      }
    } catch {
      setMsg("⚠️ erro de conexão");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center p-6 min-h-dvh bg-black">
      <div className="w-full max-w-xs space-y-4 text-center">
        <h1 className="text-xl font-bold tracking-widest text-red-500">☠️ BLACKOUT</h1>
        <p className="text-zinc-500 text-sm">
          {lockdown === null
            ? "verificando estado…"
            : lockdown
              ? "🔴 sistema TRANCADO"
              : "🟢 sistema operando"}
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha do blackout"
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-zinc-100 outline-none focus:border-red-700"
        />
        <input
          inputMode="numeric"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          placeholder="código do autenticador (6 dígitos)"
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-zinc-100 outline-none focus:border-red-700"
        />
        {msg && <p className="text-sm text-zinc-300">{msg}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => fire("kill")}
            disabled={busy || lockdown === true}
            className="flex-1 rounded-lg bg-red-700 text-white py-3 font-bold disabled:opacity-30"
          >
            MATAR
          </button>
          <button
            onClick={() => fire("restore")}
            disabled={busy || lockdown === false}
            className="flex-1 rounded-lg bg-zinc-100 text-zinc-950 py-3 font-bold disabled:opacity-30"
          >
            restaurar
          </button>
        </div>
        <p className="text-zinc-600 text-xs">
          o cérebro (banco) continua seguro na nuvem — o blackout mata o acesso, não a memória
        </p>
      </div>
    </main>
  );
}
