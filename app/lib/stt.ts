import { logUsage } from "./costs";

// STT compartilhado (PWA e Telegram) — Whisper API.
export async function transcribe(audio: Blob, filename = "audio.webm"): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`whisper ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  await logUsage({
    provider: "openai",
    model: "whisper-1",
    purpose: "stt",
    input_tokens: Math.max(1, Math.round(json.duration ?? 0)), // 1 "token" = 1 segundo
    output_tokens: 0,
  });
  return (json.text ?? "").trim();
}
