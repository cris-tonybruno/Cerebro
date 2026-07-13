# 14 — Timeline Contextual: Linha do Tempo Enriquecida com Camadas de Contexto

> Status: PESQUISA COMPLETA · Abril 2026
> Escopo: Sistema de timeline que mostra tudo que foi escrito, dito, gravado em qualquer ponto no tempo — enriquecido com clima, economia, eventos mundiais, contexto pessoal e pessoas envolvidas.

---

## Visao Geral

```
                          TIMELINE CONTEXTUAL
                          ===================

  CAMADA 5: PESSOAS       [Quem estava envolvido? Quem mencionou?]
  CAMADA 4: PESSOAL       [Emprego, saude, idade, localizacao, eventos de vida]
  CAMADA 3: EVENTOS       [Noticias, politica, eventos globais/locais]
  CAMADA 2: ECONOMIA      [Inflacao, juros, crises, mercados]
  CAMADA 1: CLIMA         [Temperatura, chuva, estacao, catastrofes]
  ─────────────────────────────────────────────────────────────────
  CAMADA 0: DADOS DO USUARIO  [Emails, chats, voz, notas, screenshots, arquivos]
  ═══════════════════════════════════════════════════════════════════
  EIXO TEMPORAL  ──────────────────────────────────────────────────>
  2020-01        2021-06        2023-01        2024-12        2026-04
```

A ideia central: **qualquer momento da vida do usuario pode ser reconstruido com contexto completo**. Nao apenas "o que eu escrevi", mas "o que estava acontecendo ao meu redor quando escrevi isso".

---

## PARTE 1: BIBLIOTECAS DE VISUALIZACAO DE TIMELINE

### 1.1 Comparativo

| Biblioteca | Tecnologia | Tipo | Interatividade | Escalabilidade | Licenca | Melhor para |
|---|---|---|---|---|---|---|
| **vis-timeline** | DOM/Canvas | Horizontal scrollable | Alta (drag, zoom, edit, grupos) | 10k+ itens | MIT/Apache-2.0 | Timelines densas com muitos itens editaveis |
| **D3.js** (d3-axis + custom) | SVG/Canvas | Qualquer formato | Total (codigo manual) | Depende da impl. | ISC | Visualizacoes customizadas, multi-camada |
| **TimelineJS** (Knight Lab) | DOM | Storytelling horizontal | Media (navegacao, nao edit) | ~200 slides | MPL-2.0 | Narrativas visuais, jornalismo, apresentacoes |
| **react-chrono** | React/DOM | Vertical/Horizontal/Tree | Media (modo interativo, cards) | ~500 itens | MIT | Timelines lineares em apps React |
| **Markwhen** | Text-based | Gantt/Timeline | Media (markup → visual) | Bom para ranges | MIT | Timelines definidas como texto/markup |
| **ApexCharts Timeline** | SVG | Range bar/Gantt | Boa (tooltips, zoom) | ~5k ranges | MIT | Ranges temporais com categorias |

### 1.2 Analise Detalhada

#### vis-timeline (parte do vis.js ecosystem)

**URL**: https://github.com/visjs/vis-timeline

O vis-timeline e a solucao mais madura para timelines interativas densas. Suporta:
- **Grupos**: cada camada de contexto pode ser um grupo visual separado
- **Itens heterogeneos**: point events, range events, background ranges
- **Zoom semantico**: ao dar zoom out, itens se agrupam; ao dar zoom in, detalhe aparece
- **Edicao inline**: drag-and-drop para reorganizar, resize para mudar duracao
- **Clusters**: agrupa automaticamente itens proximos quando ha muitos

**Limitacao**: Renderiza via DOM, o que degrada acima de ~10k itens visiveis simultaneamente. Solucao: virtualizacao por janela temporal (carregar apenas o range visivel).

**Wrapper React**: `vis-timeline-component` ou `react-vis-timeline` (community-maintained).

#### D3.js — Abordagem Custom

D3 nao tem um componente "timeline" pronto, mas oferece os blocos:
- `d3.scaleTime()` para eixo temporal
- `d3.axisBottom()` / `d3.axisLeft()` para eixos
- `d3.brush()` para selecao de ranges
- `d3.zoom()` para navegacao

