import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";
import { logUsage } from "./costs";

// Panorama semanal do mundo: RSS grátis → resumo (Haiku) → embedding → world_digest.
// Roda toda segunda via cron da Vercel; consultável pelo Principal e por IAs futuras.

const anthropic = new Anthropic();
const SUMMARY_MODEL = process.env.CLAUDE_MEMORY_MODEL ?? "claude-haiku-4-5";

const FEEDS: Record<string, { name: string; url: string }[]> = {
  canada: [
    { name: "CBC Top Stories", url: "https://www.cbc.ca/webfeed/rss/rss-topstories" },
    { name: "CBC Politics", url: "https://www.cbc.ca/webfeed/rss/rss-politics" },
  ],
  brasil: [
    { name: "G1 Política", url: "https://g1.globo.com/rss/g1/politica/" },
    { name: "G1 Economia", url: "https://g1.globo.com/rss/g1/economia/" },
  ],
  mundo: [
    { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
    { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  ],
};

type Headline = { title: string; source: string };

function stripCdata(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .trim();
}

async function fetchHeadlines(feed: { name: string; url: string }): Promise<Headline[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": "cerebro-pessoal/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
    return items.slice(0, 10).map((item) => {
      const title = stripCdata(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
      return { title, source: feed.name };
    });
  } catch (err) {
    console.error(`rss ${feed.name}:`, err);
    return [];
  }
}

function mondayOfThisWeek(): string {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export async function buildWeeklyDigest(): Promise<string> {
  const week = mondayOfThisWeek();
  const results: string[] = [];

  for (const [region, feeds] of Object.entries(FEEDS)) {
    const headlines = (await Promise.all(feeds.map(fetchHeadlines))).flat().filter((h) => h.title);
    if (headlines.length === 0) {
      results.push(`${region}: sem manchetes (feeds falharam)`);
      continue;
    }

    const res = await anthropic.messages.create({
      model: SUMMARY_MODEL,
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `Você escreve o panorama semanal de notícias do cérebro pessoal do Cris — brasileiro, carpinteiro/supervisor de framing e estudante de design em Ottawa, Canadá.

Resuma as manchetes abaixo (região: ${region.toUpperCase()}) em UM parágrafo denso de ~150 palavras, em português. Foque em: política, economia, e qualquer coisa com potencial de afetar construção civil, imigração, custo de vida ou o Brasil. Sem opinião, só o retrato da semana. Responda APENAS o parágrafo — sem título, sem cabeçalho, sem markdown.

MANCHETES:
${headlines.map((h) => `- [${h.source}] ${h.title}`).join("\n")}`,
        },
      ],
    });
    await logUsage({
      provider: "anthropic",
      model: SUMMARY_MODEL,
      purpose: "world_digest",
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
    });

    const summary = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const [embedding] = await embed([summary], "world_digest");
    const { error } = await sb()
      .from("world_digest")
      .upsert(
        { week_start: week, region, summary, headlines, embedding },
        { onConflict: "week_start,region" }
      );
    if (error) {
      console.error("world_digest upsert:", error.message);
      results.push(`${region}: falha ao gravar`);
    } else {
      results.push(`${region}: ok (${headlines.length} manchetes)`);
    }
  }

  return `digest da semana ${week}: ${results.join(" | ")}`;
}

export async function getLatestDigest(): Promise<string> {
  const { data } = await sb()
    .from("world_digest")
    .select("week_start, region, summary")
    .order("week_start", { ascending: false })
    .limit(3);
  if (!data || data.length === 0) return "nenhum panorama semanal gravado ainda";
  const week = data[0].week_start;
  return (
    `Panorama do mundo — semana de ${week}:\n\n` +
    data
      .filter((d) => d.week_start === week)
      .map((d) => `【${d.region.toUpperCase()}】 ${d.summary}`)
      .join("\n\n")
  );
}
