import { anthropic, CHAT_MODEL, getContext, persistTurn } from "@/lib/brain";
import { logUsage } from "@/lib/costs";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { message, session_id, modality } = await req.json();
  if (!message || !session_id) {
    return Response.json({ error: "message e session_id são obrigatórios" }, { status: 400 });
  }
  const turnModality = modality === "voice" ? "voice" : "text";

  const ctx = await getContext(message, session_id);

  const stream = anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 8192,
    system: ctx.system,
    messages: [...ctx.history, { role: "user", content: message }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let responseText = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            responseText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        await logUsage({
          provider: "anthropic",
          model: CHAT_MODEL,
          purpose: "chat",
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
        });
        // Persistência antes de fechar o stream (simples e garantido)
        await persistTurn(
          session_id,
          message,
          ctx.msgEmbedding,
          responseText,
          ctx.memories,
          turnModality
        );
      } catch (err) {
        console.error("chat stream:", err);
        controller.enqueue(encoder.encode("\n\n[erro no cérebro — tenta de novo]"));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
