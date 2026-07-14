import Anthropic from "@anthropic-ai/sdk";
import { sb } from "./supabase";
import { embed } from "./embeddings";
import { runCouncil } from "./council";
import { Geo, resolvePlace } from "./geo";
import { toggleProtocol } from "./protocols";
import { getLatestDigest } from "./digest";
import { openProject, closeProject, projectStatus, updateProjectNotes, Project } from "./projects";
import { teachVision } from "./media";
import { getProfile, updateProfile } from "./profile";

export type ToolContext = {
  geo?: Geo | null;
  place?: string | null;
  project?: Project | null;
  session_id?: string;
};

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
          enum: ["fact", "preference", "person", "place", "routine", "marco"],
          description:
            "Tipo da memória. 'marco' = efeito borboleta: como um evento do mundo (política, " +
            "economia, clima) afetou a vida/decisões/criatividade do Cris — a leitura causal dele.",
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
    name: "project_open",
    description:
      "Abre (ou cria) um projeto e ativa o Modo Projeto: os turnos passam a ser linkados a ele " +
      "e o cérebro vira parceiro do projeto. Use quando o Cris disser 'abrir projeto X' / " +
      "'vamos trabalhar no X' / 'novo projeto X'. Só um projeto em foco por vez.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do projeto. Ex: 'Éon', 'Yoinkr', 'IMD final'" },
        kind: {
          type: "string",
          enum: ["book", "app", "site", "client", "study"],
          description: "Tipo (se der pra inferir)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "project_close",
    description: "Fecha o projeto em foco (sai do Modo Projeto). Use quando o Cris disser 'fechar projeto'.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "project_status",
    description:
      "Resumo do estado de um projeto: notas, últimas conversas, onde parou. " +
      "Use quando o Cris perguntar 'onde a gente parou no X?' / 'status do projeto' / 'que projetos eu tenho?'.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do projeto (vazio = o que está em foco / lista todos)" },
      },
      required: [],
    },
  },
  {
    name: "project_notes_update",
    description:
      "Atualiza as notas do projeto em foco — o resumo vivo de decisões e fios abertos. " +
      "Use quando uma decisão importante do projeto for tomada na conversa, reescrevendo as notas " +
      "completas (decisões + próximos passos), de forma curta e legível.",
    input_schema: {
      type: "object",
      properties: {
        notes: { type: "string", description: "As notas completas novas (substituem as antigas)" },
      },
      required: ["notes"],
    },
  },
  {
    name: "profile_get",
    description:
      "Lê o EU VIRTUAL — o perfil curado do Cris que representa ele em toda deliberação do conselho " +
      "(valores, filosofia de decisão, prioridades). Use quando o Cris pedir para ver/revisar o perfil, " +
      "ou ANTES de profile_update (o novo texto substitui o antigo por inteiro).",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "profile_update",
    description:
      "Atualiza o EU VIRTUAL. Use quando o Cris pedir para mudar o perfil dele ou expressar mudança " +
      "durável de valores/prioridades que ele queira refletida ('atualiza meu perfil: ...'). " +
      "SEMPRE leia o atual primeiro (profile_get), aplique a mudança preservando o resto, e envie o " +
      "documento COMPLETO. Confirme com o Cris o texto antes de gravar se a mudança for grande.",
    input_schema: {
      type: "object",
      properties: {
        content: { type: "string", description: "O documento completo novo (substitui o antigo)" },
      },
      required: ["content"],
    },
  },
  {
    name: "vision_teach",
    description:
      "Treinamento de visão (apprentice): registra o que o Cris ensinou sobre uma foto recém-enviada. " +
      "Use quando ele CORRIGIR ou ROTULAR o que aparece na última foto ('isso é blocking, não stud', " +
      "'esse é o canteiro da Innovation', 'essa ferramenta é um framing nailer'). " +
      "Use confirm=true quando ele apenas CONFIRMAR que sua identificação estava certa ('isso mesmo', 'acertou'). " +
      "Com o tempo você identifica sozinho e só pede confirmação.",
    input_schema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description: "O que a coisa É, nas palavras do Cris (vazio se for só confirmação)",
        },
        confirm: {
          type: "boolean",
          description: "true = o Cris confirmou uma identificação que você já fez",
        },
      },
      required: [],
    },
  },
  {
    name: "recall_past",
    description:
      "Busca na memória de LONGO PRAZO do cérebro: conversas antigas com o Cris e pesquisas " +
      "já arquivadas. Use quando o Cris perguntar 'o que a gente já falou sobre X', 'o que eu " +
      "pesquisei sobre Y', 'quando eu te contei Z' — ou quando lembrar de algo antigo ajudar a resposta.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "O assunto a relembrar" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_world_digest",
    description:
      "Consulta o panorama semanal do mundo (Canadá, Brasil, política global) que o cérebro " +
      "arquiva toda semana. Use quando o Cris perguntar 'o que tá acontecendo no mundo/Brasil/Canadá', " +
      "ou quando o contexto político/econômico da semana ajudar a resposta.",
    input_schema: { type: "object", properties: {}, required: [] },
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

// Ferramentas SENSÍVEIS exigem aprovação explícita do Cris antes de executar
// (M8 — princípio de ouro: a IA prepara, o Cris aprova). Hoje vazio: nenhuma
// ferramenta atual toca terceiros/dinheiro. Gmail, mensagens e compras (M9+)
// entram aqui no dia em que existirem.
const SENSITIVE_TOOLS = new Set<string>([]);

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext = {},
  approvedByCris = false
): Promise<string> {
  // Cancela de aprovação: sensível e ainda sem aval → vira card pendente
  if (SENSITIVE_TOOLS.has(name) && !approvedByCris) {
    const { data, error } = await sb()
      .from("approvals")
      .insert({
        action: `tool:${name}`,
        summary: `Executar ${name} com: ${JSON.stringify(input).slice(0, 300)}`,
        detail: { tool: name, input, ctx: { geo: ctx.geo, place: ctx.place } },
      })
      .select("id")
      .single();
    if (error) return `falha ao criar card de aprovação: ${error.message}`;
    return (
      `AÇÃO SENSÍVEL PREPARADA, aguardando aprovação do Cris (card ${data.id.slice(0, 8)}). ` +
      `Avise o Cris que o card apareceu no app e nada acontece sem o toque dele.`
    );
  }

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
      case "convene_council": {
        // Modo Projeto: o conselho recebe o briefing do projeto junto (diretiva §9)
        const brief = ctx.project
          ? `[Contexto: a questão é do projeto "${ctx.project.name}"${ctx.project.kind ? ` (${ctx.project.kind})` : ""}. Notas do projeto: ${ctx.project.notes ?? "sem notas"}]\n\n`
          : "";
        result = await runCouncil(brief + String(input.question ?? ""));
        break;
      }
      case "get_world_digest":
        result = await getLatestDigest();
        break;
      case "recall_past":
        result = await recallPast(String(input.query ?? ""));
        break;
      case "project_open":
        result = await openProject(String(input.name ?? ""), input.kind as string | undefined);
        break;
      case "project_close":
        result = await closeProject();
        break;
      case "project_status":
        result = await projectStatus(input.name as string | undefined);
        break;
      case "project_notes_update":
        result = await updateProjectNotes(String(input.notes ?? ""));
        break;
      case "profile_get": {
        const p = await getProfile();
        result = p ? `[versão ${p.version}]\n${p.content}` : "perfil ainda não criado";
        break;
      }
      case "profile_update":
        result = await updateProfile(String(input.content ?? ""));
        break;
      case "vision_teach":
        result = await teachVision(
          String(input.label ?? ""),
          ctx.session_id ?? "",
          Boolean(input.confirm)
        );
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
  const full = `${json.answer ? `Resumo: ${json.answer}\n` : ""}Resultados:\n${results}`;

  // Toda pesquisa vira arquivo permanente: curiosidade do Cris é dado da timeline
  try {
    const [embedding] = await embed([`${query}\n${full}`.slice(0, 8000)], "research_archive");
    const { error } = await sb()
      .from("research")
      .insert({ query, result: full, tool: "web_search", embedding });
    if (error) console.error("research insert:", error.message);
  } catch (err) {
    console.error("research archive:", err);
  }

  return full;
}

