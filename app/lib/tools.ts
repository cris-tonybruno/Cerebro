import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";
import { runCouncil } from "./council";
import { Geo, resolvePlace } from "./geo";
import { toggleProtocol } from "./protocols";

export type ToolContext = { geo?: Geo | null; place?: string | null };

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
      "Consulta o clima: condição atual, NOWCAST de chuva dos próximos 120 minutos no ponto exato " +
      "(radar — diz se a chuva vai pegar ONDE a pessoa está, não na cidade em geral) e previsão de 3 dias. " +
      "Sem 'city', usa a posição atual do Cris (GPS) — que é quase sempre o que ele quer. " +
      "Use quando o Cris perguntar sobre tempo, chuva, temperatura ou condições para trabalhar na obra.",
    input_schema: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description:
            "Só preencha se o Cris pediu OUTRO lugar explicitamente. Vazio = posição atual dele.",
        },
      },
      required: [],
    },
  },
  {
    name: "place_save",
    description:
      "Marca a posição ATUAL do Cris como um lugar conhecido com nome pessoal. " +
      "Use quando ele disser 'marca esse lugar como X' / 'salva esse lugar' / 'esse é o canteiro Y'.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome pessoal do lugar. Ex: 'casa', 'Algonquin', 'obra da Innovation'" },
        radius_m: { type: "number", description: "Raio em metros (default 250; use 100 pra endereços, 500 pra canteiros grandes)" },
      },
      required: ["name"],
    },
  },
  {
    name: "protocol_toggle",
    description:
      "Ativa ou desativa um protocolo de comportamento: foco, obra, casa, madrugada. " +
      "Use quando o Cris disser 'ativar protocolo X' / 'desativar protocolo X' / 'modo obra' etc. " +
      "O efeito começa no PRÓXIMO turno.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do protocolo" },
        active: { type: "boolean", description: "true = ativar, false = desativar" },
      },
      required: ["name", "active"],
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
  {
    name: "convene_council",
    description:
      "Convoca o CONSELHO: 5 IAs (GPT, Gemini, Grok, DeepSeek + você) deliberam em 3 estágios " +
      "e produzem uma recomendação com dissenso e confiança. Custa tempo (~1-2 min) e dinheiro (~$0.30-0.60). " +
      "Use APENAS para decisões com peso real ou perspectivas genuinamente divergentes: estratégia de negócio, " +
      "arquitetura, preço, decisões de vida, direção criativa — e quando o Cris pedir explicitamente " +
      "('convoca o conselho', 'o que o conselho acha'). Para todo o resto, responda você mesmo. " +
      "Antes de chamar, anuncie: 'Convocando o conselho.'",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description:
            "A questão para o conselho, formulada de forma completa e autossuficiente, " +
            "com o contexto essencial embutido (os conselheiros não veem a conversa)",
        },
      },
      required: ["question"],
    },
  },
];

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext = {}
): Promise<string> {
  let result: string;
  try {
    switch (name) {
      case "note_save":
        result = await noteSave(input);
        break;
      case "get_weather":
        result = await getWeather(input, ctx);
        break;
      case "maps_route":
        result = mapsRoute(input);
        break;
      case "web_search":
        result = await webSearch(input);
        break;
      case "convene_council":
        result = await runCouncil(String(input.question ?? ""));
        break;
      case "place_save":
        result = await placeSave(input, ctx);
        break;
      case "protocol_toggle":
        result = await toggleProtocol(String(input.name ?? ""), Boolean(input.active));
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

async function getWeather(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const cityAsked = String(input.city ?? "").trim();

  // Prioridade do Cris: o clima é do PONTO onde ele está, não da cidade inteira
  let lat: number, lng: number, placeName: string;
  if (!cityAsked && ctx.geo) {
    lat = ctx.geo.lat;
    lng = ctx.geo.lng;
    placeName = ctx.place ?? "onde você está";
  } else {
    const city = cityAsked || "Ottawa";
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt`
    );
    const geo = await geoRes.json();
    const found = geo.results?.[0];
    if (!found) return `cidade não encontrada: ${city}`;
    lat = found.latitude;
    lng = found.longitude;
    placeName = `${found.name}${found.country ? ` (${found.country})` : ""}`;
  }

  const wRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
      `&minutely_15=precipitation&forecast_minutely_15=8` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&timezone=auto&forecast_days=3`
  );
  const w = await wRes.json();
  const c = w.current;
  const d = w.daily;

  // Nowcast: chuva nos próximos 120 min NESTE ponto (o "mapa da nuvem" do carpinteiro)
  let nowcast = "sem chuva prevista nos próximos 120 min neste ponto";
  const m15: number[] = w.minutely_15?.precipitation ?? [];
  const firstRain = m15.findIndex((p) => p > 0.1);
  if (firstRain >= 0) {
    const startMin = firstRain * 15;
    const lastRain = m15.reduce((acc, p, i) => (p > 0.1 ? i : acc), firstRain);
    const endMin = (lastRain + 1) * 15;
    nowcast =
      startMin === 0
        ? `CHOVENDO AGORA neste ponto (deve seguir até ~${endMin} min)`
        : `chuva chegando NESTE ponto em ~${startMin} min (até ~${endMin} min)`;
  }

  const days = (d?.time ?? []).map(
    (t: string, i: number) =>
      `${t}: ${d.temperature_2m_min[i]}°C a ${d.temperature_2m_max[i]}°C, ` +
      `${WEATHER_CODES[d.weather_code[i]] ?? "?"}, chance de chuva ${d.precipitation_probability_max[i]}%`
  );

  return (
    `Clima em ${placeName}: agora ${c.temperature_2m}°C ` +
    `(sensação ${c.apparent_temperature}°C), ${WEATHER_CODES[c.weather_code] ?? "?"}, ` +
    `vento ${c.wind_speed_10m} km/h.\nRadar local (120 min): ${nowcast}.\nPróximos dias:\n${days.join("\n")}`
  );
}

async function placeSave(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const name = String(input.name ?? "").trim();
  if (!name) return "nome do lugar vazio";
  if (!ctx.geo) return "não sei onde o Cris está agora — sem GPS neste turno, não dá pra marcar o lugar";
  const radius = Number(input.radius_m) > 0 ? Number(input.radius_m) : 250;
  const { error } = await sb().from("known_places").insert({
    name,
    lat: ctx.geo.lat,
    lng: ctx.geo.lng,
    radius_m: radius,
  });
  if (error) return `falha ao marcar lugar: ${error.message}`;
  return `lugar "${name}" marcado aqui (raio ${radius}m). A partir de agora eu sei quando o Cris está em "${name}".`;
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
