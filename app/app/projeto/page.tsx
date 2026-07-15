"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

type Projeto = {
  project: { id: string; name: string; kind: string | null; notes: string | null } | null;
  projects: { id: string; name: string; kind: string | null; in_focus: boolean; status: string }[];
  turns?: { role: string; content: string; created_at: string }[];
};
type Chamado = {
  id: string;
  created_at: string;
  request: string;
  status: string;
  pipeline: string;
  job_type: string;
  resolution: string | null;
};

const ESTADO: Record<string, { icon: string; label: string }> = {
  pending: { icon: "💡", label: "ideia registrada" },
  dispatched: { icon: "📨", label: "na fila do Vigia" },
  building: { icon: "🔨", label: "construindo…" },
  built: { icon: "✋", label: "aguardando sua decisão" },
  approved: { icon: "🔀", label: "aprovado — subindo" },
  merging: { icon: "🔀", label: "subindo…" },
  merged: { icon: "🚀", label: "entregue" },
  failed: { icon: "❌", label: "falhou" },
  rejected: { icon: "🗑️", label: "rejeitado" },
};

export default function ProjetoPage() {
  const [data, setData] = useState<Projeto | null>(null);
  const [chamados, setChamados] = useState<Chamado[]>([]);

  const load = useCallback(() => {
    fetch("/api/projeto")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
    fetch("/api/oficina")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setChamados(j?.chamados ?? []))
      .catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function decidir(id: string, decision: "approve" | "reject") {
    await fetch("/api/oficina", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    }).catch(() => {});
    load();
  }

  const p = data?.project;

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto min-h-dvh">
      <header className="px-5 pt-6 pb-3">
        <p className="etiqueta text-muted">Projeto em foco</p>
        <h1 className="font-[family-name:var(--font-serif-display)] text-3xl">
          {p ? p.name : "Nenhum aberto"}
        </h1>
        {p?.kind && <p className="text-muted text-xs mt-1">{p.kind}</p>}
      </header>

      <main className="flex-1 px-5 pb-4 space-y-5">
        {/* notas vivas */}
        {p && (
          <section className="rounded-2xl border border-line bg-panel p-4">
            <p className="etiqueta text-muted mb-2">Onde a gente parou</p>
            <p className="text-sm whitespace-pre-wrap">{p.notes ?? "(sem notas ainda — converse com o Oliver dentro do projeto)"}</p>
          </section>
        )}

        {/* esteira da oficina */}
        <section>
          <p className="etiqueta text-muted mb-2">Esteira da oficina</p>
          <div className="space-y-2">
            {chamados.length === 0 && (
              <p className="text-muted text-sm">nenhum chamado ainda — peça ao Oliver: &quot;despacha…&quot;</p>
            )}
            {chamados.map((c) => {
              const e = ESTADO[c.status] ?? { icon: "•", label: c.status };
              return (
                <div key={c.id} className="rounded-xl border border-line bg-panel p-3">
                  <div className="flex items-start gap-2">
                    <span>{e.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{c.request}</p>
                      <p className="etiqueta text-muted mt-1">
                        {e.label} · {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {c.pipeline === "direto" ? " · direto" : ""}
                      </p>
                    </div>
                  </div>
                  {c.status === "built" && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => decidir(c.id, "approve")}
                        className="flex-1 rounded-lg bg-gold text-background py-2 text-sm font-semibold"
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => decidir(c.id, "reject")}
                        className="flex-1 rounded-lg border border-line py-2 text-sm text-muted"
                      >
                        Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* últimas conversas do projeto */}
        {p && (data?.turns?.length ?? 0) > 0 && (
          <section>
            <p className="etiqueta text-muted mb-2">Últimas conversas deste projeto</p>
            <div className="space-y-1.5">
              {data!.turns!.map((t, i) => (
                <p key={i} className="text-xs text-muted">
                  <span className="text-gold">{t.role === "cris" ? "Senhor" : "Oliver"}:</span>{" "}
                  {t.content.slice(0, 120)}
                  {t.content.length > 120 ? "…" : ""}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* outros projetos */}
        {(data?.projects?.length ?? 0) > 0 && (
          <section>
            <p className="etiqueta text-muted mb-2">Todos os projetos</p>
            <div className="flex flex-wrap gap-2">
              {data!.projects.map((pr) => (
                <span
                  key={pr.id}
                  className={`px-3 py-1.5 rounded-lg border text-xs ${
                    pr.in_focus ? "border-gold text-gold" : "border-line text-muted"
                  }`}
                >
                  {pr.name}
                </span>
              ))}
            </div>
            <p className="etiqueta text-muted mt-2">para trocar: &quot;Oliver, abre o projeto X&quot;</p>
          </section>
        )}

        <Link href="/" className="etiqueta text-muted inline-block">
          ← voltar ao Oliver
        </Link>
      </main>

      <BottomNav />
    </div>
  );
}
