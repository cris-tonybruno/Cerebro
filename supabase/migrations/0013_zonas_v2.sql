-- Zonas v2 (layout OLIVER, decisão 2026-07-14):
-- pessoal · familia · trabalho (ex-negocios) · projetos (nova) · escrita (ex-criativo)
-- Filtro do conselho INTACTO: pessoal/familia continuam trancadas.

alter table turns drop constraint if exists turns_zone_check;
alter table memories drop constraint if exists memories_zone_check;

update turns set zone = 'trabalho' where zone = 'negocios';
update turns set zone = 'escrita' where zone = 'criativo';
update memories set zone = 'trabalho' where zone = 'negocios';
update memories set zone = 'escrita' where zone = 'criativo';

alter table turns add constraint turns_zone_check
  check (zone in ('pessoal','familia','trabalho','projetos','escrita'));
alter table memories add constraint memories_zone_check
  check (zone in ('pessoal','familia','trabalho','projetos','escrita'));

alter table turns alter column zone set default 'trabalho';
alter table memories alter column zone set default 'trabalho';
