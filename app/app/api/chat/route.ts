import { runTurn } from "@/lib/brain";

export const maxDuration = 300; // conselho leva 1-2 min (3 estágios)

export async function POST(req: Request) {
  const { message, session_id, modality, lat, lng } = await req.json();
  if (!message || !session_id) {
    return Response.json({ error: "message e session_id são obrigatórios" }, { status: 400 });
  }
  const turnModality = modality === "voice" ? "voice" : "text";
  const geo =
    typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await runTurn(
          message,
          session_id,
          turnModality,
          (delta) => {
            controller.enqueue(encoder.encode(delta));
          },
          geo,
          "pwa"
        );
      } catch (err) {
        console.error("chat:", err);
        controller.enqueue(encoder.encode("\n\n[erro no cérebro — tenta de novo]"));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
