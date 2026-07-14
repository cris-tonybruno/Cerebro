-- M7 — Storage: buckets de fotos e documentos + referência de anexo nos turnos
-- (diretiva §5: todo upload vira turno com embedding do texto extraído)

insert into storage.buckets (id, name, public) values
  ('photos', 'photos', false),
  ('docs', 'docs', false)
on conflict (id) do nothing;

alter table turns add column if not exists attachment_path text;