// Memória de longo prazo: conversas antigas + pesquisas arquivadas
async function recallPast(query: string): Promise<string> {
  if (!query.trim()) return "assunto vazio";
  const [qEmbedding] = await embed([query], "recall");

  const [turnsRes, researchRes] = await Promise.all([
    sb().rpc("match_turns", { query_embedding: qEmbedding, match_count: 6 }),
    sb().rpc("match_research", { query_embedding: qEmbedding, match_count: 3 }),
  ]);

  const turns = (turnsRes.data ?? []) as {
    role: string;
    content: string;
    created_at: string;
    similarity: number;
  }[];
  const research = (researchRes.data ?? []) as {
    query: string;
    result: string;
    created_at: string;
  }[];

  const parts: string[] = [];
  if (turns.length > 0) {
    parts.push(
      "CONVERSAS PASSADAS RELEVANTES:\n" +
        turns
          .map(
            (t) =>
              `[${String(t.created_at).slice(0, 10)}] ${t.role === "cris" ? "Cris" : "Cérebro"}: ${t.content.slice(0, 300)}`
          )
          .join("\n")
    );
  }
  if (research.length > 0) {
    parts.push(
      "PESQUISAS ARQUIVADAS:\n" +
        research
          .map((r) => `[${String(r.created_at).slice(0, 10)}] busca "${r.query}": ${r.result.slice(0, 500)}`)
          .join("\n\n")
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : "nada encontrado sobre isso na memória de longo prazo";
}