**Vantagem para o Segundo Cerebro**: controle total sobre a renderizacao multi-camada. Cada camada (clima, economia, eventos) pode ter seu proprio sub-grafico alinhado pelo eixo temporal compartilhado — similar a como TradingView renderiza indicadores financeiros em paineis sincronizados.

**Exemplo de arquitetura multi-camada com D3**:
```
┌─────────────────────────────────────────────────┐
│  [Notas/Emails/Chats do usuario]    scroll ↔    │  <- vis-timeline ou custom
├─────────────────────────────────────────────────┤
│  [Clima: temp/chuva sparkline]                  │  <- D3 area chart
├─────────────────────────────────────────────────┤
│  [Economia: SELIC/inflacao line]                │  <- D3 line chart
├─────────────────────────────────────────────────┤
│  [Eventos: markers com tooltips]                │  <- D3 scatter/markers
├─────────────────────────────────────────────────┤
│  [Pessoas: swim lanes por pessoa]               │  <- vis-timeline groups
└─────────────────────────────────────────────────┘
          EIXO TEMPORAL COMPARTILHADO (brush + zoom sincronizado)
```

#### TimelineJS (Knight Lab, Northwestern University)

Otimo para storytelling, nao para data-dense exploration. Funciona com Google Sheets como backend. Ideal para gerar "historias de vida" a partir de momentos selecionados — como um "recap" anual automatico.

#### react-chrono

Timeline vertical/horizontal para React. Suporta cards com midia. Bom para visualizacao linear de eventos de vida (timeline biografica), mas nao escala para milhares de itens interativos.

### 1.3 Recomendacao para o Segundo Cerebro

**Abordagem hibrida**:
1. **Core interativo**: vis-timeline para a camada principal (dados do usuario) — zoom, scroll, grupos
2. **Camadas de contexto**: D3.js para sub-graficos sincronizados (clima, economia) — sparklines, area charts
3. **Sincronizacao**: `d3.brush()` compartilhado que controla o range de todas as camadas
4. **Storytelling**: TimelineJS ou react-chrono para gerar "recap" narrativos (ex: "Seu 2025 em contexto")

---

## PARTE 2: MODELAGEM TEMPORAL EM POSTGRESQL

### 2.1 Modelo Bitemporal

O modelo bitemporal distingue dois eixos de tempo independentes:

| Conceito | Nome tecnico | Significado | Exemplo |
|---|---|---|---|
| **Quando aconteceu** | `event_time` (valid time) | Momento real do evento no mundo | "Email enviado em 2024-03-15 14:30" |
| **Quando registramos** | `record_time` (transaction time) | Quando o sistema soube/armazenou | "Importado do Gmail em 2026-01-10 09:00" |

**Por que isso importa para o Segundo Cerebro**: o usuario pode importar emails de 5 anos atras. O `event_time` e 2021, mas o `record_time` e 2026. Queries como "o que eu sabia em marco 2024?" precisam filtrar por `record_time <= 2024-03`, nao pelo `event_time`.

### 2.2 Schema Bitemporal

```sql
-- Tabela principal de eventos/items da timeline
CREATE TABLE timeline_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type     TEXT NOT NULL,          -- 'email', 'chat', 'voice', 'note', 'screenshot'
    source_id       TEXT,                   -- ID na fonte original
    content_hash    TEXT,                   -- SHA-256 do conteudo (dedup)

    -- BITEMPORAL
    event_time      TIMESTAMPTZ NOT NULL,   -- quando aconteceu
    event_time_end  TIMESTAMPTZ,            -- para ranges (ex: reuniao de 14h-15h)
    record_time     TIMESTAMPTZ NOT NULL DEFAULT now(),  -- quando registramos
    superseded_at   TIMESTAMPTZ,            -- quando esta versao foi substituida (NULL = atual)

    -- CONTEXTO BASICO
    title           TEXT,
    content         TEXT,
    summary         TEXT,                   -- gerado por LLM
    embedding       vector(1536),           -- pgvector

    -- LOCALIZACAO
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,
    location_name   TEXT,                   -- "Sao Paulo, SP" (reverse geocoded)

    -- PESSOAS
    people_ids      UUID[],                 -- array de refs para tabela people

    -- EMOCAO / SENTIMENTO
    sentiment       REAL,                   -- -1.0 a 1.0
    emotion_tags    TEXT[],                 -- ['joy', 'nostalgia', 'anxiety']

    -- METADADOS
    metadata        JSONB DEFAULT '{}'
);

-- Indices essenciais
CREATE INDEX idx_timeline_event_time ON timeline_items (event_time);
CREATE INDEX idx_timeline_record_time ON timeline_items (record_time);
CREATE INDEX idx_timeline_source ON timeline_items (source_type, source_id);
CREATE INDEX idx_timeline_location ON timeline_items USING gist (
    point(lon, lat)
);  -- PostGIS ou ponto nativo para queries espaciais
CREATE INDEX idx_timeline_embedding ON timeline_items USING ivfflat (embedding vector_cosine_ops);
```

