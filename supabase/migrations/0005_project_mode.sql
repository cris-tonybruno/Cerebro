-- M6 — Project Mode (diretiva §9): um projeto "em foco" por vez;
-- turnos linkados; retrieval enviesado para o projeto.

alter table projects add column if not exists in_focus boolean not null default false;
alter table projects add column if not exists updated_at timestamptz default now();

-- busca vetorial dentro dos turnos de um projeto (viés de contexto)
create or replace function match_project_turns(
  pid uuid,
  query_embedding vector(1536),
  match_count int default 5
) returns table (
  role text, content text, created_at timestamptz, similarity float
) language sql stable as $$
  select t.role, t.content, t.created_at,
         1 - (t.embedding <=> query_embedding) as similarity
  from turns t
  where t.active_project = pid
    and t.embedding is not null
  order by t.embedding <=> query_embedding
  limit match_count;
$$;
