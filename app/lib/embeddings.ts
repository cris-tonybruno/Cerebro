import { logUsage } from "./costs";

const MODEL = "text-embedding-3-small"; // 1536 dims — casa com o schema

// Gera embeddings via OpenAI e registra o custo no contador.
export async function embed(texts: string[], purpose = "embedding"): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  await logUsage({
    provider: "openai",
    model: MODEL,
    purpose,
    input_tokens: json.usage?.prompt_tokens ?? 0,
    output_tokens: 0,
  });
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}
