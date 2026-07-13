import { transcribe } from "@/lib/stt";

// STT — recebe áudio do push-to-talk da PWA, devolve transcrição.
export const maxDuration = 60;

export async function POST(req: Request) {
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return Response.json({ error: "áudio ausente" }, { status: 400 });
  }

  try {
    const text = await transcribe(audio, "audio.webm");
    return Response.json({ text });
  } catch (err) {
    console.error("listen:", err);
    return Response.json({ error: "falha na transcrição" }, { status: 502 });
  }
}
