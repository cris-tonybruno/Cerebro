-- A ponte cérebro → oficina: melhorias sobre o PRÓPRIO Cérebro viram chamados
-- de desenvolvimento. O Principal registra; a oficina (Claude Code) lê no início
-- de cada sessão e constrói com o Cris. Padrão herdado do chamado_dev de Éon.

create table dev_backlog (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request text not null,           -- o que o Cris pediu/sugeriu, com o porquê
  context text,                    -- contexto da conversa (onde, quando, a dor)
  status text not null default 'pending'
    check (status in ('pending', 'building', 'built', 'rejected')),
  resolved_at timestamptz,
  resolution text                  -- commit/nota de como foi resolvido
);

alter table dev_backlog enable row level security;
