import { createHash } from "crypto";
import { sb } from "./supabase";
import { logUsage } from "./costs";

// TTS compartilhado (PWA e Telegram) — ElevenLabs com cache em Supabase Storage
// por hash do texto (diretiva §3.1: mesma fala nunca é gerada duas vezes).

const TTS_MODEL = "eleven_flash_v2_5";
const MAX_CHARS = 1500;

export async function synthesize(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !text.trim()) return null;

  const voice = process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB"; // Adam (multilíngue)
  const clipped = text.slice(0, MAX_CHARS);
  const hash = createHash("sha256").update(`${voice}:${TTS_MODEL}:${clipped}`).digest("hex");
  const path = `tts/${hash}.mp3`;

  const { data: cached } = await sb().storage.from("audio").download(path);
  if (cached) return Buffer.from(await cached.arrayBuffer());

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text: clipped, model_id: TTS_MODEL }),
    }
  );
  if (!res.ok) {
    console.error("elevenlabs:", res.status, await res.text());
    return null;
  }

  const audio = Buffer.from(await res.arrayBuffer());
  await logUsage({
    provider: "elevenlabs",
    model: TTS_MODEL,
    purpose: "tts",
    input_tokens: clipped.length, // 1 "token" = 1 caractere
    output_tokens: 0,
  });

  const { error: upErr } = await sb()
    .storage.from("audio")
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (upErr) console.error("tts cache upload:", upErr.message);

  return audio;
}
