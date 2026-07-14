-- M8.5 — canal de despacho: o chamado ganha diretiva, endereço e estados de execução.
-- pending (ideia) → dispatched (diretiva aprovada por voz, pronto p/ o Vigia)
-- → building (Vigia executando) → built | failed. rejected = descartado pelo Cris.

alter table dev_backlog add column if not exists directive text;   -- o contrato com a oficina
alter table dev_backlog add column if not exists workdir text;     -- onde trabalhar (path)
alter table dev_backlog add column if not exists branch text;      -- branch criado pelo Vigia

alter table dev_backlog drop constraint if exists dev_backlog_status_check;
alter table dev_backlog add constraint dev_backlog_status_check
  check (status in ('pending', 'dispatched', 'building', 'built', 'failed', 'rejected'));
