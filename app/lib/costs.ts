import { sb } from "./supabase";

// Preços em USD por 1M de tokens (cache: 2026-06)
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-fable-5": { input: 10, output: 50 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  // Whisper cobra por minuto ($0.006/min). Aqui 1 "token" = 1 segundo de áudio.
  "whisper-1": { input: 100, output: 0 },
  // ElevenLabs cobra em créditos por caractere; estimativa ~$0.08/1k chars (Flash v2.5).
  // Aqui 1 "token" = 1 caractere.
  eleven_flash_v2_5: { input: 83, output: 0 },
};

const USD_TO_CAD = Number(process.env.USD_TO_CAD ?? 1.37);

export function budgetCad(): number {
  return Number(process.env.MONTHLY_BUDGET_CAD ?? 50);
}

export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? { input: 0, output: 0 };
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function logUsage(row: {
  provider: string;
  model: string;
  purpose: string;
  input_tokens: number;
  output_tokens: number;
  turn_id?: string | null;
  cost_usd?: number; // custo explícito (OpenRouter devolve o valor exato)
}): Promise<void> {
  const cost_usd =
    row.cost_usd ?? computeCostUsd(row.model, row.input_tokens, row.output_tokens);
  const { error } = await sb()
    .from("api_usage")
    .insert({ ...row, cost_usd });
  if (error) console.error("logUsage:", error.message);
}

export async function monthUsage(): Promise<{
  month_usd: number;
  month_cad: number;
  budget_cad: number;
  pct: number;
}> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { data, error } = await sb()
    .from("api_usage")
    .select("cost_usd")
    .gte("created_at", start.toISOString());
  if (error) console.error("monthUsage:", error.message);
  const month_usd = (data ?? []).reduce((acc, r) => acc + Number(r.cost_usd), 0);
  const month_cad = month_usd * USD_TO_CAD;
  const budget = budgetCad();
  return {
    month_usd,
    month_cad,
    budget_cad: budget,
    pct: budget > 0 ? (month_cad / budget) * 100 : 0,
  };
}
