import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";
import { logUsage, monthUsage } from "./costs";

// M4 — O Conselho (diretiva §3.4, padrão Karpathy adaptado):
// Estágio 1: opiniões em paralelo (4 membros via OpenRouter + Claude)
// Estágio 2: revisão anônima entre pares (Advisor A–E)
// Estágio 3: síntese do Presidente (Claude) com teto de saída
// Regras duras: zona pessoal/familia NUNCA vai para membros terceiros;
// budget estourado = conselho desativado; sessão inteira gravada.

const anthropic = new Anthropic();
const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

type Member = { id: string; name: string };

function members(): Member[] {
  const csv =
    process.env.COUNCIL_MODELS ??
    "openai/gpt-5,google/gemini-2.5-pro,x-ai/grok-4,deepseek/deepseek-r1";
  return csv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ({ id, name: id.split("/")[1]?.split(":")[0] ?? id }));
  // assento dormente (diretiva §3.4): 6º conselheiro `psych` — reservado, não implementado
}

async function askOpenRouter(
  model: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      usage: { include: true },
    }),
  });
  if (!res.ok) throw new Error(`${model}: ${res.status} ${await res.text()}`);
  const json = await res.json();
  await logUsage({
    provider: "openrouter",
    model,
    purpose: "council",
    input_tokens: json.usage?.prompt_tokens ?? 0,
    output_tokens: json.usage?.completion_tokens ?? 0,
    cost_usd: json.usage?.cost ?? 0,
  });
  return json.choices?.[0]?.message?.content ?? "";
}