### 2.3 Tabelas de Contexto Enriquecido

```sql
-- Clima historico (cache local de APIs)
CREATE TABLE context_weather (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date        DATE NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lon         DOUBLE PRECISION NOT NULL,
    temp_avg    REAL,              -- Celsius
    temp_min    REAL,
    temp_max    REAL,
    precip_mm   REAL,
    humidity    REAL,              -- percentual
    conditions  TEXT,              -- 'Clear', 'Rain', 'Snow'
    wind_speed  REAL,              -- km/h
    source      TEXT,              -- 'visual_crossing', 'open_meteo'
    raw_data    JSONB,
    UNIQUE(date, lat, lon, source)
);

-- Contexto economico
CREATE TABLE context_economic (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date        DATE NOT NULL,
    indicator   TEXT NOT NULL,      -- 'SELIC', 'IPCA', 'USD_BRL', 'SP500', 'FEDFUNDS'
    value       DOUBLE PRECISION,
    country     TEXT DEFAULT 'BR',
    source      TEXT,              -- 'bcb', 'fred', 'world_bank'
    UNIQUE(date, indicator, country)
);

-- Eventos mundiais
CREATE TABLE context_world_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date  DATE NOT NULL,
    title       TEXT NOT NULL,
    summary     TEXT,
    category    TEXT,              -- 'politics', 'disaster', 'sports', 'tech'
    relevance   REAL,             -- 0-1, calculado por proximidade geografica/tematica
    source_url  TEXT,
    source      TEXT,             -- 'gdelt', 'newsapi', 'manual'
    embedding   vector(1536),
    country     TEXT
);

-- Pessoas
CREATE TABLE people (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    aliases         TEXT[],            -- apelidos, variantes
    relationship    TEXT,              -- 'amigo', 'colega', 'familia', 'chefe'
    first_seen      TIMESTAMPTZ,
    last_seen       TIMESTAMPTZ,
    interaction_count INTEGER DEFAULT 0,
    metadata        JSONB DEFAULT '{}'
);

-- Eventos de vida pessoal
CREATE TABLE life_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date  DATE NOT NULL,
    event_type  TEXT NOT NULL,      -- 'job_change', 'move', 'relationship', 'health', 'milestone'
    title       TEXT NOT NULL,
    description TEXT,
    impact      INTEGER,           -- -5 (muito negativo) a +5 (muito positivo)
    duration    INTERVAL,          -- NULL para pontuais, 'P6M' para 6 meses, etc.
    metadata    JSONB DEFAULT '{}'
);
```

### 2.4 Query Exemplo: Reconstruir Contexto de um Momento

