import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";
import { logUsage } from "./costs";
import { buildSystemPrompt, RetrievedMemory } from "./principal";

// O miolo do cérebro, compartilhado entre as bocas (PWA streaming, Telegram, futuras).

export const CHAT_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";
const MEMORY_MODEL = process.env.CLAUDE_MEMORY_MODEL ?? "claude-haiku-4-5";
const TZ = "America/Toronto";

export const anthropic = new Anthropic();

export type TurnContext = {
  msgEmbedding: number[];
  memories: RetrievedMemory[];
  history: Anthropic.MessageParam[];
  system: string;
};

export async function getContext(message: string, session_id: string): Promise<TurnContext> {
  const [msgEmbedding] = await embed([message], "chat_query");

  const { data: memories } = await sb().rpc("match_memories", {
    query_embedding: msgEmbedding,
    match_count: 8,
  });

  const { data: recentTurns } = await sb()
    .from("turns")
    .select("role, content")
    .eq("session_id", session_id)
    .order("created_at", { ascending: false })
    .limit(20);

  const history: Anthropic.MessageParam[] = (recentTurns ?? [])
    .reverse()
    .map((t) => ({
      role: t.role === "cris" ? ("user" as const) : ("assistant" as const),
      content: t.content,
    }));

  return {
    msgEmbedding,
    memories: (memories ?? []) as RetrievedMemory[],
    history,
    system: buildSystemPrompt((memories ?? []) as RetrievedMemory[]),
  };
}

// Resposta completa (sem streaming) — usada pelo Telegram e futuras integrações.
export async function answerOnce(
  message: string,
  session_id: string,
  modality: "text" | "voice" = "text"
): Promise<string> {
  const ctx = await getContext(message, session_id);

  const response = await anthropic.messages.create({
    model: CHAT_MODEL,
    max_tokens: 8192,
    system: ctx.system,
    messages: [...ctx.history, { role: "user", content: message }],
  });

  await logUsage({
    provider: "anthropic",
    model: CHAT_MODEL,
    purpose: "chat",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  await persistTurn(session_id, message, ctx.msgEmbedding, text, ctx.memories, modality);
  return text;
}

export async function persistTurn(
  session_id: string,
  message: string,
  msgEmbedding: number[],
  responseText: string,
  retrievedMemories: RetrievedMemory[],
  modality: string = "text"
) {
  const now = new Date().toISOString();
  const extraction = await extractMemories(message, responseText);
  const zone = extraction?.turn_zone ?? "negocios";

  const [respEmbedding] = await embed([responseText.slice(0, 8000)], "chat_persist");

  const { data: crisTurn, error: turnErr } = await sb()
    .from("turns")
    .insert({
      session_id,
      role: "cris",
      modality,
      content: message,
      route: "direct",
      local_datetime: now,
      timezone: TZ,
      zone,
      embedding: msgEmbedding,
    })
    .select("id")
    .single();
  if (turnErr) console.error("insert cris turn:", turnErr.message);

  const { error: brainErr } = await sb().from("turns").insert({
    session_id,
    role: "brain",
    modality,
    content: responseText,
    route: "direct",
    local_datetime: now,
    timezone: TZ,
    zone,
    embedding: respEmbedding,
  });
  if (brainErr) console.error("insert brain turn:", brainErr.message);

  const { error: tpErr } = await sb().from("training_pairs").insert({
    prompt: message,
    completion: responseText,
    context: {
      datetime: now,
      timezone: TZ,
      route: "direct",
      retrieved_memories: retrievedMemories.map((m) => m.content),
    },
    tags: ["m1", zone],
    embedding: msgEmbedding,
  });
  if (tpErr) console.error("insert training_pair:", tpErr.message);

  if (extraction && extraction.memories.length > 0) {
    const contents = extraction.memories.map((m) => m.content);
    const vectors = await embed(contents, "memory_write");
    const rows = extraction.memories.map((m, i) => ({
      kind: m.kind,
      content: m.content,
      zone: m.zone,
      confidence: m.confidence,
      source_turn: crisTurn?.id ?? null,
      embedding: vectors[i],
    }));
    const { error: memErr } = await sb().from("memories").insert(rows);
    if (memErr) console.error("insert memories:", memErr.message);
  }
}

type ExtractedMemory = {
  kind: "fact" | "preference" | "person" | "place" | "routine";
  content: string;
  zone: "pessoal" | "negocios" | "criativo" | "familia";
  confidence: number;
};

type Extraction = {
  turn_zone: "pessoal" | "negocios" | "criativo" | "familia";
  memories: ExtractedMemory[];
};

// Extração de memória semântica — tarefa pequena de classificação → Haiku 4.5
async function extractMemories(message: string, response: string): Promise<Extraction | null> {
  try {
    const result = await anthropic.messages.create({
      model: MEMORY_MODEL,
      max_tokens: 1024,
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              turn_zone: {
                type: "string",
                enum: ["pessoal", "negocios", "criativo", "familia"],
              },
              memories: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      enum: ["fact", "preference", "person", "place", "routine"],
                    },
                    content: { type: "string" },
                    zone: {
                      type: "string",
                      enum: ["pessoal", "negocios", "criativo", "familia"],
                    },
                    confidence: { type: "number" },
                  },
                  required: ["kind", "content", "zone", "confidence"],
                  additionalProperties: false,
                },
              },
            },
            required: ["turn_zone", "memories"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: `Você é o classificador de memória do cérebro pessoal do Cris.

Analise este turno de conversa e:
1. Classifique a zona do turno: pessoal | negocios | criativo | familia
2. Extraia de 0 a 3 memórias semânticas DURÁVEIS sobre o Cris, a vida dele, as pessoas dele,
   os projetos dele ou as preferências dele. Frases simples e legíveis em português.
   Só extraia o que vale lembrar daqui a meses. Conversa trivial = zero memórias.
   Se o Cris pediu explicitamente para guardar/anotar algo, isso SEMPRE vira memória.

CRIS DISSE:
${message}

CÉREBRO RESPONDEU:
${response.slice(0, 4000)}`,
        },
      ],
    });

    await logUsage({
      provider: "anthropic",
      model: MEMORY_MODEL,
      purpose: "memory_extract",
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    });

    const text = result.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return JSON.parse(text.text) as Extraction;
  } catch (err) {
    console.error("extractMemories:", err);
    return null;
  }
}
