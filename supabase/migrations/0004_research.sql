-- Arquivo de pesquisas: todo resultado de busca do cérebro fica guardado,
-- pesquisável por significado. Curiosidade do Cris = dado da timeline.

create table research (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  query text not null,           -- o que foi buscado
  result text not null,          -- o que a busca trouxe (completo)
  tool text not null,            -- web_search | (futuras fontes)
  embedding vector(1536)
);

create index research_embedding_idx on research using hnsw (embedding vector_cosine_ops);
alter table research enable row level security;

create or replace function match_research(
  query_embedding vector(1536),
  match_count int default 3
) returns table (
  id uuid, query text, result text, created_at timestamptz, similarity float
) language sql stable as $$
  select r.id, r.query, r.result, r.created_at,
         1 - (r.embedding <=> query_embedding) as similarity
  from research r
  where r.embedding is not null
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
