-- CÉREBRO — schema fundacional (M1)
-- Projeto Supabase dedicado: "cerebro" (não reutilizar projetos da holding)
-- Fonte: CEREBRO_DIRECTIVE.md §5

create extension if not exists vector;

-- projetos (criado antes de turns por causa da FK)
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- "Éon", "Yoinkr", "IMD final", ...
  kind text,                     -- book | app | site | client | study
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

-- uma linha por turno de interação
create table turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  created_at timestamptz not null default now(),
  role text not null check (role in ('cris','brain')),
  modality text not null default 'text',        -- voice | text | image | doc (M1 = text)
  content text not null,                        -- transcript ou resposta
  route text,                                   -- direct | tool | council
  tool_name text,
  lat double precision,
  lng double precision,
  place_label text,
  local_datetime timestamptz,
  timezone text,
  active_protocols text[],
  active_project uuid references projects(id),
  zone text not null default 'negocios'
    check (zone in ('pessoal','negocios','criativo','familia')),
  embedding vector(1536)
);

-- corpus em formato training-pair (futuro fine-tune / MCP de memória)
create table training_pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  prompt text not null,          -- o que o Cris disse + resumo de contexto
  completion text not null,      -- o que o brain respondeu/decidiu
  context jsonb,                 -- geo, datetime, protocol, project, memórias recuperadas
  quality smallint,              -- 1-5, Cris avalia; default null
  tags text[],
  embedding vector(1536)
);

-- memória semântica editável (legível, nunca blob opaco)
create table memories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  kind text not null,            -- fact | preference | person | place | routine
  content text not null,         -- frase simples, legível
  source_turn uuid references turns(id),
  confidence real default 0.8,
  archived boolean default false,
  zone text not null default 'negocios'
    check (zone in ('pessoal','negocios','criativo','familia')),
  embedding vector(1536)
);
-- Claude Principal classifica zone na escrita; Cris reclassifica no Memory Browser.
-- Retrieval para conselho filtra: where zone not in ('pessoal','familia') salvo liberação por sessão.

create table council_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  question text not null,
  opinions jsonb not null,
  reviews jsonb not null,
  synthesis text not null,
  triggered_by uuid references turns(id)
);

create table protocols (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,     -- "foco", "obra", "casa", "blackout"...
  trigger_phrase text,
  config jsonb not null,
  active boolean default false
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  actor text not null,           -- brain | cris | system
  action text not null,
  detail jsonb,
  approved boolean,
  lat double precision, lng double precision
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  name text, platform text,
  registered_at timestamptz default now(),
  last_seen timestamptz,
  status text default 'active'   -- active | locked | wiped
);

-- contador de custo (princípio 9: cost-aware desde o dia 1)
create table api_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,        -- anthropic | openai | openrouter | elevenlabs
  model text not null,
  purpose text,                  -- chat | embedding | memory_extract | council | stt | tts
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric(10,6) not null default 0,
  turn_id uuid references turns(id)
);

-- índices vetoriais
create index turns_embedding_idx on turns using hnsw (embedding vector_cosine_ops);
create index memories_embedding_idx on memories using hnsw (embedding vector_cosine_ops);
create index training_pairs_embedding_idx on training_pairs using hnsw (embedding vector_cosine_ops);
create index turns_session_idx on turns (session_id, created_at);
create index api_usage_created_idx on api_usage (created_at);

-- busca por similaridade (memória semântica)
create or replace function match_memories(
  query_embedding vector(1536),
  match_count int default 8,
  exclude_private boolean default false   -- true = filtro de zona p/ conselho/export
) returns table (
  id uuid, kind text, content text, zone text, confidence real, similarity float
) language sql stable as $$
  select m.id, m.kind, m.content, m.zone, m.confidence,
         1 - (m.embedding <=> query_embedding) as similarity
  from memories m
  where m.archived = false
    and m.embedding is not null
    and (not exclude_private or m.zone not in ('pessoal','familia'))
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- busca por similaridade (memória episódica)
create or replace function match_turns(
  query_embedding vector(1536),
  match_count int default 5,
  exclude_private boolean default false
) returns table (
  id uuid, role text, content text, zone text, created_at timestamptz, similarity float
) language sql stable as $$
  select t.id, t.role, t.content, t.zone, t.created_at,
         1 - (t.embedding <=> query_embedding) as similarity
  from turns t
  where t.embedding is not null
    and (not exclude_private or t.zone not in ('pessoal','familia'))
  order by t.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: single-user, mas tranca tudo mesmo assim.
-- Sem policies = anon/authenticated não acessam nada; só o service role (servidor) passa.
alter table projects enable row level security;
alter table turns enable row level security;
alter table training_pairs enable row level security;
alter table memories enable row level security;
alter table council_sessions enable row level security;
alter table protocols enable row level security;
alter table audit_log enable row level security;
alter table devices enable row level security;
alter table api_usage enable row level security;
