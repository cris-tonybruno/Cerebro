"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

type Msg = { role: "cris" | "brain"; content: string };
type MicState = "idle" | "recording" | "transcribing";
type Home = {
  place: string | null;
  tempC: number | null;
  month_cad: number;
  budget_cad: number;
  pct: number;
  activeProtocols: string[];
  project: { name: string } | null;
  aguardando_decisao: number;
};
type Approval = { id: string; created_at: string; action: string; summary: string; status: string };

function getSessionId(): string {
  let id = localStorage.getItem("cerebro_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cerebro_session", id);
  }
  return id;
}

function saudacao(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada, senhor.";
  if (h < 12) return "Bom dia, senhor.";
  if (h < 18) return "Boa tarde, senhor.";
  return "Boa noite, senhor.";
}

function dataDeHoje(): string {
  const s = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function OliverPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [home, setHome] = useState<Home | null>(null);
  const [mic, setMic] = useState<MicState>("idle");
  const [speaker, setSpeaker] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geoRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    setSpeaker(localStorage.getItem("cerebro_speaker") !== "off");
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          geoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 120000, timeout: 15000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    fetch("/api/home")
      .then((r) => (r.ok ? r.json() : null))
      .then(setHome)
      .catch(() => {});
    fetch("/api/approvals")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setApprovals((j?.approvals ?? []).filter((a: Approval) => a.status === "pending")))
      .catch(() => {});
  }, [sending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleSpeaker() {
    const next = !speaker;
    setSpeaker(next);
    localStorage.setItem("cerebro_speaker", next ? "on" : "off");
    if (!next) {
      audioRef.current?.pause();
      setSpeaking(false);
    }
  }

  async function speak(text: string) {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setSpeaking(false);
      };
      audio.onpause = () => setSpeaking(false);
      setSpeaking(true);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  }

  async function decide(id: string, decision: "approved" | "denied") {
    setApprovals((a) => a.filter((x) => x.id !== id));
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    }).catch(() => {});
  }

  async function send(text: string, modality: "text" | "voice" = "text") {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    setMessages((m) => [...m, { role: "cris", content: trimmed }, { role: "brain", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          session_id: getSessionId(),
          modality,
          lat: geoRef.current?.lat,
          lng: geoRef.current?.lng,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "brain", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
      if (modality === "voice" && speaker && fullResponse.trim()) speak(fullResponse);
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "brain",
          content: copy[copy.length - 1].content || "[erro de conexão — tenta de novo, senhor]",
        };
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  async function toggleMic() {
    if (mic === "transcribing") return;
    if (mic === "recording") {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setMic("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "audio.webm");
          const res = await fetch("/api/listen", { method: "POST", body: form });
          const json = await res.json();
          if (res.ok && json.text) await send(json.text, "voice");
        } catch {
          /* segue */
        } finally {
          setMic("idle");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setMic("recording");
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      alert("Não consegui acessar o microfone, senhor. Verifique a permissão do browser.");
    }
  }

  function novaSessao() {
    localStorage.setItem("cerebro_session", crypto.randomUUID());
    setMessages([]);
  }

  const repouso = messages.length === 0;
  const pctWarn = home && home.pct >= 80;

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto h-dvh">
      {/* ── cabeçalho ── */}
      <header className="px-5 pt-5 pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className={`font-[family-name:var(--font-serif-display)] text-foreground ${repouso ? "text-3xl" : "text-lg"}`}
            >
              {saudacao()}
            </h1>
            <p className="text-muted text-xs mt-1">
              {dataDeHoje()}
              {home?.place ? ` · ${home.place}` : ""}
              {home?.tempC != null ? ` · ${home.tempC}°C` : ""}
            </p>
            {repouso && <p className="text-muted text-xs mt-2">Às suas ordens.</p>}
          </div>
          {home && (
            <div className="text-right shrink-0">
              <p className={`font-[family-name:var(--font-geist-mono)] text-sm ${pctWarn ? "text-amber-400" : "text-gold"}`}>
                ${home.month_cad.toFixed(2)}
              </p>
              <div className="w-16 h-0.5 bg-line mt-1 ml-auto">
                <div
                  className="h-0.5 bg-gold"
                  style={{ width: `${Math.min(100, home.pct)}%` }}
                />
              </div>
              <p className="etiqueta text-muted mt-1">de ${home.budget_cad}/mês</p>
            </div>
          )}
        </div>
      </header>

      {/* ── corpo ── */}
      {repouso ? (
        <main className="flex-1 flex flex-col items-center justify-center px-5 gap-8">
          <button
            onClick={toggleMic}
            className={`anel w-44 h-44 text-6xl select-none ${
              mic === "recording" ? "anel-vivo" : mic === "transcribing" ? "opacity-60" : ""
            }`}
          >
            {mic === "transcribing" ? "…" : "O"}
          </button>
          <p className="etiqueta text-muted -mt-4">
            {mic === "recording"
              ? `ouvindo · ${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")} · toque para enviar`
              : mic === "transcribing"
                ? "transcrevendo…"
                : "toque e fale"}
          </p>

          {home && (home.activeProtocols.length > 0 || home.project || home.aguardando_decisao > 0) && (
            <div className="w-full">
              <p className="etiqueta text-muted mb-2">Ativos agora</p>
              <div className="flex flex-wrap gap-2">
                {home.activeProtocols.map((p) => (
                  <span key={p} className="px-3 py-1.5 rounded-lg border border-golddim text-gold text-xs">
                    Protocolo {p}
                  </span>
                ))}
                {home.project && (
                  <Link
                    href="/projeto"
                    className="px-3 py-1.5 rounded-lg border border-line text-foreground text-xs"
                  >
                    Projeto · {home.project.name}
                  </Link>
                )}
                {home.aguardando_decisao > 0 && (
                  <Link
                    href="/projeto"
                    className="px-3 py-1.5 rounded-lg border border-gold bg-gold/10 text-gold text-xs"
                  >
                    ✋ {home.aguardando_decisao} aguardando decisão
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 etiqueta text-muted">
            <Link href="/projeto">projeto</Link>
            <Link href="/council">conselho</Link>
            <Link href="/audit">auditoria</Link>
            <a href="/api/export?format=json">exportar</a>
          </div>
        </main>
      ) : (
        <main className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "cris" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "cris"
                    ? "bg-panel2 border border-line rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%] whitespace-pre-wrap text-sm"
                    : "bg-panel border border-line rounded-2xl rounded-bl-sm px-4 py-2.5 max-w-[85%] whitespace-pre-wrap text-sm"
                }
              >
                {m.content || (sending && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </main>
      )}

      {/* ── approval cards ── */}
      {approvals.length > 0 && (
        <div className="px-5 pb-2 space-y-2">
          {approvals.map((a) => (
            <div key={a.id} className="rounded-xl border border-gold bg-gold/10 p-3 space-y-2">
              <p className="etiqueta text-gold">✋ Aprovação necessária</p>
              <p className="text-sm">{a.summary}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => decide(a.id, "approved")}
                  className="flex-1 rounded-lg bg-gold text-background py-2 text-sm font-semibold"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => decide(a.id, "denied")}
                  className="flex-1 rounded-lg border border-line py-2 text-sm text-muted"
                >
                  Negar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── entrada (conversa) ── */}
      {!repouso && (
        <footer className="px-4 pb-2 pt-2 border-t border-line">
          <div className="flex gap-2 items-end">
            <button
              onClick={toggleMic}
              disabled={sending}
              className={`anel w-12 h-12 text-xl shrink-0 disabled:opacity-40 ${
                mic === "recording" ? "anel-vivo" : ""
              }`}
            >
              {mic === "recording"
                ? `${recSeconds}s`
                : mic === "transcribing"
                  ? "…"
                  : "O"}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder={mic === "recording" ? "ouvindo, senhor…" : "Escreva, senhor…"}
              className="flex-1 resize-none rounded-xl bg-panel border border-line px-4 py-3 text-sm outline-none focus:border-golddim"
            />
            <button
              onClick={toggleSpeaker}
              className={`rounded-xl px-3 py-3 border text-sm ${
                speaking ? "border-gold text-gold anel-vivo" : speaker ? "border-line" : "border-line opacity-40"
              }`}
            >
              {speaker ? "🔊" : "🔇"}
            </button>
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="rounded-xl bg-gold text-background px-4 py-3 font-semibold disabled:opacity-40"
            >
              ➤
            </button>
          </div>
          <button onClick={novaSessao} className="etiqueta text-muted mt-2">
            nova sessão
          </button>
        </footer>
      )}

      {/* ── entrada de texto no repouso ── */}
      {repouso && (
        <div className="px-5 pb-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="ou escreva, senhor…"
            className="w-full rounded-xl bg-panel border border-line px-4 py-2.5 text-sm outline-none focus:border-golddim"
          />
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
}
