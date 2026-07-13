# 13 -- Backup e Redundancia

> Status: PESQUISA COMPLETA . Abril 2026
> Escopo: estrategias de backup, redundancia e disaster recovery para o Segundo Cerebro

---

## Indice

1. [Visao Geral e Regra 3-2-1](#1-visao-geral-e-regra-3-2-1)
2. [Backup de PostgreSQL](#2-backup-de-postgresql)
3. [Backup de Arquivos e Midias](#3-backup-de-arquivos-e-midias)
4. [Backup de Model Weights e LoRA Adapters](#4-backup-de-model-weights-e-lora-adapters)
5. [Backup de Docker Volumes](#5-backup-de-docker-volumes)
6. [Opcoes de Backup Offsite](#6-opcoes-de-backup-offsite)
7. [Criptografia de Backups](#7-criptografia-de-backups)
8. [Agendamento Automatizado](#8-agendamento-automatizado)
9. [Monitoramento e Alertas](#9-monitoramento-e-alertas)
10. [Plano de Disaster Recovery (RPO/RTO)](#10-plano-de-disaster-recovery-rporto)
11. [Procedimentos de Teste de Restore](#11-procedimentos-de-teste-de-restore)
12. [Recomendacoes por Tier](#12-recomendacoes-por-tier)

---

## 1. Visao Geral e Regra 3-2-1

A regra **3-2-1** e o padrao minimo para qualquer backup serio:

| Principio | Significado | Implementacao no Segundo Cerebro |
|-----------|-------------|----------------------------------|
| **3** copias | Dados existem em 3 lugares | Original + disco externo local + cloud offsite |
| **2** midias | Pelo menos 2 tipos de midia diferentes | SSD do servidor + HDD externo USB |
| **1** offsite | Pelo menos 1 copia fora do local fisico | Backblaze B2 ou Wasabi ou segunda maquina remota |

### Extensao 3-2-1-1-0

Versao moderna que adiciona:

- **1** copia offline/imutavel (air-gapped ou object lock)
- **0** erros verificados (testes de restore regulares)

### O que precisa de backup no Segundo Cerebro

| Dado | Volume estimado | Criticidade | Frequencia de mudanca |
|------|----------------|-------------|----------------------|
| PostgreSQL (metadados, embeddings, grafos) | 5-50 GB | CRITICA | Constante |
| Arquivos raw (emails, mensagens, PDFs, fotos) | 50-500 GB | ALTA | Diaria |
| Arquivos processados (transcricoes, resumos) | 10-50 GB | MEDIA (regeneravel) | Diaria |
| Model weights (base models) | 20-100 GB | BAIXA (re-download) | Rara |
| LoRA adapters e fine-tunes | 1-10 GB | CRITICA (unico) | Semanal |
| Configs (Docker Compose, .env, scripts) | < 100 MB | CRITICA | Ocasional |
| Redis (filas, cache) | < 1 GB | BAIXA (efemero) | Constante |
| Prometheus/Grafana data | 5-20 GB | BAIXA | Constante |

---

## 2. Backup de PostgreSQL

### 2.1 pg_dump -- Backup Logico (Baseline)

O mais simples. Exporta SQL ou formato custom comprimido.

```bash
# Backup comprimido no formato custom (melhor para restore seletivo)
pg_dump -Fc -Z 6 -f /backup/cerebro_$(date +%Y%m%d_%H%M%S).dump cerebro_db

# Restore completo
pg_restore -d cerebro_db /backup/cerebro_20260411_030000.dump

# Restore de tabela especifica
pg_restore -d cerebro_db -t documents /backup/cerebro_20260411_030000.dump
```

| Vantagem | Desvantagem |
|----------|-------------|
| Simples, sem config extra | Lento para bancos grandes (>10 GB) |
| Restore seletivo por tabela | Backup inconsistente se durar muito |
| Portavel entre versoes PG | Perde WAL entre backups (RPO = intervalo do cron) |
| Compressao nativa | Lock parcial em tabelas durante dump |

**Veredicto**: Bom como backup complementar semanal. Nao serve como estrategia unica.

### 2.2 WAL-G -- Continuous Archiving (RECOMENDADO)

WAL-G faz backup base + archiving continuo de WAL (Write-Ahead Log), permitindo Point-in-Time Recovery (PITR).

```bash
# Instalacao
wget https://github.com/wal-g/wal-g/releases/latest/download/wal-g-pg-ubuntu-20.04-amd64
mv wal-g-pg-ubuntu-20.04-amd64 /usr/local/bin/wal-g && chmod +x /usr/local/bin/wal-g

# Configuracao via variaveis de ambiente
export WALG_S3_PREFIX=s3://cerebro-backups/walg
export AWS_ACCESS_KEY_ID=...        # Funciona com Backblaze B2 via S3 compat
export AWS_SECRET_ACCESS_KEY=...
export WALG_COMPRESSION_METHOD=lz4
export WALG_DELTA_MAX_STEPS=5       # Maximo de deltas antes de full backup

# Backup base
wal-g backup-push /var/lib/postgresql/16/main

# Listar backups
wal-g backup-list

# Restore para ponto no tempo
wal-g backup-fetch /var/lib/postgresql/16/main LATEST
# + configurar recovery_target_time no postgresql.conf
```

Configuracao no `postgresql.conf`:

```ini
wal_level = replica
archive_mode = on
archive_command = 'wal-g wal-push %p'
archive_timeout = 60     # Forca archive a cada 60s mesmo sem atividade
```

| Vantagem | Desvantagem |
|----------|-------------|
| PITR com granularidade de segundos | Config mais complexa |
| Backups incrementais (delta) | Requer espaco para WAL segments |
| Upload direto para S3/B2 | Menos maduro que pgBackRest para features enterprise |
| Compressao LZ4 muito rapida | Documentacao pode ser esparsa |

### 2.3 pgBackRest -- Alternativa Enterprise

Mais maduro e com mais features que WAL-G. Usado por grandes empresas.

```ini
# /etc/pgbackrest/pgbackrest.conf
[cerebro]
pg1-path=/var/lib/postgresql/16/main
pg1-port=5432

[global]
repo1-type=s3
repo1-s3-bucket=cerebro-backups
repo1-s3-endpoint=s3.us-west-000.backblazeb2.com
repo1-s3-region=us-west-000
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=<senha-forte>
repo1-retention-full=4
repo1-retention-diff=14
process-max=2
compress-type=zst
compress-level=3
```

```bash
# Full backup
pgbackrest --stanza=cerebro backup --type=full

# Differential (so mudancas desde ultimo full)
pgbackrest --stanza=cerebro backup --type=diff

# Incremental (so mudancas desde ultimo backup qualquer)
pgbackrest --stanza=cerebro backup --type=incr

# Restore PITR
pgbackrest --stanza=cerebro restore --type=time \
  --target="2026-04-11 03:00:00"
```

| Vantagem | Desvantagem |
|----------|-------------|
| PITR completo | Config mais verbosa |
| Paralelismo nativo (multi-thread backup/restore) | Maior consumo de recursos |
| Verificacao de integridade built-in | Overhead para uso pessoal |
| Criptografia nativa AES-256 | |
| Retention policies granulares | |

### 2.4 Barman -- Gerenciador de Backup PG

Feito pela EDB (empresa por tras do PG enterprise). Foco em gerenciamento centralizado.

```bash
# Backup via streaming
barman backup cerebro-server

# Listar backups
barman list-backup cerebro-server

# Restore
barman recover cerebro-server 20260411T030000 /var/lib/postgresql/16/main \
  --target-time "2026-04-11 03:00:00"
```

| Vantagem | Desvantagem |
|----------|-------------|
| Interface de gerenciamento madura | Requer maquina separada (backup server) |
| Streaming replication based | Python -- mais dependencias |
| Diagnosticos detalhados | Overkill para servidor unico |

### 2.5 Comparacao Final -- PostgreSQL

| Feature | pg_dump | WAL-G | pgBackRest | Barman |
|---------|---------|-------|------------|--------|
| PITR | Nao | Sim | Sim | Sim |
| Incremental | Nao | Delta | Full/Diff/Incr | Incr |
| Compressao | Sim | LZ4/ZSTD | ZSTD/LZ4/etc | Sim |
| Criptografia | Nao | Via storage | AES-256 nativo | GPG |
| S3/B2 nativo | Nao | Sim | Sim | Sim (via plugin) |
| Complexidade | Baixa | Media | Media-Alta | Alta |
| **Recomendado para Segundo Cerebro** | Complementar | **Principal** | Alternativa | Nao |

---

## 3. Backup de Arquivos e Midias

### 3.1 Restic (RECOMENDADO)

Backup com deduplicacao, criptografia e suporte nativo a multiplos backends.

```bash
# Inicializar repositorio no Backblaze B2
export B2_ACCOUNT_ID=...
export B2_ACCOUNT_KEY=...
restic -r b2:cerebro-backups:/files init

# Backup dos arquivos raw e processados
restic -r b2:cerebro-backups:/files backup \
  /data/cerebro/raw \
  /data/cerebro/processed \
  --exclude="*.tmp" \
  --exclude=".cache" \
  --tag=daily

# Listar snapshots
restic -r b2:cerebro-backups:/files snapshots

# Restore de arquivo especifico
restic -r b2:cerebro-backups:/files restore latest \
  --target /tmp/restore \
  --include="/data/cerebro/raw/email/2026-04"

# Politica de retencao
restic -r b2:cerebro-backups:/files forget \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 12 \
  --prune
```

| Vantagem | Desvantagem |
|----------|-------------|
| Criptografia AES-256 por padrao | Prune pode ser lento em repos grandes |
| Deduplicacao por content-defined chunking | Nao tem compressao (ate v0.16, agora tem zstd) |
| Backend: local, SFTP, S3, B2, Azure, GCS | Single-threaded em algumas operacoes |
| Restore rapido e seletivo | |
| Snapshots imutaveis | |

### 3.2 BorgBackup

Similar ao Restic mas mais antigo e com compressao mais madura.

```bash
# Inicializar repositorio
borg init --encryption=repokey /backup/borg-cerebro

# Backup
borg create --compression zstd,6 --stats \
  /backup/borg-cerebro::cerebro-{now:%Y%m%d-%H%M%S} \
  /data/cerebro/raw \
  /data/cerebro/processed

# Prune
borg prune --keep-daily=7 --keep-weekly=4 --keep-monthly=12 \
  /backup/borg-cerebro

# Restore
borg extract /backup/borg-cerebro::cerebro-20260411-030000 \
  data/cerebro/raw/email
```

| Vantagem | Desvantagem |
|----------|-------------|
| Compressao excelente (zstd, lz4, lzma) | Nao tem suporte nativo a S3/B2 |
| Deduplicacao madura | Precisa de `rclone` ou `borgmatic` para cloud |
| Mais rapido que Restic em muitos cenarios | Repo format nao e portavel entre major versions |
| Append-only mode para seguranca | |

### 3.3 rsync -- Copia Simples

Para copia rapida disco-a-disco ou para outra maquina.

```bash
# Sync incremental para disco externo
rsync -avz --delete \
  /data/cerebro/ \
  /mnt/backup-hdd/cerebro/

# Sync para maquina remota via SSH
rsync -avz --delete \
  /data/cerebro/ \
  user@backup-server:/backup/cerebro/
```

| Vantagem | Desvantagem |
|----------|-------------|
| Simples, ubiquo | Sem versionamento |
| Rapido para sync incremental | Sem criptografia (depende de SSH) |
| Sem overhead de metadados | Sem deduplicacao |
| Ideal para mirror local | Delete acidental propaga |

### 3.4 Comparacao -- Backup de Arquivos

| Feature | Restic | Borg | rsync |
|---------|--------|------|-------|
| Deduplicacao | Sim | Sim | Nao |
| Criptografia | AES-256 sempre | AES-256 opcional | Via SSH |
| Compressao | zstd (v0.16+) | zstd/lz4/lzma | Nao (gzip via -z) |
| Cloud nativo | S3, B2, SFTP, etc | Nao (via rclone) | Nao (via SSH) |
| Versionamento | Snapshots | Archives | Nao |
| **Recomendado** | **Principal** | Alternativa | Mirror local |

---

## 4. Backup de Model Weights e LoRA Adapters

### 4.1 Classificacao dos Modelos

| Tipo | Exemplo | Tamanho | Backup necessario? |
|------|---------|---------|-------------------|
| Base models (publicos) | Llama 3.x, Mistral, Phi-3 | 4-70 GB cada | NAO -- re-download do HuggingFace |
| LoRA adapters (custom) | Fine-tune pessoal | 50-500 MB cada | SIM -- unico e irrecuperavel |
| Quantizacoes custom | GGUF customizado | 2-30 GB | TALVEZ -- trabalhoso de refazer |
| Datasets de treino | JSONs, textos curados | 100 MB - 5 GB | SIM -- trabalho significativo |

### 4.2 DVC (Data Version Control)

Integra com Git para versionar arquivos grandes.

```bash
# Inicializar DVC no repo
dvc init
dvc remote add -d b2storage s3://cerebro-models/dvc \
  --endpointurl https://s3.us-west-000.backblazeb2.com

# Rastrear adapter
dvc add models/finetuned/cerebro-lora-v3/
git add models/finetuned/cerebro-lora-v3.dvc .gitignore
git commit -m "LoRA adapter v3"
dvc push
```

| Vantagem | Desvantagem |
|----------|-------------|
| Versionamento integrado com Git | Curva de aprendizado |
| Deduplicacao por hash | Mais complexo que necessario para poucos modelos |
| Pipelines reprodutiveis | |

### 4.3 Git LFS

Para adapters pequenos (<2 GB) que vivem no mesmo repo.

```bash
git lfs install
git lfs track "*.safetensors"
git lfs track "*.gguf"
git add .gitattributes
git add models/finetuned/
git commit -m "Track model adapters with LFS"
git push
```

### 4.4 Estrategia Manual (RECOMENDADO para inicio)

Para poucos adapters, Restic/Borg ja resolve.

```bash
# Incluir pasta de modelos custom no backup Restic
restic -r b2:cerebro-backups:/models backup \
  /data/cerebro/models/finetuned/ \
  /data/cerebro/models/datasets/ \
  --tag=models

# Manifest de base models (para re-download)
cat > /data/cerebro/models/base/MANIFEST.txt << EOF
llama-3.1-8b-instruct: huggingface.co/meta-llama/Llama-3.1-8B-Instruct
nomic-embed-text: ollama pull nomic-embed-text
whisper-large-v3: huggingface.co/openai/whisper-large-v3
EOF
```

**Recomendacao**: Usar Restic para LoRA adapters e datasets. Manter um MANIFEST.txt para base models. Migrar para DVC quando o volume crescer.

---

## 5. Backup de Docker Volumes

### 5.1 Volumes Nomeados

```bash
# Listar volumes
docker volume ls

# Backup de volume especifico usando container auxiliar
docker run --rm \
  -v cerebro_postgres_data:/source:ro \
  -v /backup/docker-volumes:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /source .

# Restore
docker run --rm \
  -v cerebro_postgres_data:/target \
  -v /backup/docker-volumes:/backup \
  alpine sh -c "cd /target && tar xzf /backup/postgres_data_20260411.tar.gz"
```

### 5.2 Script de Backup Completo

```bash
#!/bin/bash
# backup-volumes.sh
BACKUP_DIR="/backup/docker-volumes/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

VOLUMES=(
  "cerebro_postgres_data"
  "cerebro_redis_data"
  "cerebro_prometheus_data"
  "cerebro_grafana_data"
)

for vol in "${VOLUMES[@]}"; do
  echo "Backing up $vol..."
  docker run --rm \
    -v "${vol}:/source:ro" \
    -v "${BACKUP_DIR}:/backup" \
    alpine tar czf "/backup/${vol}.tar.gz" -C /source .
done

echo "Backup completo: $BACKUP_DIR"
```

### 5.3 Nota Importante

Para **PostgreSQL**, NUNCA confie apenas em backup do volume Docker. Sempre use pg_dump ou WAL-G. Copiar o volume com o banco rodando pode gerar dados corrompidos. Para Redis, o volume backup e aceitavel pois o RDB/AOF e projetado para ser copiado.

---

## 6. Opcoes de Backup Offsite

### 6.1 Comparacao de Provedores Cloud

| Provedor | Preco (GB/mes) | Egress | S3-compat | Notas |
|----------|----------------|--------|-----------|-------|
| **Backblaze B2** | $0.006 | $0.01/GB | Sim | 10 GB gratis. Egress gratis via Cloudflare |
| **Wasabi** | $0.0069 | Gratis | Sim | Sem taxa de egress. Min 1 TB billing |
| **AWS S3 Glacier** | $0.0036 | $0.09/GB | Sim | Restore lento (horas) e caro |
| **Hetzner Storage Box** | ~$0.005 | Gratis | SFTP/rsync | Bom para Europa. Suporte a BorgBackup nativo |
| **Self-hosted remoto** | Custo da maquina | N/A | N/A | Controle total mas mais trabalho |

### 6.2 Backblaze B2 (RECOMENDADO)

- 10 GB gratis (suficiente para configs e adapters)
- API compativel com S3 -- funciona com WAL-G, Restic, pgBackRest
- Object Lock para backups imutaveis (protecao contra ransomware)
- Lifecycle rules para mover backups antigos para niveis mais baratos

### 6.3 Self-Hosted com Segunda Maquina

Para quem quer controle total:

```bash
# Na maquina remota (ex: casa de familiar, VPS)
# Restic via SFTP
restic -r sftp:user@remote:/backup/cerebro init

# Ou BorgBackup via SSH
borg init --encryption=repokey ssh://user@remote/backup/borg-cerebro

# Via Tailscale (melhor -- sem portas abertas)
restic -r sftp:user@100.x.x.x:/backup/cerebro backup /data/cerebro/
```

### 6.4 Implementacao da Regra 3-2-1 para o Segundo Cerebro

```
Copia 1 (ORIGINAL): SSD do servidor (/data/cerebro/)
Copia 2 (LOCAL):     HDD externo USB (/mnt/backup-hdd/) -- rsync diario
Copia 3 (OFFSITE):   Backblaze B2 -- Restic diario, WAL-G continuo
```

---

## 7. Criptografia de Backups

### 7.1 Opcoes de Criptografia

| Ferramenta | Algoritmo | Integrado em | Uso |
|------------|-----------|-------------|-----|
| **Restic** (built-in) | AES-256-CTR + Poly1305 | Restic | Automatico, sempre ativo |
| **Borg** (built-in) | AES-256-CTR + HMAC-SHA256 | BorgBackup | Ativado com `--encryption=repokey` |
| **age** | X25519 + ChaCha20-Poly1305 | Standalone | Criptografar antes de upload |
| **GPG** | RSA/AES | Standalone | Tradicional, mais complexo |
| **pgBackRest** (built-in) | AES-256-CBC | pgBackRest | Config no pgbackrest.conf |

### 7.2 age -- Criptografia Moderna (para scripts custom)

```bash
# Gerar chave
age-keygen -o ~/.config/cerebro/backup-key.txt

# Criptografar arquivo
age -r age1ql3z7hjy... -o backup.tar.gz.age backup.tar.gz

# Descriptografar
age -d -i ~/.config/cerebro/backup-key.txt -o backup.tar.gz backup.tar.gz.age
```

### 7.3 Recomendacao

- **Restic**: criptografia ja inclusa, nenhuma config extra necessaria
- **WAL-G/pgBackRest**: usar criptografia nativa da ferramenta
- **age**: para qualquer backup manual ou script custom
- **GPG**: evitar -- complexidade desnecessaria para uso pessoal
- **IMPORTANTE**: Guardar a chave de criptografia em local seguro e separado (ex: password manager, papel em cofre). Backup criptografado sem a chave = dados perdidos.

---

## 8. Agendamento Automatizado

### 8.1 systemd Timers (RECOMENDADO para Linux)

```ini
# /etc/systemd/system/cerebro-backup-files.timer
[Unit]
Description=Cerebro file backup timer

[Timer]
OnCalendar=*-*-* 03:00:00
RandomizedDelaySec=900
Persistent=true

[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/cerebro-backup-files.service
[Unit]
Description=Cerebro file backup via Restic
After=network-online.target

[Service]
Type=oneshot
User=cerebro
EnvironmentFile=/etc/cerebro/backup.env
ExecStart=/usr/local/bin/cerebro-backup-files.sh
ExecStartPost=/usr/local/bin/cerebro-backup-notify.sh
```

```bash
# Ativar
systemctl enable --now cerebro-backup-files.timer
systemctl list-timers --all | grep cerebro
```

### 8.2 Celery Beat (para integracao com o sistema)

```python
# celery_config.py
from celery.schedules import crontab

beat_schedule = {
    'backup-postgres-daily': {
        'task': 'cerebro.tasks.backup.pg_backup',
        'schedule': crontab(hour=2, minute=0),
    },
    'backup-files-daily': {
        'task': 'cerebro.tasks.backup.restic_backup',
        'schedule': crontab(hour=3, minute=0),
    },
    'backup-verify-weekly': {
        'task': 'cerebro.tasks.backup.verify_backups',
        'schedule': crontab(hour=4, minute=0, day_of_week='sunday'),
    },
    'backup-prune-weekly': {
        'task': 'cerebro.tasks.backup.restic_prune',
        'schedule': crontab(hour=5, minute=0, day_of_week='sunday'),
    },
}
```

### 8.3 Cronograma Recomendado

| Tarefa | Frequencia | Horario | Ferramenta |
|--------|-----------|---------|------------|
| WAL archiving (PG) | Continuo | Tempo real | WAL-G |
| PG base backup | Diario | 02:00 | WAL-G `backup-push` |
| File backup (raw+processed) | Diario | 03:00 | Restic |
| LoRA adapters backup | Apos cada treino | Event-driven | Restic |
| Docker volumes | Semanal | Dom 04:00 | Script custom |
| pg_dump (complementar) | Semanal | Dom 02:30 | pg_dump |
| rsync para HDD externo | Diario | 04:00 | rsync |
| Prune/retencao | Semanal | Dom 05:00 | Restic forget |
| Verificacao de integridade | Semanal | Dom 06:00 | Restic check |
| Teste de restore | Mensal | 1o Sabado | Script custom |

---

## 9. Monitoramento e Alertas

### 9.1 Metricas de Backup para Prometheus

```yaml
# Custom exporter ou textfile collector
cerebro_backup_last_success_timestamp{type="postgres"} 1712804400
cerebro_backup_last_success_timestamp{type="files"} 1712808000
cerebro_backup_size_bytes{type="postgres"} 5368709120
cerebro_backup_size_bytes{type="files"} 107374182400
cerebro_backup_duration_seconds{type="postgres"} 180
cerebro_backup_duration_seconds{type="files"} 600
cerebro_backup_snapshots_count{type="files"} 42
```

### 9.2 Alertas no Grafana

```yaml
# Alerta se backup tem mais de 26 horas (margem de 2h sobre o diario)
- alert: BackupStale
  expr: time() - cerebro_backup_last_success_timestamp > 93600
  for: 1h
  labels:
    severity: critical
  annotations:
    summary: "Backup {{ $labels.type }} atrasado"

# Alerta se backup cresceu/encolheu demais (possivel corrupcao)
- alert: BackupSizeAnomaly
  expr: |
    abs(cerebro_backup_size_bytes - cerebro_backup_size_bytes offset 1d)
    / cerebro_backup_size_bytes offset 1d > 0.5
  for: 1h
  labels:
    severity: warning
```

### 9.3 Script de Freshness Check

```bash
#!/bin/bash
# check-backup-freshness.sh
MAX_AGE_HOURS=26

check_restic() {
  LAST=$(restic -r b2:cerebro-backups:/files snapshots --latest 1 --json \
    | jq -r '.[0].time')
  LAST_EPOCH=$(date -d "$LAST" +%s)
  NOW=$(date +%s)
  AGE_HOURS=$(( (NOW - LAST_EPOCH) / 3600 ))

  if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
    echo "ALERTA: Backup de arquivos tem ${AGE_HOURS}h (max: ${MAX_AGE_HOURS}h)"
    # Enviar alerta via Telegram/Discord
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d "chat_id=${TG_CHAT_ID}" \
      -d "text=ALERTA: Backup de arquivos atrasado (${AGE_HOURS}h)"
  fi
}

check_walg() {
  LAST=$(wal-g backup-list --json | jq -r '.[-1].time')
  # Mesma logica...
}

check_restic
check_walg
```

### 9.4 Notificacoes

| Canal | Quando | Prioridade |
|-------|--------|-----------|
| Telegram bot | Backup falhou ou atrasado | Alta |
| Grafana dashboard | Status geral | Informativo |
| Email diario (resumo) | Todas as manhans | Baixa |
| Discord webhook | Anomalia de tamanho | Media |

---

## 10. Plano de Disaster Recovery (RPO/RTO)

### 10.1 Definicoes

- **RPO** (Recovery Point Objective): quanto tempo de dados pode-se perder
- **RTO** (Recovery Time Objective): quanto tempo ate o sistema voltar a operar

### 10.2 Targets para Uso Pessoal

| Componente | RPO | RTO | Justificativa |
|-----------|-----|-----|---------------|
| PostgreSQL (metadados) | < 1 minuto | < 2 horas | WAL-G continuo, dados criticos |
| Arquivos raw | < 24 horas | < 4 horas | Backup diario e aceitavel |
| LoRA adapters | < 1 hora pos-treino | < 1 hora | Backup event-driven |
| Configs/Docker | < 1 dia | < 30 min | Em Git, restore rapido |
| Base models | N/A | < 8 horas | Re-download, depende da internet |
| Monitoramento | < 7 dias | < 1 hora | Dados nao criticos |

### 10.3 Cenarios de Desastre

| Cenario | Impacto | Procedimento |
|---------|---------|-------------|
| **Disco corrompido** | Perda parcial | Restore do Restic/WAL-G. Trocar disco |
| **Servidor morreu** | Perda total local | Novo hardware + restore completo do B2 |
| **Ransomware** | Criptografia maliciosa | Restore do B2 (object lock). Reinstalar OS |
| **Acidente (rm -rf)** | Perda parcial | Restore seletivo do snapshot Restic |
| **Incendio/roubo** | Perda total local | Copia offsite no B2. Novo hardware |
| **Corrupcao silenciosa** | Dados ruins | Verificacao semanal + snapshots historicos |

### 10.4 Runbook de Disaster Recovery

```
1. AVALIAR: Qual cenario? Qual a extensao dos danos?
2. PROVISIONAR: Novo hardware ou VM temporaria
3. INSTALAR: OS + Docker + configs do Git
4. RESTAURAR PostgreSQL:
   a. wal-g backup-fetch /var/lib/postgresql/16/main LATEST
   b. Configurar recovery_target_time se necessario
   c. Iniciar PG e verificar integridade
5. RESTAURAR arquivos:
   a. restic -r b2:cerebro-backups:/files restore latest --target /data/cerebro
6. RESTAURAR modelos:
   a. Base models: ollama pull <model> (do MANIFEST.txt)
   b. LoRA adapters: restic restore do snapshot de modelos
7. INICIAR Docker Compose:
   a. docker compose up -d
8. VERIFICAR: Testar API, checar dados, verificar embeddings
9. MONITORAR: Acompanhar logs por 24h apos restore
```

---

## 11. Procedimentos de Teste de Restore

### 11.1 Teste Automatizado Mensal

```bash
#!/bin/bash
# test-restore.sh -- Executar no 1o Sabado de cada mes
set -euo pipefail

RESTORE_DIR="/tmp/restore-test-$(date +%Y%m%d)"
LOG="/var/log/cerebro/restore-test.log"

echo "=== Teste de Restore $(date) ===" | tee -a "$LOG"

# 1. Testar restore do PostgreSQL
echo "Testando PG restore..." | tee -a "$LOG"
docker run --rm -d --name pg-test \
  -e POSTGRES_PASSWORD=test \
  -v pg-test-data:/var/lib/postgresql/data \
  postgres:16
sleep 10
wal-g backup-fetch /tmp/pg-restore LATEST 2>&1 | tee -a "$LOG"
# Verificar se o backup e valido
docker exec pg-test pg_isready
docker stop pg-test
docker volume rm pg-test-data

# 2. Testar restore de arquivos (amostra)
echo "Testando Restic restore (amostra)..." | tee -a "$LOG"
mkdir -p "$RESTORE_DIR"
restic -r b2:cerebro-backups:/files restore latest \
  --target "$RESTORE_DIR" \
  --include="/data/cerebro/raw/email" 2>&1 | tee -a "$LOG"

# Verificar integridade
FILE_COUNT=$(find "$RESTORE_DIR" -type f | wc -l)
echo "Arquivos restaurados: $FILE_COUNT" | tee -a "$LOG"

# 3. Verificar integridade do repositorio Restic
echo "Verificando integridade do repo Restic..." | tee -a "$LOG"
restic -r b2:cerebro-backups:/files check --read-data-subset=5% 2>&1 | tee -a "$LOG"

# Cleanup
rm -rf "$RESTORE_DIR"

# Notificar resultado
echo "Teste de restore concluido com sucesso" | tee -a "$LOG"
```

### 11.2 Checklist de Verificacao

- [ ] PG restore completa sem erros
- [ ] Queries basicas retornam dados esperados
- [ ] Contagem de registros bate com ultimo backup
- [ ] Arquivos restaurados abrem corretamente (amostra)
- [ ] Checksums de LoRA adapters batem
- [ ] Docker Compose sobe todos os servicos
- [ ] API responde apos restore
- [ ] Embeddings retornam resultados de busca

---

## 12. Recomendacoes por Tier

### Tier 1 -- Minimo Viavel (implementar primeiro)

| Item | Ferramenta | Esforco |
|------|-----------|---------|
| PG backup diario | pg_dump via cron | 30 min |
| Arquivos para HDD externo | rsync diario | 30 min |
| Configs em Git | Git repo privado | 1 hora |
| Copia offsite manual | Restic para B2 (10 GB gratis) | 2 horas |

**Custo**: $0/mes (dentro do free tier B2)
**RPO**: ~24 horas

### Tier 2 -- Recomendado (implementar em seguida)

| Item | Ferramenta | Esforco |
|------|-----------|---------|
| PG continuous archiving | WAL-G para B2 | 3 horas |
| Arquivos com dedup+crypto | Restic diario para B2 + HDD | 2 horas |
| LoRA adapters versionados | Restic com tag especifico | 1 hora |
| Agendamento | systemd timers | 2 horas |
| Monitoramento basico | Script de freshness + Telegram | 2 horas |
| Teste de restore mensal | Script automatizado | 2 horas |

**Custo**: ~$1-5/mes (B2 para 50-200 GB)
**RPO**: < 1 minuto (PG), < 24 horas (arquivos)

### Tier 3 -- Completo (para quando o sistema estiver maduro)

| Item | Ferramenta | Esforco |
|------|-----------|---------|
| PG backup com criptografia | pgBackRest com AES-256 | 4 horas |
| Backup imutavel | B2 Object Lock | 1 hora |
| Segunda copia offsite | Wasabi ou maquina remota | 3 horas |
| Metricas no Prometheus | Custom exporter | 3 horas |
| Alertas no Grafana | Dashboards + alertas | 2 horas |
| DVC para modelos | DVC + remote B2 | 3 horas |
| Teste de DR completo | Restore em VM separada | 4 horas |

**Custo**: ~$5-15/mes (B2 + Wasabi para 200-500 GB)
**RPO**: < 1 minuto (PG), < 24 horas (arquivos), 0 para configs

---

## Resumo das Decisoes

| Componente | Escolha Principal | Alternativa |
|-----------|-------------------|-------------|
| PG backup | WAL-G (PITR) | pgBackRest |
| PG complementar | pg_dump semanal | -- |
| Arquivos/midias | Restic | BorgBackup |
| Mirror local | rsync para HDD | Restic local |
| Model weights | Restic + MANIFEST | DVC (futuro) |
| Docker volumes | Script tar + Restic | -- |
| Offsite cloud | Backblaze B2 | Wasabi |
| Criptografia | Built-in (Restic/WAL-G) | age para scripts |
| Agendamento | systemd timers | Celery Beat |
| Monitoramento | Prometheus + Grafana | Script + Telegram |

---

## Proximos Passos

1. Implementar Tier 1 assim que o servidor estiver rodando
2. Migrar para Tier 2 na primeira semana de operacao
3. Agendar primeiro teste de restore no primeiro mes
4. Documentar o runbook de DR com credenciais (em local seguro)
5. Revisar e ajustar RPO/RTO apos 3 meses de uso real
