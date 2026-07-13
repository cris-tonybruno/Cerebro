import { logUsage } from "@/lib/costs";

// STT — Whisper API (OpenAI). Recebe áudio do push-to-talk, devolve transcrição.
export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return Response.json({ error: "áudio ausente" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "audio.webm");
  upstream.append("model", "whisper-1");
  upstream.append("response_format", "verbose_json"); // traz duration p/ custo

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: upstream,
  });

  if (!res.ok) {
    console.error("whisper:", res.status, await res.text());
    return Response.json({ error: "falha na transcrição" }, { status: 502 });
  }

  const json = await res.json();
  await logUsage({
    provider: "openai",
    model: "whisper-1",
    purpose: "stt",
    input_tokens: Math.max(1, Math.round(json.duration ?? 0)), // 1 "token" = 1 segundo
    output_tokens: 0,
  });

  return Response.json({ text: (json.text ?? "").trim() });
}