async function askClaude(prompt: string, maxTokens: number): Promise<string> {
  const res = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  await logUsage({
    provider: "anthropic",
    model: CLAUDE_MODEL,
    purpose: "council",
    input_tokens: res.usage.input_tokens,
    output_tokens: res.usage.output_tokens,
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function runCouncil(question: string): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    return (
      "O conselho ainda não está configurado — falta a chave do OpenRouter " +
      "(openrouter.ai, ~$5 de crédito). Avise o Cris."
    );
  }

  // Trava de budget (princípio 9): 100% do mês = conselho desativado
  const usage = await monthUsage();
  if (usage.pct >= 100) {
    return `Conselho desativado: o budget do mês estourou (${usage.pct.toFixed(0)}%). Só rota direta até virar o mês.`;
  }

  // Contexto com FILTRO DE ZONA: membros terceiros nunca veem pessoal/familia
  const [qEmbedding] = await embed([question], "council_context");
  const { data: safeMemories } = await sb().rpc("match_memories", {
    query_embedding: qEmbedding,
    match_count: 6,
    exclude_private: true,
  });
  const context =
    (safeMemories ?? []).length > 0
      ? `Contexto relevante sobre o Cris (dono da pergunta):\n${(safeMemories ?? [])
          .map((m: { content: string }) => `- ${m.content}`)
          .join("\n")}\n\n`
      : "";

  const stage1Prompt = (q: string) =>
    `${context}Você é um conselheiro sênior. Dê sua opinião fundamentada e direta sobre a questão abaixo. ` +
    `Seja específico, tome posição, aponte riscos. Responda em português. Máximo ~300 palavras.\n\nQUESTÃO: ${q}`;

  // ── Estágio 1: opiniões em paralelo ──────────────────────────
  const team = members();
  const opinionResults = await Promise.allSettled([
    ...team.map((m) => askOpenRouter(m.id, stage1Prompt(question), 1200)),
    askClaude(stage1Prompt(question), 1200),
  ]);

  const advisorNames = [...team.map((m) => m.name), "claude"];
  const opinions = opinionResults
    .map((r, i) => ({
      advisor: advisorNames[i],
      ok: r.status === "fulfilled",
      text: r.status === "fulfilled" ? r.value : `(falhou: ${r.reason})`,
    }))
    .filter((o) => o.ok || true); // mantém falhas registradas na sessão

  const validOpinions = opinions.filter((o) => o.ok && o.text.trim());
  if (validOpinions.length < 2) {
    return "O conselho não conseguiu quórum (falha nos modelos). Tenta de novo em instantes.";
  }

  // ── Estágio 2: revisão anônima (identidades viram Advisor A–E) ─
  const letters = ["A", "B", "C", "D", "E"];
  const anonBlock = validOpinions
    .map((o, i) => `--- ADVISOR ${letters[i]} ---\n${o.text}`)
    .join("\n\n");
  const stage2Prompt =
    `Abaixo estão opiniões anônimas de conselheiros sobre a questão: "${question}".\n\n${anonBlock}\n\n` +
    `Avalie criticamente: ranqueie da melhor para a pior (ex: B > A > C), aponte o argumento mais forte ` +
    `e a maior fraqueza que você vê no conjunto. Seja honesto e breve (~150 palavras). Português.`;

  const reviewResults = await Promise.allSettled([
    ...team.map((m) => askOpenRouter(m.id, stage2Prompt, 600)),
    askClaude(stage2Prompt, 600),
  ]);
  const reviews = reviewResults.map((r, i) => ({
    advisor: advisorNames[i],
    ok: r.status === "fulfilled",
    text: r.status === "fulfilled" ? r.value : `(falhou)`,
  }));

  // ── Estágio 3: síntese do Presidente (teto fixo — digerível por voz) ─
  // O Presidente (Claude) é o ÚNICO que vê a vida inteira do Cris: a memória
  // completa, sem filtro de zona, entra AQUI — nunca nos membros externos.
  const { data: fullMemories } = await sb().rpc("match_memories", {
    query_embedding: qEmbedding,
    match_count: 10,
    exclude_private: false,
  });
  const personalContext =
    (fullMemories ?? []).length > 0
      ? `\nCONTEXTO ÍNTIMO DO CRIS (confidencial — só você viu isto; os conselheiros NÃO viram):\n${(
          fullMemories ?? []
        )
          .map((m: { content: string; zone: string }) => `- [${m.zone}] ${m.content}`)
          .join("\n")}\n`
      : "";

  const synthesis = await askClaude(
    `Você é o PRESIDENTE do conselho pessoal do Cris. A questão foi: "${question}".\n\n` +
      `OPINIÕES (anônimas):\n${anonBlock}\n\n` +
      `REVISÕES CRUZADAS:\n${reviews
        .filter((r) => r.ok)
        .map((r, i) => `Revisor ${i + 1}: ${r.text}`)
        .join("\n\n")}\n` +
      personalContext +
      `\nProduza a decisão final do conselho em português, no formato:\n` +
      `1. RECOMENDAÇÃO (a posição do conselho, clara e acionável)\n` +
      `2. DISSENSO MAIS FORTE (o melhor argumento contrário)\n` +
      `3. LEITURA PESSOAL (o aval de quem conhece o Cris: como esta decisão conversa com a vida, ` +
      `a família e o momento dele — ajuste ou reforce a recomendação à luz disso, sem expor detalhes íntimos desnecessariamente)\n` +
      `4. CONFIANÇA (alta/média/baixa + uma linha do porquê)\n` +
      `Fale como quem fala, não como quem redige ata. Seja direto.`,
    700
  );

  // Sessão inteira gravada (diretiva §3.4)
  const { error } = await sb().from("council_sessions").insert({
    question,
    opinions: opinions.map((o, i) => ({
      advisor: o.advisor,
      label: o.ok ? letters[validOpinions.findIndex((v) => v === o)] ?? null : null,
      ok: o.ok,
      text: o.text,
    })),
    reviews,
    synthesis,
  });
  if (error) console.error("council_sessions:", error.message);

  const quorum = validOpinions.length;
  return `🏛️ Conselho reunido (${quorum} conselheiros).\n\n${synthesis}`;
}
