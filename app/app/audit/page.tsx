"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Event = {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  detail: Record<string, unknown> | null;
  approved: boolean | null;
};

// Tudo que o cérebro fez, quando e com o quê. Nada escondido (princípio Aside).
export default function AuditPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j) => setEvents(j.events ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto min-h-dvh">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="font-bold tracking-widest text-sm">📋 AUDITORIA</h1>
        <Link href="/" className="text-xs text-zinc-400 underline underline-offset-2">
          ← chat
        </Link>
      </header>

      <main className="flex-1 px-4 py-4 space-y-2 pb-8">
        {loading && <p className="text-zinc-500 text-sm">carregando…</p>}
        {!loading && events.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-16">nenhum evento registrado</p>
        )}
        {events.map((e) => (
          <div key={e.id} className="rounded-lg border border-zinc-800">
            <button
              onClick={() => setOpen(open === e.id ? null : e.id)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 text-sm"
            >
              <span
                className={
                  e.action.startsWith("blackout")
                    ? "text-red-400"
                    : e.actor === "cris"
                      ? "text-emerald-400"
                      : "text-zinc-400"
                }
              >
                {e.action.startsWith("blackout") ? "☠️" : e.actor === "cris" ? "👤" : "🧠"}
              </span>
              <span className="flex-1 font-mono text-xs">{e.action}</span>
              <span className="text-zinc-500 text-xs">
                {e.created_at.slice(5, 16).replace("T", " ")}
              </span>
            </button>
            {open === e.id && (
              <pre className="px-3 pb-3 text-xs text-zinc-400 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(e.detail, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
