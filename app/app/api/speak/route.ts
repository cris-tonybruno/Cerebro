import { synthesize } from "@/lib/tts";

// TTS — devolve MP3 da fala (cacheado por hash em Supabase Storage).
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return Response.json({ error: "tts não configurado" }, { status: 503 });
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return Response.json({ error: "text é obrigatório" }, { status: 400 });
  }

  const audio = await synthesize(text);
  if (!audio) {
    return Response.json({ error: "falha no TTS" }, { status: 502 });
  }

  return new Response(new Uint8Array(audio), {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
