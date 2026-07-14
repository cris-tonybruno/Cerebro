-- M5 — Contexto: lugares conhecidos, cache de geocode, posição atual, protocolos seed
-- (diretiva §6 e §8)

-- lugares do Cris, com rótulo pessoal ("casa", "Algonquin", "obra da Innovation")
create table known_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 250,   -- dentro desse raio = "estou nesse lugar"
  created_at timestamptz default now()
);

-- cache de reverse geocoding (Nominatim pede parcimônia; diretiva §6 manda cachear)
create table geocode_cache (
  key text primary key,                    -- lat/lng arredondados: "45.292,-75.904"
  label text not null,
  created_at timestamptz default now()
);

-- última posição conhecida do Cris (uma linha só; PWA atualiza a cada turno,
-- Telegram atualiza ao compartilhar localização)
create table current_location (
  id smallint primary key default 1 check (id = 1),
  lat double precision not null,
  lng double precision not null,
  place_label text,
  source text,                             -- pwa | telegram
  updated_at timestamptz not null default now()
);

alter table known_places enable row level security;
alter table geocode_cache enable row level security;
alter table current_location enable row level security;

-- protocolos padrão (diretiva §8) — config.prompt é injetado no system prompt quando ativo
insert into protocols (name, trigger_phrase, config, active) values
  ('foco', 'ativar protocolo foco', '{"prompt": "PROTOCOLO FOCO ATIVO: respostas ultra-curtas (1-3 frases no máximo). Nada de tangentes, nada de sugestões extras. Conselho desabilitado — se pedirem, lembre que o protocolo foco está ativo. Ajude o Cris a voltar ao trabalho o mais rápido possível."}'::jsonb, false),
  ('obra', 'ativar protocolo obra', '{"prompt": "PROTOCOLO OBRA ATIVO: o Cris está no canteiro, provavelmente de luvas e com pressa. Respostas curtas e práticas, voltadas para mãos-livres. Priorize: notas rápidas, listas de material, medidas e cálculos, clima no ponto. Confirme anotações em uma frase. Unidades imperiais para medidas de construção (pés, polegadas) como é padrão no Canadá."}'::jsonb, false),
  ('casa', 'ativar protocolo casa', '{"prompt": "PROTOCOLO CASA ATIVO: fim de expediente. Tom leve e descontraído. Nada de trabalho a menos que o Cris puxe. Priorize família, descanso, hobbies e o universo criativo (Éon). Se o Cris mencionar trabalho, pode sugerir gentilmente deixar pra amanhã."}'::jsonb, false),
  ('madrugada', 'ativar protocolo madrugada', '{"prompt": "PROTOCOLO MADRUGADA ATIVO: o Cris deveria estar dormindo. Modo captura de ideias: escute, salve a ideia (note_save), confirme em UMA frase curta (ex: anotado — vai dormir) e NÃO desenvolva o assunto. Nada de perguntas de follow-up, nada de entusiasmo. A missão é fechar o loop e devolver o Cris pra cama."}'::jsonb, false)
on conflict (name) do nothing;
