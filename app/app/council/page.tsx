"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Advisor = { advisor: string; label: string | null; ok: boolean; text: string };
type Review = { advisor: string; ok: boolean; text: string };
type Session = {
  id: string;
  created_at: string;
  question: string;
  opinions: Advisor[];
  reviews: Review[];
  synthesis: string;
};

export default function CouncilPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("sintese");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/council")
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then((j) => setSessions(j.sessions ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto min-h-dvh">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="font-bold tracking-widest text-sm">🏛️ CONSELHO</h1>
        <Link href="/" className="text-xs text-zinc-400 underline underline-offset-2">
          ← chat
        </Link>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 pb-8">
        {loading && <p className="text-zinc-500 text-sm">carregando…</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-16">
            Nenhuma sessão ainda. Pede no chat: &quot;convoca o conselho sobre...&quot;
          </p>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="rounded-xl border border-zinc-800 overflow-hidden">
            <button
              onClick={() => {
                setOpen(open === s.id ? null : s.id);
                setTab("sintese");
              }}
              className="w-full text-left px-4 py-3 bg-zinc-900/50"
            >
              <p className="text-sm font-medium">{s.question}</p>
              <p className="text-xs text-zinc-500 mt-1">
                {s.created_at.slice(0, 16).replace("T", " ")} ·{" "}
                {s.opinions?.filter((o) => o.ok).length ?? 0} conselheiros
              </p>
            </button>

            {open === s.id && (
              <div className="border-t border-zinc-800">
                <div className="flex gap-1 px-3 pt-3 flex-wrap">
                  <TabBtn active={tab === "sintese"} onClick={() => setTab("sintese")}>
                    síntese
                  </TabBtn>
                  {(s.opinions ?? [])
                    .filter((o) => o.ok)
                    .map((o) => (
                      <TabBtn
                        key={o.advisor}
                        active={tab === o.advisor}
                        onClick={() => setTab(o.advisor)}
                      >
                        {o.advisor}
                      </TabBtn>
                    ))}
                  <TabBtn active={tab === "revisoes"} onClick={() => setTab("revisoes")}>
                    revisões
                  </TabBtn>
                </div>
                <div className="px-4 py-3 text-sm whitespace-pre-wrap text-zinc-200">
                  {tab === "sintese" && s.synthesis}
                  {tab === "revisoes" &&
                    (s.reviews ?? [])
                      .filter((r) => r.ok)
                      .map((r) => `── ${r.advisor} ──\n${r.text}`)
                      .join("\n\n")}
                  {tab !== "sintese" &&
                    tab !== "revisoes" &&
                    (s.opinions ?? []).find((o) => o.advisor === tab)?.text}
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs border ${
        active ? "bg-zinc-100 text-zinc-950 border-zinc-100" : "border-zinc-700 text-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}