```sql
-- "O que estava acontecendo quando eu escrevi esse email?"
WITH target AS (
    SELECT event_time, lat, lon, location_name
    FROM timeline_items WHERE id = :item_id
)
SELECT
    ti.title AS item_title,
    ti.event_time,
    ti.location_name,
    cw.temp_avg, cw.conditions,
    ce_selic.value AS selic,
    ce_usd.value AS usd_brl,
    cwe.title AS world_event,
    le.title AS life_event,
    array_agg(DISTINCT p.name) AS people_involved
FROM target t
LEFT JOIN context_weather cw
    ON cw.date = t.event_time::date
    AND abs(cw.lat - t.lat) < 0.5 AND abs(cw.lon - t.lon) < 0.5
LEFT JOIN context_economic ce_selic
    ON ce_selic.date <= t.event_time::date AND ce_selic.indicator = 'SELIC'
    AND ce_selic.date = (SELECT max(date) FROM context_economic WHERE indicator = 'SELIC' AND date <= t.event_time::date)
LEFT JOIN context_economic ce_usd
    ON ce_usd.date <= t.event_time::date AND ce_usd.indicator = 'USD_BRL'
    AND ce_usd.date = (SELECT max(date) FROM context_economic WHERE indicator = 'USD_BRL' AND date <= t.event_time::date)
LEFT JOIN context_world_events cwe
    ON cwe.event_date BETWEEN (t.event_time::date - 3) AND (t.event_time::date + 1)
LEFT JOIN life_events le
    ON t.event_time::date BETWEEN le.event_date AND (le.event_date + COALESCE(le.duration, '0 days'))
LEFT JOIN timeline_items ti ON ti.id = :item_id
LEFT JOIN people p ON p.id = ANY(ti.people_ids)
GROUP BY ti.title, ti.event_time, ti.location_name, cw.temp_avg, cw.conditions,
         ce_selic.value, ce_usd.value, cwe.title, le.title;
```

---

## PARTE 3: GRAPHITI/ZEP PARA GRAFOS DE CONHECIMENTO TEMPORAL

### 3.1 O Problema

Grafos de conhecimento tradicionais sao estaticos: "Cristiano trabalha na EmpresaX". Mas relacoes mudam com o tempo. Em 2022 ele trabalhava na EmpresaY. Precisa-se de um grafo onde **entidades e arestas tem validade temporal**.

### 3.2 Graphiti (by Zep)

**URL**: https://github.com/getzep/graphiti

Graphiti e um framework Python para construir **grafos de conhecimento temporais** com as seguintes propriedades:

| Recurso | Descricao |
|---|---|
| **Episodic memory** | Cada "episodio" (conversa, email, nota) e adicionado ao grafo com timestamp |
| **Entity resolution** | LLM resolve "Cris", "Cristiano", "meu marido" como a mesma entidade |
| **Temporal edges** | Arestas tem `valid_from` e `valid_to` — `(Cristiano, works_at, EmpresaX, 2022-01, 2024-06)` |
| **Contradition detection** | Se um novo episodio contradiz um fato existente, o antigo e invalidado e o novo assume |
| **Hybrid retrieval** | Combina busca por similaridade semantica + busca estrutural no grafo + filtros temporais |
| **Backend**: Neo4j | Usa Neo4j como storage, com LLM (OpenAI/Anthropic) para extracao |

**Fluxo de Graphiti**:
```
Episodio (texto + timestamp)
    │
    ▼
LLM extrai entidades e relacoes
    │
    ▼
Entity resolution (match com entidades existentes)
    │
    ▼
Temporal edges criadas/atualizadas
    │
    ▼
Embeddings gerados para busca semantica
    │
    ▼
Neo4j armazena grafo temporal
```

### 3.3 Zep Cloud vs Self-Hosted

Zep oferece Graphiti como parte do Zep Cloud (managed) ou como lib open source (self-hosted com Neo4j).

| Aspecto | Zep Cloud | Self-hosted Graphiti |
|---|---|---|
| **Custo** | Pago (SaaS) | Gratis (precisa de Neo4j + LLM API) |
| **Privacidade** | Dados vao para Zep | Dados ficam locais |
| **Setup** | API key e pronto | Neo4j + Python + config |
| **Recomendacao** | NAO para dados pessoais | SIM para o Segundo Cerebro |

### 3.4 Aplicacao no Segundo Cerebro

Graphiti resolve o problema de **contexto pessoal temporal**:

- "Quem era meu chefe em 2023?" → Query temporal no grafo
- "Quando eu mudei de Sao Paulo para Curitiba?" → Edge `(Cristiano, lives_in, Curitiba)` com `valid_from`
- "Sobre o que eu conversava com Fulano naquela epoca?" → Combina entidade pessoa + filtro temporal + episodios

**Integracao proposta**: alimentar o Graphiti com cada item da timeline como um "episodio". O LLM extrai entidades e relacoes. O grafo temporal cresce organicamente.

---

## PARTE 4: APIs DE ENRIQUECIMENTO EXTERNO

