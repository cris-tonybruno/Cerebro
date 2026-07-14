import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { logUsage } from "./costs";
import { embed } from "./embeddings";

// M7 — Visão e extração de documentos. O modelo barato (Haiku) vê/extrai;
// a resposta ao Cris continua com o Principal no runTurn.

const anthropic = new Anthropic();
const MEDIA_MODEL = process.env.CLAUDE_MEMORY_MODEL ?? "claude-haiku-4-5";

type ImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export async function describeImage(bytes: Buffer, mime: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: MEDIA_MODEL,
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (mime as ImageMime) ?? "image/jpeg",
              data: bytes.toString("base64"),
            },
          },
          {
            type: "text",
            text:
              "Descreva esta foto em português, em ~120 palavras, para o arquivo de memória do Cris " +
              "(carpinteiro/supervisor de framing). Inclua: o que aparece, qualquer TEXTO visível " +
              "(placas, medidas, etiquetas, documentos), e contexto de construção se houver " +
              "(estrutura, material, fase da obra). Seja factual — é um registro, não uma opinião.",
          },
        ],
      },
    ],
  });
  await logUsage({
    provider: "anthropic",
    model: MEDIA_MODEL,
    purpose: "media_extract",
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function extractDoc(bytes: Buffer, mime: string, filename: string): Promise<string> {
  // Texto puro: lê direto
  if (mime.startsWith("text/") || /\.(txt|md|csv)$/i.test(filename)) {
    const text = bytes.toString("utf-8").slice(0, 6000);
    return `Conteúdo de ${filename}:\n${text}`;
  }

  // PDF: o Claude lê nativamente
  if (mime === "application/pdf" || /\.pdf$/i.test(filename)) {
    const res = await anthropic.messages.create({
      model: MEDIA_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: bytes.toString("base64"),
              },
            },
            {
              type: "text",
              text:
                "Extraia o essencial deste documento em português (~200 palavras) para o arquivo " +
                "de memória do Cris: do que se trata, dados-chave (valores, datas, nomes, medidas), " +
                "e qualquer prazo ou ação necessária.",
            },
          ],
        },
      ],
    });
    await logUsage({
      provider: "anthropic",
      model: MEDIA_MODEL,
      purpose: "media_extract",
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
    });
    return (
      `Documento ${filename}:\n` +
      res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
    );
  }

  return `documento "${filename}" (${mime}) guardado, mas esse formato eu ainda não sei ler — sei PDF e texto.`;
}

// Lições de visão relevantes para uma descrição (few-shot do apprentice):
// o que o Cris já ensinou sobre imagens parecidas entra no contexto.
export async function lessonsFor(description: string): Promise<string> {
  try {
    const [emb] = await embed([description], "vision_lessons");
    const { data } = await sb().rpc("match_vision_lessons", {
      query_embedding: emb,
      match_count: 3,
    });
    const relevant = ((data ?? []) as {
      cris_label: string;
      machine_description: string;
      confirmed_count: number;
      similarity: number;
    }[]).filter((l) => l.similarity > 0.45);
    if (relevant.length === 0) return "";
    return (
      "\n[LIÇÕES QUE O CRIS JÁ TE ENSINOU sobre imagens parecidas — aplique se couber e, " +
      "se aplicar, diga a identificação com confiança e peça só confirmação]:\n" +
      relevant
        .map(
          (l) =>
            `- Numa imagem parecida ("${l.machine_description.slice(0, 120)}..."), o Cris ensinou: "${l.cris_label}" (confirmado ${l.confirmed_count}x)`
        )
        .join("\n")
    );
  } catch (err) {
    console.error("lessonsFor:", err);
    return "";
  }
}

// Registra uma lição: o Cris disse o que É algo na última foto enviada.
export async function teachVision(
  label: string,
  sessionId: string,
  confirm: boolean
): Promise<string> {
  const clean = label.trim();
  if (!clean && !confirm) return "rótulo vazio";

  // acha a última foto (da sessão; se não houver, a mais recente em 6h)
  let { data: photoTurn } = await sb()
    .from("turns")
    .select("content, attachment_path, created_at")
    .eq("modality", "image")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!photoTurn) {
    const res = await sb()
      .from("turns")
      .select("content, attachment_path, created_at")
      .eq("modality", "image")
      .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    photoTurn = res.data;
  }
  if (!photoTurn) return "não achei nenhuma foto recente para associar a lição";

  const marker = "o que você vê nela]: ";
  const idx = photoTurn.content.indexOf(marker);
  const description =
    idx >= 0 ? photoTurn.content.slice(idx + marker.length).trim() : photoTurn.content.trim();

  const [emb] = await embed([description], "vision_lessons");

  // lição quase idêntica já existe? reforça em vez de duplicar
  const { data: similar } = await sb().rpc("match_vision_lessons", {
    query_embedding: emb,
    match_count: 1,
  });
  const best = (similar ?? [])[0] as
    | { id: string; cris_label: string; confirmed_count: number; similarity: number }
    | undefined;

  if (best && best.similarity > 0.92) {
    await sb()
      .from("vision_lessons")
      .update({
        confirmed_count: best.confirmed_count + 1,
        ...(clean && !confirm ? { cris_label: clean } : {}),
      })
      .eq("id", best.id);
    return confirm
      ? `lição reforçada (${best.confirmed_count + 1}x): "${best.cris_label}"`
      : `lição corrigida e reforçada: "${clean}"`;
  }

  if (!clean) return "não havia lição parecida para confirmar — me diga o que é, que eu aprendo";

  const { error } = await sb().from("vision_lessons").insert({
    machine_description: description.slice(0, 2000),
    cris_label: clean,
    image_path: photoTurn.attachment_path ?? null,
    embedding: emb,
  });
  if (error) return `falha ao registrar lição: ${error.message}`;
  return `lição aprendida: "${clean}" — vou reconhecer isso nas próximas fotos parecidas`;
}

export async function storeFile(
  bucket: "photos" | "docs",
  path: string,
  bytes: Buffer,
  contentType: string
): Promise<string | null> {
  const { error } = await sb()
    .storage.from(bucket)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) {
    console.error(`storage ${bucket}:`, error.message);
    return null;
  }
  return `${bucket}/${path}`;
}
