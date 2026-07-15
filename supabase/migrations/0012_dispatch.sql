-- M8.5 — canal de despacho: o chamado ganha diretiva, endereço e estados de execução.
-- pending (ideia) → dispatched (diretiva aprovada por voz, pronto p/ o Vigia)
-- → building (Vigia executando) → built | failed. rejected = descartado pelo Cris.

alter table dev_backlog add column if not exists directive text;   -- o contrato com a oficina
alter table dev_backlog add column if not exists workdir text;     -- onde trabalhar (path)
alter table dev_backlog add column if not exists branch text;      -- branch criado pelo Vigia

alter table dev_backlog drop constraint if exists dev_backlog_status_check;
alter table dev_backlog add constraint dev_backlog_status_check
  check (status in ('pending', 'dispatched', 'building', 'built', 'failed', 'rejected'));

-- v2: git invisível para o Cris — aprovação por voz, merge automático pelo Vigia
-- built → approved ("aprova") → merging → merged | rejected ("rejeita")
alter table dev_backlog drop constraint if exists dev_backlog_status_check;
alter table dev_backlog add constraint dev_backlog_status_check
  check (status in ('pending','dispatched','building','built','approved','merging','merged','failed','rejected'));

-- v3: dois pipelines — 'direto' (projeto novo, sem produção: constrói na main)
-- e 'protegido' (produção: separado + aprovação do Cris antes de subir)
alter table dev_backlog add column if not exists pipeline text not null default 'protegido'
  check (pipeline in ('direto','protegido'));

-- v4: job_type — 'code' (chamado normal) | 'bootstrap' (nascer projeto: pasta + git + repo)
alter table dev_backlog add column if not exists job_type text not null default 'code'
  check (job_type in ('code','bootstrap'));
