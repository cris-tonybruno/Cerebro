"use client";

import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";

type Memory = {
  id: string;
  created_at: string;
  updated_at: string;
  kind: string;
  content: string;
  zone: string;
  confidence: number;
  archived: boolean;
};

const ZONES = ["todas", "pessoal", "familia", "trabalho", "projetos", "escrita"] as const;
const KINDS = ["fact", "preference", "person", "place", "routine", "marco"];
const TRANCADAS = new Set(["pessoal", "familia"]);

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
    if (!confirm("Apagar esta memória de vez, senhor?")) return;
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
      body: JSON.stringify({ content, kind: "fact", zone: zone === "todas" ? "trabalho" : zone }),
    });
    load();
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto min-h-dvh">
      <header className="px-5 pt-6 pb-3">
        <h1 className="font-[family-name:var(--font-serif-display)] text-3xl">Memórias</h1>
      </header>

      <div className="flex gap-2 px-5 pb-3 overflow-x-auto">
        {ZONES.map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={`etiqueta px-3 py-1.5 rounded-lg whitespace-nowrap border ${
              zone === z
                ? "border-gold text-gold"
                : TRANCADAS.has(z)
                  ? "border-golddim text-goldsoft"
                  : "border-line text-muted"
            }`}
          >
            {TRANCADAS.has(z) ? "🔒 " : ""}
            {z}
          </button>
        ))}
      </div>

      <div className="px-5 pb-3 flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Escrever uma memória, senhor…"
          className="flex-1 rounded-xl bg-panel border border-line px-3 py-2 text-sm outline-none focus:border-golddim"
        />
        <button
          onClick={create}
          disabled={!newContent.trim()}
          className="rounded-xl bg-gold text-background px-4 text-sm font-semibold disabled:opacity-40"
        >
          +
        </button>
      </div>

      <main className="flex-1 px-5 pb-4 space-y-2">
        {loading && <p className="text-muted text-sm">carregando…</p>}
        {!loading && memories.length === 0 && (
          <p className="text-muted text-sm text-center mt-12">Nenhuma memória aqui ainda.</p>
        )}
        {memories.map((m) => (
          <div key={m.id} className="rounded-xl border border-line bg-panel p-3 space-y-2">
            <p className="etiqueta text-muted">
              {m.zone} · {m.kind}
              {m.kind === "marco" ? " 🦋" : ""}
            </p>
            {editing === m.id ? (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-panel2 border border-golddim px-3 py-2 text-sm outline-none"
                />
                <div className="flex gap-3 etiqueta">
                  <button
                    onClick={() => {
                      patch(m.id, { content: draft });
                      setEditing(null);
                    }}
                    className="text-gold"
                  >
                    salvar
                  </button>
                  <button onClick={() => setEditing(null)} className="text-muted">
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
            <div className="flex items-center gap-2 etiqueta text-muted flex-wrap">
              <select
                value={m.kind}
                onChange={(e) => patch(m.id, { kind: e.target.value })}
                className="bg-panel2 border border-line rounded px-1 py-0.5"
              >
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
              <select
                value={m.zone}
                onChange={(e) => patch(m.id, { zone: e.target.value })}
                className="bg-panel2 border border-line rounded px-1 py-0.5"
              >
                {ZONES.filter((z) => z !== "todas").map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
              <span>{m.created_at.slice(0, 10)}</span>
              <span className="flex-1" />
              <button onClick={() => remove(m.id)} className="text-red-400">
                apagar
              </button>
            </div>
          </div>
        ))}

        <p className="etiqueta text-muted pt-3 pb-1">
          🔒 Zonas Pessoal e Família nunca são enviadas ao conselho. Só o principal as lê — e
          apenas quando o senhor libera.
        </p>
      </main>

      <BottomNav active="memorias" />
    </div>
  );
}
