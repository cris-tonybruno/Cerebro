"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Memory = {
  id: string;
  created_at: string;
  kind: string;
  content: string;
  zone: string;
  confidence: number;
  archived: boolean;
};

const ZONES = ["todas", "pessoal", "familia", "negocios", "criativo"] as const;
const KINDS = ["fact", "preference", "person", "place", "routine"];

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [zone, setZone] = useState<string>("todas");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = zone !== "todas" ? `?zone=${zone}` : "";
    const res = await fetch(`/api/memory${qs}`);
    if (res.ok) {
      const json = await res.json();
      setMemories(json.memories ?? []);
    }
    setLoading(false);
  }, [zone]);

  useEffect(() => {
    load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    await fetch(`/api/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Apagar esta memória de vez?")) return;
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    load();
  }

  async function create() {
    const content = newContent.trim();
    if (!content) return;
    setNewContent("");
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, kind: "fact", zone: zone === "todas" ? "negocios" : zone }),
    });
    load();
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto min-h-dvh">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-900">
        <h1 className="font-bold tracking-widest text-sm">MEMÓRIA</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <a href="/api/export?format=md" className="underline underline-offset-2">
            export .md
          </a>
          <Link href="/" className="underline underline-offset-2">
            ← chat
          </Link>
        </div>
      </header>

      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {ZONES.map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
              zone === z
                ? "bg-zinc-100 text-zinc-950 border-zinc-100"
                : "border-zinc-800 text-zinc-400"
            }`}
          >
            {z}
          </button>
        ))}
      </div>

      <div className="px-4 pb-3 flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Escrever uma memória manualmente…"
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-zinc-600"
        />
        <button
          onClick={create}
          disabled={!newContent.trim()}
          className="rounded-lg bg-zinc-100 text-zinc-950 px-4 text-sm font-semibold disabled:opacity-40"
        >
          +
        </button>
      </div>

      <main className="flex-1 px-4 pb-8 space-y-3">
        {loading && <p className="text-zinc-500 text-sm">carregando…</p>}
        {!loading && memories.length === 0 && (
          <p className="text-zinc-500 text-sm">Nenhuma memória ainda. Conversa comigo no chat.</p>
        )}
        {memories.map((m) => (
          <div key={m.id} className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 space-y-2">
            {editing === m.id ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm outline-none"
                />
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => {
                      patch(m.id, { content: draft });
                      setEditing(null);
                    }}
                    className="rounded bg-zinc-100 text-zinc-950 px-3 py-1 font-semibold"
                  >
                    salvar
                  </button>
                  <button onClick={() => setEditing(null)} className="text-zinc-400 underline">
                    cancelar
                  </button>
                </div>
              </>
            ) : (
              <p
                className="text-sm cursor-pointer"
                onClick={() => {
                  setEditing(m.id);
                  setDraft(m.content);
                }}
              >
                {m.content}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs text-zinc-500 flex-wrap">
              <select
                value={m.kind}
                onChange={(e) => patch(m.id, { kind: e.target.value })}
                className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5"
              >
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <select
                value={m.zone}
                onChange={(e) => patch(m.id, { zone: e.target.value })}
                className="bg-zinc-900 border border-zinc-800 rounded px-1 py-0.5"
              >
                {ZONES.filter((z) => z !== "todas").map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
              <span>{m.created_at.slice(0, 10)}</span>
              <span className="flex-1" />
              <button onClick={() => remove(m.id)} className="text-red-500 underline">
                apagar
              </button>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