### 4.1 Clima e Tempo

| API | Historico | Custo | Cobertura | Rate limit | Destaque |
|---|---|---|---|---|---|
| **Open-Meteo** | 1940-presente | **GRATIS** (open data) | Global | 10k/dia (free) | Sem API key necessaria. ERA5 reanalysis. Melhor custo-beneficio |
| **Visual Crossing** | 1970-presente | Free tier: 1000 req/dia | Global | 1000/dia (free) | Dados mais completos (UV, moon phase, conditions text) |
| **OpenWeatherMap** | 1979-presente (pago) | Free: current only. History: $$$$ | Global | 60/min (free) | Historico caro, nao recomendado |

**Recomendacao**: **Open-Meteo como primario** (gratis, sem key, excelente historico). Visual Crossing como fallback para campos extras.

**Exemplo Open-Meteo (historico)**:
```
GET https://archive-api.open-meteo.com/v1/archive
    ?latitude=-23.55
    &longitude=-46.63
    &start_date=2024-03-15
    &end_date=2024-03-15
    &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode
```

### 4.2 Economia e Mercados

| API | Dados | Custo | Cobertura | Destaque |
|---|---|---|---|---|
| **FRED API** (Federal Reserve) | 800k+ series economicas | **GRATIS** (API key) | EUA + globais | Juros, inflacao, desemprego, GDP |
| **BCB SGS** (Banco Central Brasil) | SELIC, IPCA, cambio, etc | **GRATIS** | Brasil | Essencial para contexto BR |
| **World Bank API** | Indicadores de desenvolvimento | **GRATIS** | 200+ paises | GDP, populacao, pobreza |
| **Yahoo Finance** (yfinance) | Precos de acoes, indices | **GRATIS** (scraping) | Global | IBOV, SP500, BTC, cambio |
| **Alpha Vantage** | Acoes, forex, crypto | Free: 25 req/dia | Global | API mais estruturada que yfinance |

**Recomendacao**: **BCB SGS para Brasil + FRED para EUA + yfinance para mercados**. Tudo gratis.

**Exemplo BCB SGS**:
```
GET https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados
    ?formato=json&dataInicial=01/01/2024&dataFinal=31/12/2024
```
(Serie 432 = IPCA mensal)

### 4.3 Eventos Mundiais e Noticias

| API/Projeto | Tipo | Custo | Cobertura | Destaque |
|---|---|---|---|---|
| **GDELT Project** | Event database | **GRATIS** | Global, 1979-presente | Maior base de eventos aberta. Monitora midia global em 65 idiomas |
| **NewsAPI** | Agregador de noticias | Free: 100 req/dia, 30 dias historico | Global | Simples de usar, mas historico limitado |
| **Event Registry** | Eventos + conceitos | Free tier limitado | Global | Melhor entity linking e clustering de eventos |
| **Wikipedia Current Events** | Curadoria humana | **GRATIS** | Global | Alta qualidade, baixo volume. Bom para marcos |
| **Common Crawl News** | Web archive de noticias | **GRATIS** | Global | Bilhoes de artigos, mas precisa processar |

**Recomendacao**: **GDELT como base historica** (gratuito, massivo, API BigQuery). NewsAPI para eventos recentes. Wikipedia Current Events como curadoria de marcos importantes.

**GDELT — Detalhes**:
- Atualizado a cada 15 minutos
- Acesso via BigQuery (Google Cloud, free tier suficiente para queries moderadas)
- Campos: data, atores, tipo de evento, localizacao, tom (sentimento), URL fonte
- GKG (Global Knowledge Graph): entidades, temas, emocoes extraidos de cada artigo

### 4.4 Localizacao e Geografia

| Servico | Tipo | Custo | Destaque |
|---|---|---|---|
| **OpenStreetMap Nominatim** | Geocoding/Reverse | **GRATIS** (rate: 1/sec) | Reverse geocode: lat/lon → "Rua Augusta, Sao Paulo" |
| **Google Timeline Export** (Takeout) | Location history | **GRATIS** (seus dados) | Historico de localizacao do usuario |
| **Overpass API** (OSM) | POI queries | **GRATIS** | "Que restaurantes existiam nesse endereco em 2023?" |
| **Photon** (Komoot) | Geocoding | **GRATIS** | Baseado em OSM, mais rapido que Nominatim |

