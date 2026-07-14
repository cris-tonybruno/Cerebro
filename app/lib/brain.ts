import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";
import { logUsage } from "./costs";
import { buildSystemPrompt, RetrievedMemory } from "./principal";
import { toolDefs, executeTool, ToolContext } from "./tools";
import { Geo, resolvePlace, updateCurrentLocation, getCurrentLocation } from "./geo";
import { getActiveProtocols } from "./protocols";

// O miolo do cérebro, compartilhado entre as bocas (PWA streaming, Telegram, futuras).
// M3: loop agêntico — o Principal decide entre responder direto ou usar ferramentas.

export const CHAT_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";
const MEMORY_MODEL = process.env.CLAUDE_MEMORY_MODEL ?? "claude-haiku-4-5";
const TZ = "America/Toronto";

export const anthropic = new Anthropic();

export type TurnContext = {
  msgEmbedding: number[];
  memories: RetrievedMemory[];
  history: Anthropic.MessageParam[];
  system: string;
  geo: Geo | null;
  place: string | null;
  activeProtocols: string[];
};

export async function getContext(
  message: string,
  session_id: string,
  geoIn?: Geo | null,
  source: string = "pwa"
): Promise<TurnContext> {
  const [msgEmbedding] = await embed([message], "chat_query");

  // Localização: a do turno (PWA) ou a última conhecida (Telegram e afins).
  // Posição fresca > 30 min é melhor que nada, mas o prompt deixa claro que é a última vista.
  let geo: Geo | null = geoIn ?? null;
  let place: string | null = null;
  if (geo) {
    place = await resolvePlace(geo);
    await updateCurrentLocation(geo, source, place);
  } else {
    const last = await getCurrentLocation();
    if (last) {
      geo = { lat: last.lat, lng: last.lng };
      place = last.place_label ?? (await resolvePlace(geo));
    }
  }

  const [memoriesRes, turnsRes, protocols] = await Promise.all([
    sb().rpc("match_memories", { query_embedding: msgEmbedding, match_count: 8 }),
    sb()
      .from("turns")
      .select("role, content")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(20),
    getActiveProtocols(),
  ]);

  const history: Anthropic.MessageParam[] = (turnsRes.data ?? [])
    .reverse()
    .map((t) => ({
      role: t.role === "cris" ? ("user" as const) : ("assistant" as const),
      content: t.content,
    }));

  const memories = (memoriesRes.data ?? []) as RetrievedMemory[];
  return {
    msgEmbedding,
    memories,
    history,
    geo,
    place,
    activeProtocols: protocols.map((p) => p.name),
    system: buildSystemPrompt(memories, {
      geo,
      place,
      protocolPrompts: protocols.map((p) => p.config?.prompt).filter(Boolean) as string[],
    }),
  };
}

export type TurnResult = {
  text: string;
  route: "direct" | "tool" | "council";
  toolsUsed: string[];
};

const MAX_TOOL_ROUNDS = 4;

// O turno completo com roteamento: streaming opcional via onDelta.
// Rota A (direct): Claude responde sem ferramenta. Rota B (tool): executa e continua.
export async function runTurn(
  message: string,
  session_id: string,
  modality: "text" | "voice" = "text",
  onDelta?: (text: string) => void,
  geo?: Geo | null,
  source: string = "pwa"
): Promise<TurnResult> {
  const ctx = await getContext(message, session_id, geo, source);
  const toolCtx: ToolContext = { geo: ctx.geo, place: ctx.place };

  const messages: Anthropic.MessageParam[] = [
    ...ctx.history,
    { role: "user", content: message },
  ];
  const toolsUsed: string[] = [];
  let fullText = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const stream = anthropic.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 8192,
      system: ctx.system,
      tools: toolDefs,
      messages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullText += event.delta.text;
        onDelta?.(event.delta.text);
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

    if (final.stop_reason !== "tool_use") break;

    // Rota B: executa cada ferramenta pedida e devolve os resultados
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type === "tool_use") {
        toolsUsed.push(block.name);
        const result = await executeTool(block.name, block.input as Record<string, unknown>, toolCtx);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
    }
    messages.push({ role: "assistant", content: final.content });
    messages.push({ role: "user", content: toolResults });

    const sep = fullText.length > 0 && !fullText.endsWith("\n") ? "\n" : "";
    if (sep) {
      fullText += sep;
      onDelta?.(sep);
    }
  }

  const route: "direct" | "tool" | "council" = toolsUsed.includes("convene_council")
    ? "council"
    : toolsUsed.length > 0
      ? "tool"
      : "direct";
  await persistTurn(
    session_id,
    message,
    ctx.msgEmbedding,
    fullText,
    ctx.memories,
    modality,
    route,
    toolsUsed[0] ?? null,
    ctx
  );

  return { text: fullText, route, toolsUsed };
}

// Resposta completa (sem streaming) — usada pelo Telegram e futuras integrações.
export async function answerOnce(
  message: string,
  session_id: string,
  modality: "text" | "voice" = "text"
): Promise<string> {
  const { text } = await runTurn(message, session_id, modality);
  return text;
}

export async function persistTurn(
  session_id: string,
  message: string,
  msgEmbedding: number[],
  responseText: string,
  retrievedMemories: RetrievedMemory[],
  modality: string = "text",
  route: string = "direct",
  toolName: string | null = null,
  turnCtx?: Pick<TurnContext, "geo" | "place" | "activeProtocols">
) {
  const now = new Date().toISOString();
  const extraction = await extractMemories(message, responseText);
  const zone = extraction?.turn_zone ?? "negocios";
  const geoCols = {
    lat: turnCtx?.geo?.lat ?? null,
    lng: turnCtx?.geo?.lng ?? null,
    place_label: turnCtx?.place ?? null,
    active_protocols: turnCtx?.activeProtocols?.length ? turnCtx.activeProtocols : null,
  };

  const [respEmbedding] = await embed([responseText.slice(0, 8000)], "chat_persist");

  const { data: crisTurn, error: turnErr } = await sb()
    .from("turns")
    .insert({
      session_id,
      role: "cris",
      modality,
      content: message,
      route,
      tool_name: toolName,
      local_datetime: now,
      timezone: TZ,
      zone,
      embedding: msgEmbedding,
      ...geoCols,
    })
    .select("id")
    .single();
  if (turnErr) console.error("insert cris turn:", turnErr.message);

  const { error: brainErr } = await sb().from("turns").insert({
    session_id,
    role: "brain",
    modality,
    content: responseText,
    route,
    tool_name: toolName,
    local_datetime: now,
    timezone: TZ,
    zone,
    embedding: respEmbedding,
    ...geoCols,
  });
  if (brainErr) console.error("insert brain turn:", brainErr.message);

  const { error: tpErr } = await sb().from("training_pairs").insert({
    prompt: message,
    completion: responseText,
    context: {
      datetime: now,
      timezone: TZ,
      route,
      tool_name: toolName,
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
