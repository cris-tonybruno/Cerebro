-- O EU VIRTUAL: perfil curado do Cris que entra em TODA deliberação do conselho.
-- Os fatos vêm do projeto; os valores vêm daqui. Curado = o Cris posa o retrato
-- (seguro para os conselheiros externos verem). Editável por voz (profile_update).

create table creator_profile (
  id smallint primary key default 1 check (id = 1),
  content text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table creator_profile enable row level security;