**Recomendacao**: **Google Takeout para historico do usuario** + **Nominatim para reverse geocoding** de coordenadas.

---

## PARTE 5: MODELAGEM DE CONTEXTO PESSOAL

### 5.1 Eventos de Vida (Life Events)

Eventos de vida sao marcos que definem "eras" na timeline do usuario. Eles nao sao descobertos automaticamente — alguns sao, mas muitos precisam de input do usuario.

**Taxonomia de eventos de vida**:

| Categoria | Exemplos | Deteccao |
|---|---|---|
| **Carreira** | Novo emprego, demissao, promocao, aposentadoria | Semi-automatica (emails de oferta, LinkedIn) |
| **Localizacao** | Mudanca de cidade, viagem longa, imigracao | Automatica (Google Timeline, padrao de localizacao) |
| **Relacionamentos** | Namoro, casamento, divorcio, nascimento de filho | Manual (sensivel demais para auto-detectar) |
| **Saude** | Diagnostico, cirurgia, inicio de tratamento, recovery | Manual (HIPAA/LGPD sensivel) |
| **Educacao** | Inicio de faculdade, formatura, certificacao | Semi-automatica |
| **Financeiro** | Compra de imovel, investimento grande, falencia | Semi-automatica (extratos) |
| **Perda/Trauma** | Morte de ente querido, acidente, perda material | Manual |

**Deteccao automatica via LLM**: alimentar o Graphiti com emails/chats e pedir ao LLM que identifique "life-changing events". Marcar como `draft` e pedir confirmacao do usuario.

### 5.2 Grafo de Relacionamentos

```
                    ┌──────────┐
          amigo     │  Carlos  │  colega_trabalho
        ┌──────────>│  (2018-) │<──────────┐
        │           └──────────┘           │
   ┌────┴────┐                        ┌────┴────┐
   │ Usuario │── parceiro(a) ────────>│  Maria  │
   │ (eu)    │   (2020-)              │ (2019-) │
   └────┬────┘                        └─────────┘
        │ filho
        ▼
   ┌─────────┐
   │  Pedro  │
   │ (2023-) │
   └─────────┘
```

Cada aresta tem `valid_from` e `valid_to`. Arestas podem mudar de tipo: `colega → amigo → melhor_amigo`. Graphiti gerencia isso nativamente.

### 5.3 Timeline de Saude

Modelada como series temporais + eventos discretos:

- **Series**: peso, pressao, humor (1-10), horas de sono, passos/dia
- **Eventos**: consultas, diagnosticos, inicio/fim de medicacao, cirurgias
- **Fontes**: Apple Health export, Google Fit, Oura Ring, input manual

**IMPORTANTE**: Dados de saude sao os mais sensiveis. NUNCA enviar para APIs externas. Processar 100% local.

---

## PARTE 6: CORRELACAO E CROSS-REFERENCE ENTRE CAMADAS

### 6.1 Estrategia de Correlacao

O valor da timeline contextual nao esta em cada camada isolada, mas nas **correlacoes entre camadas**. Exemplos:

| Correlacao | Insight |
|---|---|
| Humor baixo + chuva constante + inverno | Possivel SAD (Seasonal Affective Disorder) |
| Produtividade alta + SELIC baixa + emprego novo | "Era dourada" pessoal |
| Muitos emails estressados + crise economica + demissoes no setor | Contexto externo explica estresse |
| Poucas mensagens + mudanca de cidade + nenhum evento social | Periodo de isolamento social |
| Mencoes frequentes de "Pessoa X" + sentimento positivo → negativo ao longo do tempo | Deterioracao de relacionamento |

### 6.2 Motor de Correlacao

