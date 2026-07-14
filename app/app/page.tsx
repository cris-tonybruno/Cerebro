"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "cris" | "brain"; content: string };
type Costs = { month_cad: number; budget_cad: number; pct: number };
type MicState = "idle" | "recording" | "transcribing";

function getSessionId(): string {
  let id = localStorage.getItem("cerebro_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cerebro_session", id);
  }
  return id;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [costs, setCosts] = useState<Costs | null>(null);
  const [mic, setMic] = useState<MicState>("idle");
  const [speaker, setSpeaker] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSpeaker(localStorage.getItem("cerebro_speaker") !== "off");
  }, []);

  // Silenciar: corta a fala em curso NA HORA e desliga as próximas
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
      if (!res.ok) return; // 503 = TTS não configurado; segue mudo
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
      // autoplay bloqueado ou rede — falha silenciosa, o texto já está na tela
      setSpeaking(false);
    }
  }

  useEffect(() => {
    fetch("/api/costs")
      .then((r) => (r.ok ? r.json() : null))
      .then(setCosts)
      .catch(() => {});
  }, [sending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({ message: trimmed, session_id: getSessionId(), modality }),
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
          copy[copy.length - 1] = {
            role: "brain",
            content: copy[copy.length - 1].content + chunk,
          };
          return copy;
        });
      }
      // turno de voz → resposta falada (se o alto-falante estiver ligado)
      if (modality === "voice" && speaker && fullResponse.trim()) {
        speak(fullResponse);
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "brain",
          content: copy[copy.length - 1].content || "[erro de conexão — tenta de novo]",
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
          if (res.ok && json.text) {
            await send(json.text, "voice");
          } else if (res.ok) {
            setInput("(não entendi o áudio — tenta de novo)");
          }
        } catch {
          setInput("(erro na transcrição)");
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
      alert("Não consegui acessar o microfone. Verifica a permissão do browser.");
    }
  }

  function newSession() {
    localStorage.setItem("cerebro_session", crypto.randomUUID());
    setMessages([]);
  }

  const pctWarn = costs && costs.pct >= 80;

  return (
    <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto h-dvh">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h1 className="font-bold tracking-widest text-sm">CÉREBRO</h1>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          {costs && (
            <span className={pctWarn ? "text-amber-400 font-semibold" : ""}>
              ${costs.month_cad.toFixed(2)} / ${costs.budget_cad} CAD
            </span>
          )}
          <Link href="/memory" className="underline underline-offset-2">
            memória
          </Link>
          <Link href="/council" className="underline underline-offset-2">
            conselho
          </Link>
          <a href="/api/export?format=json" className="underline underline-offset-2">
            export
          </a>
          <button onClick={newSession} className="underline underline-offset-2">
            nova
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-sm text-center mt-16">
            Fala comigo — por texto ou pelo 🎤. Eu escuto, lembro e respondo.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "cris" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "cris"
                  ? "bg-zinc-100 text-zinc-950 rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] whitespace-pre-wrap"
                  : "bg-zinc-800 text-zinc-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] whitespace-pre-wrap"
              }
            >
              {m.content || (sending && i === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      <footer className="px-4 pb-4 pt-2 border-t border-zinc-800">
        <div className="flex gap-2 items-end">
          <button
            onClick={toggleMic}
            disabled={sending}
            title={mic === "recording" ? "Parar, transcrever e enviar" : "Gravar áudio"}
            className={`rounded-xl px-4 py-3 text-lg border transition-colors disabled:opacity-40 min-w-[64px] ${
              mic === "recording"
                ? "bg-red-600 border-red-500 animate-pulse font-mono text-sm"
                : mic === "transcribing"
                  ? "bg-zinc-800 border-zinc-700 opacity-60"
                  : "bg-zinc-900 border-zinc-700"
            }`}
          >
            {mic === "recording"
              ? `■ ${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`
              : mic === "transcribing"
                ? "…"
                : "🎤"}
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
            placeholder={
              mic === "recording"
                ? "gravando… fala à vontade, aperta ■ quando terminar"
                : mic === "transcribing"
                  ? "transcrevendo…"
                  : "Escreve aqui…"
            }
            className="flex-1 resize-none rounded-xl bg-zinc-900 border border-zinc-700 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-500"
          />
          <button
            onClick={toggleSpeaker}
            title={
              speaking
                ? "Calar agora"
                : speaker
                  ? "Voz ligada — toca pra silenciar"
                  : "Voz desligada — toca pra ligar"
            }
            className={`rounded-xl px-4 py-3 text-lg border transition-colors ${
              speaking
                ? "bg-emerald-700 border-emerald-500 animate-pulse"
                : speaker
                  ? "bg-zinc-900 border-zinc-700"
                  : "bg-zinc-900 border-zinc-800 opacity-50"
            }`}
          >
            {speaker ? "🔊" : "🔇"}
          </button>
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="rounded-xl bg-zinc-100 text-zinc-950 px-5 py-3 font-semibold disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </footer>
    </div>
  );
}
