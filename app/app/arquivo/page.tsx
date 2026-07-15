"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";

type Arquivo = {
  total_cad: number;
  budget_cad: number;
  assentos: Record<string, number>;
  sessions: {
    session_id: string;
    started: string;
    title: string;
    protocols: string[];
    conselho: boolean;
    voz: boolean;
    turnos: number;
  }[];
};

const NOMES: Record<string, string> = {
  principal: "Claude · principal",
  conselho: "Conselho · assentos",
  voz: "Voz · ouvir + falar",
  memoria: "Memória · índice",
};

export default function ArquivoPage() {
  const [data, setData] = useState<Arquivo | null>(null);

  useEffect(() => {
    fetch("/api/arquivo")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, []);

  const pct = data ? Math.min(100, (data.total_cad / data.budget_cad) * 100) : 0;
  const mes = new Date().toLocaleDateString("pt-BR", { month: "long" });

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto min-h-dvh">
      <header className="px-5 pt-6 pb-3">
        <h1 className="font-[family-name:var(--font-serif-display)] text-3xl">Arquivo</h1>
      </header>

      <main className="flex-1 px-5 pb-4 space-y-5">
        {!data && <p className="text-muted text-sm">carregando…</p>}

        {data && (
          <>
            {/* custo em dinheiro, por assento */}
            <section className="rounded-2xl border border-line bg-panel p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="font-[family-name:var(--font-geist-mono)] text-2xl text-gold">
                  ${data.total_cad.toFixed(2)}
                </span>
                <span className="etiqueta text-muted">
                  {pct.toFixed(0)}% · {mes}
                </span>
              </div>
              <div className="h-1 bg-line rounded">
                <div className="h-1 bg-gold rounded" style={{ width: `${pct}%` }} />
              </div>
              <div className="space-y-1.5 pt-1">
                {Object.entries(data.assentos)
                  .filter(([, v]) => v > 0.001)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-muted">{NOMES[k] ?? k}</span>
                      <span className="font-[family-name:var(--font-geist-mono)]">${v.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </section>

            {/* conversas etiquetadas pelo protocolo */}
            <section>
              <p className="etiqueta text-muted mb-2">Conversas salvas</p>
              <div className="space-y-2">
                {data.sessions.map((s) => (
                  <div key={s.session_id} className="rounded-xl border border-line bg-panel p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium flex-1">{s.title || "(sem título)"}</p>
                      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                        {s.conselho && (
                          <span className="etiqueta px-2 py-0.5 rounded border border-golddim text-gold">
                            conselho
                          </span>
                        )}
                        {s.protocols.map((p) => (
                          <span key={p} className="etiqueta px-2 py-0.5 rounded border border-line text-muted">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="etiqueta text-muted mt-1.5">
                      {new Date(s.started).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      {" · "}
                      {new Date(s.started).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}
                      {s.turnos} {s.turnos === 1 ? "turno" : "turnos"}
                      {s.voz ? " · voz" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <BottomNav active="arquivo" />
    </div>
  );
}