```python
# Pseudo-codigo do correlation engine
class ContextCorrelator:
    def enrich_item(self, item: TimelineItem) -> EnrichedItem:
        """Enriquece um item da timeline com todas as camadas de contexto."""
        context = EnrichedContext()

        # Camada 1: Clima
        context.weather = self.weather_api.get_historical(
            lat=item.lat, lon=item.lon, date=item.event_time.date()
        )

        # Camada 2: Economia
        context.economic = {
            'selic': self.bcb.get_rate('SELIC', item.event_time.date()),
            'ipca': self.bcb.get_rate('IPCA', item.event_time.date()),
            'usd_brl': self.bcb.get_rate('USD_BRL', item.event_time.date()),
        }

        # Camada 3: Eventos mundiais
        context.world_events = self.gdelt.get_events(
            date=item.event_time.date(),
            location=item.location_name,
            limit=5
        )

        # Camada 4: Contexto pessoal
        context.life_phase = self.life_events.get_active_phase(item.event_time)
        context.age = self.calculate_age(item.event_time)
        context.job = self.graphiti.query(
            f"Where did user work on {item.event_time.date()}?"
        )

        # Camada 5: Pessoas
        context.people = self.graphiti.get_related_entities(
            entity='user',
            timestamp=item.event_time,
            relationship_types=['interacted_with', 'mentioned']
        )

        return EnrichedItem(item=item, context=context)

    def find_patterns(self, start: date, end: date) -> list[Pattern]:
        """Descobre correlacoes entre camadas em um periodo."""
        items = self.db.get_items(start, end)
        weather = self.db.get_weather(start, end)
        economic = self.db.get_economic(start, end)

        patterns = []
        # Correlacao humor x clima
        mood_series = extract_mood_series(items)
        weather_series = extract_conditions(weather)
        if pearson_correlation(mood_series, weather_series) > 0.6:
            patterns.append(Pattern('mood_weather', correlation=...))

        return patterns
```

### 6.3 Enriquecimento em Batch vs On-Demand

| Estrategia | Quando usar | Implementacao |
|---|---|---|
| **Batch (background)** | Clima, economia, eventos mundiais | Cron job noturno que preenche context tables para todos os dias com dados do usuario |
| **On-demand (lazy)** | Ao visualizar um item especifico | Busca e cacheia na hora quando o usuario abre a timeline em uma data |
| **Import-time** | Ao importar dados novos | Enriquece imediatamente cada item importado |

**Recomendacao**: Batch para clima e economia (dados estaveis, APIs gratuitas, preencher historico todo de uma vez). On-demand para eventos mundiais (volume alto, relevancia variavel).

---

## PARTE 7: PRIVACIDADE E CONSIDERACOES ETICAS

### 7.1 O Paradoxo da Correlacao

Cada camada de contexto individualmente e publica:
- Clima em Sao Paulo no dia 15/03/2024? Informacao publica.
- Taxa SELIC nessa data? Informacao publica.
- Noticias do dia? Informacao publica.

**Mas a correlacao revela informacao privada**: "O usuario estava em Sao Paulo no dia 15/03/2024, estava estressado, e tinha acabado de perder o emprego" — isso e intimo.

### 7.2 Principios de Privacidade

| Principio | Implementacao |
|---|---|
| **Dados de enriquecimento separados dos pessoais** | Tabelas de contexto (weather, economic, events) nao contem dados do usuario |
| **Correlacao apenas local** | O "join" entre camadas acontece no dispositivo do usuario, nunca em servidor externo |
| **Granularidade controlavel** | Usuario escolhe quais camadas ativar. Pode desligar saude, relacionamentos, etc |
| **Export sem contexto** | Ao exportar/compartilhar, remover camadas de contexto automaticamente |
| **Right to forget** | Deletar um periodo deve deletar tanto os dados quanto as correlacoes |
| **Dados de saude isolados** | Schema separado, criptografia extra, nunca enviado a APIs |

### 7.3 Criptografia

- **Dados do usuario** (timeline_items): criptografados at rest (AES-256 via pgcrypto ou disk-level)
- **Dados de enriquecimento** (weather, economic): nao precisam de criptografia (sao publicos)
- **Correlacoes e patterns**: criptografados (derivam informacao privada de dados publicos)
- **Grafo Graphiti/Neo4j**: criptografia at rest + controle de acesso

---

## PARTE 8: PROJETOS OPEN SOURCE RELEVANTES

