import { createHash } from "crypto";
import { sb } from "@/lib/supabase";
import { logUsage } from "@/lib/costs";

// TTS — ElevenLabs, com cache em Supabase Storage por hash do texto (diretiva §3.1:
// mesma fala nunca é gerada duas vezes). Sem chave configurada, responde 503 e a UI
// segue muda — o chat por texto não depende disso.

export const maxDuration = 60;

const TTS_MODEL = "eleven_flash_v2_5"; // rápido e bom em PT-BR — latência de walkie-talkie
const MAX_CHARS = 1500; // protege créditos; respostas de voz devem ser curtas mesmo

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "tts não configurado" }, { status: 503 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return Response.json({ error: "text é obrigatório" }, { status: 400 });
  }

  const voice = process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB"; // Adam (multilíngue)
  const clipped = text.slice(0, MAX_CHARS);
  const hash = createHash("sha256").update(`${voice}:${TTS_MODEL}:${clipped}`).digest("hex");
  const path = `tts/${hash}.mp3`;

  // 1. Cache primeiro
  const { data: cached } = await sb().storage.from("audio").download(path);
  if (cached) {
    return new Response(cached, {
      headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "hit" },
    });
  }

  // 2. Gera no ElevenLabs
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
    return Response.json({ error: "falha no TTS" }, { status: 502 });
  }

  const audio = Buffer.from(await res.arrayBuffer());
  await logUsage({
    provider: "elevenlabs",
    model: TTS_MODEL,
    purpose: "tts",
    input_tokens: clipped.length, // 1 "token" = 1 caractere
    output_tokens: 0,
  });

  // 3. Guarda no cache (falha de upload não impede a resposta)
  const { error: upErr } = await sb()
    .storage.from("audio")
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (upErr) console.error("tts cache upload:", upErr.message);

  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "X-TTS-Cache": "miss" },
  });
}
