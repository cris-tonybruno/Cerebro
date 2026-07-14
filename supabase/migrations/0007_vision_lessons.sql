-- Treinamento de visão estilo apprentice: o Cris ensina o que é o quê nas fotos;
-- lições viram few-shot recuperável por similaridade. Futuro dataset do Amazo.

create table vision_lessons (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  machine_description text not null,   -- o que a IA viu (cru)
  cris_label text not null,            -- o que o Cris disse que é (a verdade)
  image_path text,                     -- foto original no cofre
  confirmed_count integer not null default 1,
  embedding vector(1536)
);

create index vision_lessons_embedding_idx on vision_lessons using hnsw (embedding vector_cosine_ops);
alter table vision_lessons enable row level security;

create or replace function match_vision_lessons(
  query_embedding vector(1536),
  match_count int default 3
) returns table (
  id uuid, cris_label text, machine_description text, confirmed_count int, similarity float
) language sql stable as $$
  select v.id, v.cris_label, v.machine_description, v.confirmed_count,
         1 - (v.embedding <=> query_embedding) as similarity
  from vision_lessons v
  where v.embedding is not null
  order by v.embedding <=> query_embedding
  limit match_count;
$$;