| Projeto | O que faz | Relevancia para o Segundo Cerebro |
|---|---|---|
| **Graphiti** (Zep) | Grafo de conhecimento temporal | Core do contexto pessoal e relacoes |
| **Mem0** | Memory layer para LLMs | Complementar ao Graphiti para "memoria" de conversas |
| **Khoj** | AI personal assistant (self-hosted) | Referencia de arquitetura para timeline pessoal |
| **Obsidian Dataview** | Query engine para notas | Inspiracao para queries temporais sobre notas |
| **vis-timeline** | Visualizacao de timeline | Componente principal de UI |
| **Apache Superset** | BI dashboards | Pode servir para visualizar correlacoes entre camadas |
| **Metabase** | BI simplificado | Alternativa mais simples ao Superset para explorar dados temporais |
| **TimescaleDB** | PostgreSQL para time-series | Extensao de PG para series temporais (clima, economia) |
| **GDELT** | Base de eventos globais | Fonte primaria de eventos mundiais |
| **Ente** | Fotos com metadados temporais (E2EE) | Referencia de privacidade para dados pessoais com tempo |
| **Immich** | Self-hosted Google Photos | Timeline de fotos com location e reconhecimento facial |

---

## PARTE 9: RECOMENDACOES POR TIER

### Tier 1 — Implementar Primeiro (MVP)

| Item | Acao | Prioridade |
|---|---|---|
| **Schema bitemporal** | Criar tabelas PostgreSQL com event_time + record_time | CRITICO |
| **vis-timeline** | Interface basica de timeline com zoom e scroll | CRITICO |
| **Open-Meteo** | Integrar clima historico (gratis, sem key) | ALTO |
| **BCB SGS + FRED** | Cache local de indicadores economicos | ALTO |
| **Tabela life_events** | Input manual de marcos de vida | ALTO |

### Tier 2 — Expandir (Pos-MVP)

| Item | Acao | Prioridade |
|---|---|---|
| **Graphiti self-hosted** | Deploy Neo4j + Graphiti para grafo temporal | ALTO |
| **D3.js multi-layer** | Sub-graficos sincronizados (clima, economia) sob a timeline | MEDIO |
| **GDELT integration** | Eventos mundiais via BigQuery | MEDIO |
| **Google Takeout import** | Historico de localizacao do usuario | MEDIO |
| **People extraction** | NER nos emails/chats para popular tabela people | MEDIO |

### Tier 3 — Avancado (Diferencial)

| Item | Acao | Prioridade |
|---|---|---|
| **Correlation engine** | Detectar padroes entre camadas automaticamente | MEDIO |
| **Storytelling mode** | Gerar "recap" narrativo com TimelineJS/react-chrono | BAIXO |
| **Health timeline** | Integrar Apple Health / wearables | BAIXO |
| **Semantic time search** | "O que eu fazia quando o dolar bateu 6 reais?" → query hibrida | MEDIO |
| **Mood heatmap** | Visualizacao tipo GitHub contributions para sentimento diario | BAIXO |

### Tier 4 — Visionario

| Item | Acao | Prioridade |
|---|---|---|
| **"Time travel" mode** | Reconstruir o estado completo do mundo + vida do usuario em qualquer data | BAIXO |
| **Causal inference** | "Minha produtividade cai quando chove?" — testes estatisticos reais | BAIXO |
| **Predictive context** | "Baseado no padrao, voce tende a ficar estressado em dezembro" | BAIXO |
| **Shared timelines** | Timelines colaborativas com pessoas proximas (opt-in) | BAIXO |

---

## Referencias e Links

- Open-Meteo Historical Weather API: https://open-meteo.com/en/docs/historical-weather-api
- Visual Crossing Weather: https://www.visualcrossing.com/weather-api
- FRED API: https://fred.stlouisfed.org/docs/api/
- BCB SGS: https://dadosabertos.bcb.gov.br/dataset/taxas-de-juros
- GDELT Project: https://www.gdeltproject.org/
- NewsAPI: https://newsapi.org/
- Graphiti (Zep): https://github.com/getzep/graphiti
- vis-timeline: https://github.com/visjs/vis-timeline
- TimelineJS: https://timeline.knightlab.com/
- react-chrono: https://github.com/prabhuignoto/react-chrono
- OpenStreetMap Nominatim: https://nominatim.openstreetmap.org/
- TimescaleDB: https://www.timescale.com/
- PostgreSQL Bitemporal Patterns: https://wiki.postgresql.org/wiki/Temporal_Extensions
