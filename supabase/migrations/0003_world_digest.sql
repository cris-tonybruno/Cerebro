-- Panorama semanal do mundo (Canadá, Brasil, política global) — pano de fundo
-- da timeline contextual. Uma IA futura cruza isto com os marcos do Cris.

create table world_digest (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,                -- segunda-feira da semana
  region text not null check (region in ('canada', 'brasil', 'mundo')),
  summary text not null,                   -- resumo legível em PT
  headlines jsonb,                         -- manchetes cruas (título + fonte)
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (week_start, region)
);

create index world_digest_embedding_idx on world_digest using hnsw (embedding vector_cosine_ops);
alter table world_digest enable row level security;
