import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";

// M3 — Ferramentas do roteador (rota B da diretiva §3.3).
// Todas as execuções entram no audit_log.

export const toolDefs: Anthropic.Tool[] = [
  {
    name: "note_save",
    description:
      "Salva uma memória/nota explícita no cérebro. Use quando o Cris pedir para guardar, " +
      "anotar ou lembrar de algo específico. O conteúdo deve ser uma frase clara e durável.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "A memória, em uma frase legível em português" },
        kind: {
          type: "string",
          enum: ["fact", "preference", "person", "place", "routine"],
          description: "Tipo da memória",
        },
        zone: {
          type: "string",
          enum: ["pessoal", "negocios", "criativo", "familia"],
          description: "Zona de privacidade",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "get_weather",
    description:
      "Consulta o clima atual e a previsão de 3 dias para uma cidade. " +
      "Use quando o Cris perguntar sobre tempo, clima, chuva, temperatura ou condições para trabalhar na obra.",
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Cidade (default: Ottawa). Ex: 'Ottawa', 'Toronto', 'São Paulo'",
        },
      },
      required: [],
    },
  },
  {
    name: "maps_route",
    description:
      "Gera um link de navegação do Google Maps até um destino. " +
      "Use quando o Cris pedir rota, caminho ou 'como chegar' em algum lugar. " +
      "Inclua o link retornado na sua resposta.",
    input_schema: {
      type: "object",
      properties: {
        destination: { type: "string", description: "Endereço ou nome do lugar de destino" },
        mode: {
          type: "string",
          enum: ["driving", "walking", "transit"],
          description: "Modo de transporte (default: driving)",
        },
      },
      required: ["destination"],
    },
  },
  {
    name: "web_search",
    description:
      "Busca informações atuais na web. Use para notícias, preços, fatos recentes ou " +
      "qualquer coisa que dependa de informação que você não tem certeza ou pode estar desatualizada.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "O que buscar" },
      },
      required: ["query"],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  let result: string;
  try {
    switch (name) {
      case "note_save":
        result = await noteSave(input);
        break;
      case "get_weather":
        result = await getWeather(input);
        break;
      case "maps_route":
        result = mapsRoute(input);
        break;
      case "web_search":
        result = await webSearch(input);
        break;
      default:
        result = `ferramenta desconhecida: ${name}`;
    }
  } catch (err) {
    result = `erro na ferramenta ${name}: ${err instanceof Error ? err.message : "desconhecido"}`;
  }

  // Diretiva §3.5: todo uso de ferramenta vai pro audit_log
  const { error } = await sb().from("audit_log").insert({
    actor: "brain",
    action: `tool:${name}`,
    detail: { input, result: result.slice(0, 1000) },
    approved: true, // ferramentas M3 são todas de baixo risco (leitura/nota)
  });
  if (error) console.error("audit_log:", error.message);

  return result;
}

async function noteSave(input: Record<string, unknown>): Promise<string> {
  const content = String(input.content ?? "").trim();
  if (!content) return "nada para salvar";
  const [embedding] = await embed([content], "memory_write");
  const { error } = await sb().from("memories").insert({
    kind: (input.kind as string) ?? "fact",
    content,
    zone: (input.zone as string) ?? "negocios",
    confidence: 1.0, // pedido explícito do Cris = confiança máxima
    embedding,
  });
  if (error) return `falha ao salvar: ${error.message}`;
  return `memória salva: "${content}"`;
}

const WEATHER_CODES: Record<number, string> = {
  0: "céu limpo", 1: "quase limpo", 2: "parcialmente nublado", 3: "nublado",
  45: "neblina", 48: "neblina com gelo", 51: "garoa leve", 53: "garoa",
  55: "garoa forte", 61: "chuva leve", 63: "chuva", 65: "chuva forte",
  71: "neve leve", 73: "neve", 75: "neve forte", 77: "granizo fino",
  80: "pancadas leves", 81: "pancadas", 82: "pancadas fortes",
  85: "pancadas de neve", 86: "pancadas de neve fortes",
  95: "tempestade", 96: "tempestade com granizo", 99: "tempestade forte com granizo",
};

async function getWeather(input: Record<string, unknown>): Promise<string> {
  const city = String(input.city ?? "Ottawa");

  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt`
  );
  const geo = await geoRes.json();
  const place = geo.results?.[0];
  if (!place) return `cidade não encontrada: ${city}`;

  const wRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}` +
      `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&timezone=auto&forecast_days=3`
  );
  const w = await wRes.json();
  const c = w.current;
  const d = w.daily;

  const days = (d?.time ?? []).map(
    (t: string, i: number) =>
      `${t}: ${d.temperature_2m_min[i]}°C a ${d.temperature_2m_max[i]}°C, ` +
      `${WEATHER_CODES[d.weather_code[i]] ?? "?"}, chance de chuva ${d.precipitation_probability_max[i]}%`
  );

  return (
    `Clima em ${place.name} (${place.country ?? ""}): agora ${c.temperature_2m}°C ` +
    `(sensação ${c.apparent_temperature}°C), ${WEATHER_CODES[c.weather_code] ?? "?"}, ` +
    `vento ${c.wind_speed_10m} km/h.\nPróximos dias:\n${days.join("\n")}`
  );
}

function mapsRoute(input: Record<string, unknown>): string {
  const destination = String(input.destination ?? "").trim();
  if (!destination) return "destino vazio";
  const mode = ["driving", "walking", "transit"].includes(String(input.mode))
    ? String(input.mode)
    : "driving";
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
  return `Link de navegação até "${destination}" (${mode}): ${url}`;
}

async function webSearch(input: Record<string, unknown>): Promise<string> {
  const query = String(input.query ?? "").trim();
  if (!query) return "busca vazia";
  const key = process.env.TAVILY_API_KEY;
  if (!key) {
    return (
      "Busca web ainda não configurada (falta TAVILY_API_KEY). " +
      "Avise o Cris que dá pra ligar grátis em tavily.com."
    );
  }
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 5, include_answer: true }),
  });
  if (!res.ok) return `busca falhou (${res.status})`;
  const json = await res.json();
  const results = (json.results ?? [])
    .map((r: { title: string; url: string; content: string }) =>
      `- ${r.title} (${r.url}): ${r.content?.slice(0, 200)}`
    )
    .join("\n");
  return `${json.answer ? `Resumo: ${json.answer}\n` : ""}Resultados:\n${results}`;
}
