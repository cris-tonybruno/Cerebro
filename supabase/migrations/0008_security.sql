-- M8 — Segurança (diretiva §10): estado do sistema (lockdown + época de auth)
-- e approval cards (a IA prepara, o Cris aprova).

create table system_state (
  id smallint primary key default 1 check (id = 1),
  lockdown boolean not null default false,
  auth_epoch integer not null default 1,   -- bump = todos os cookies morrem
  updated_at timestamptz not null default now()
);
insert into system_state (id) values (1) on conflict do nothing;

create table approvals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,            -- ex: tool:send_message
  summary text not null,           -- legível: o que vai acontecer se aprovar
  detail jsonb,                    -- tool, input, contexto
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'expired')),
  decided_at timestamptz,
  result text                      -- resultado da execução pós-aprovação
);

alter table system_state enable row level security;
alter table approvals enable row level security;
