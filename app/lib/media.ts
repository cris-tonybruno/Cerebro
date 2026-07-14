import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { logUsage } from "./costs";

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
