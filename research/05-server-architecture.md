# 05 — Arquitetura de Servidor

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: stack final do servidor fisico

---

## 1. Containerizacao

### Docker Compose (RECOMENDADO para servidor unico)

- Inicia containers em ~0.5s (vs 1.5-3s para Kubernetes pods)
- Overhead quase zero
- GPU passthrough maduro via `deploy.resources.reservations.devices`
- Kubernetes so faz sentido com multiplos servidores fisicos

### GPU Passthrough

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

Requer: **NVIDIA Container Toolkit** (`nvidia-ctk`)

### Isolamento de servicos
- Networks dedicadas: frontend, backend, data, monitoring
- Cada servico em seu container
- GPU pinning via `device_ids` quando necessario

---

## 2. Filas de Mensagens e Agendamento

### Redis + Celery (RECOMENDADO para Python)

- Redis: 5.200 tasks/sec a 12ms latencia (68% melhor que RabbitMQ)
- Redis Streams com consumer groups para at-least-once delivery
- Celery Beat para tarefas periodicas

### Abordagem Hibrida (consenso 2025-2026)

**Event-driven** como padrao primario:
- Arquivo ingerido → processa
- Webhook recebido → processa

**Cron-based** para manutencao:
- Sintese diaria
- Sync horario
- Re-indexacao semanal

### Temporal (para workflows longos)
- Execucao duravel que pode durar dias/meses
- Crash recovery automatico
- Bom para fine-tuning jobs e consolidacao de memoria

---

## 3. Banco de Dados

### PostgreSQL + pgvector (RECOMENDADO)

- Relacional + vetorial na mesma transacao
- 471 QPS a 99% recall em 50M vetores (com pgvectorscale)
- **Diretamente compativel com Supabase** para sync
- Para volume pessoal (milhoes de vetores), pgvector e mais que suficiente

### Alternativas

| Opcao | Quando usar |
|-------|------------|
| **ChromaDB** | POC rapido, prototipagem |
| **Qdrant** | Se precisar de vector store dedicado depois |
| **SQLite + sqlite-vec** | Cenarios single-process apenas. Complica sync |

**Recomendacao**: PostgreSQL + pgvector como banco primario. ChromaDB pode ser adicionado depois se necessario.

---

## 4. Sync Local ↔ Supabase (Nuvem)

### Custom Sync Agent (RECOMENDADO)

- Celery periodic task a cada 5-15 minutos
- Push seletivo: so registros `status = 'processed'` vao pra nuvem
- Dados raw, logs de agentes, arquivos temporarios ficam LOCAL
- Conflict resolution: last-write-wins com merge por campo
  - Local ganha para campos AI-generated (embeddings, tags)
  - Cloud ganha para campos user-edited

### PostgreSQL Logical Replication (alternativa)
- Unidirecional. Supabase pode nao suportar incoming subscriptions em todos os planos
- Comunidade PostgreSQL desenvolvendo deteccao automatica de conflitos para replicacao bidirecional

---

## 5. Storage de Arquivos

### Filesystem organizado (RECOMENDADO para servidor unico)

```
/data/cerebro/
├── raw/
│   ├── email/2026-04/
│   ├── whatsapp/2026-04/
│   ├── telegram/2026-04/
│   ├── screenshots/2026-04/
│   ├── voice/2026-04/
│   └── files/2026-04/
├── processed/
│   ├── transcripts/
│   ├── summaries/
│   └── embeddings/
└── models/
    ├── base/
    └── finetuned/
```

- Deduplicacao: SHA-256 content hashing no banco
- Deduplicacao semantica opcional: cosine similarity de embeddings
- MinIO mudou direcao e cortou utilidades da community edition
- Alternativas S3-compat: **Garage** (leve) ou **SeaweedFS**

---

## 6. Monitoramento

### Stack padrao

| Ferramenta | Funcao |
|------------|--------|
| **Prometheus** | Coleta de metricas |
| **Grafana** | Dashboards e visualizacao |
| **DCGM Exporter** | Metricas NVIDIA GPU (temp, VRAM, utilizacao) |
| **Node Exporter** | Metricas de sistema (CPU, RAM, disco) |
| **cAdvisor** | Metricas de containers |
| **Loki** | Logs (mais leve que ELK) |

### Metricas LLM-especificas
- p95/p99 latencia
- Tokens/sec throughput
- Duracao de fila
- Cache utilization

### Alertas (Grafana → Telegram/Discord)
- GPU temperatura > threshold
- Container crashou
- Fila backup crescendo

---

## 7. Seguranca

### 3 camadas criticas

**1. Acesso remoto: Tailscale**
- VPN WireGuard mesh zero-config
- Sem portas abertas no roteador
- Free tier: 100 devices
- Alternativa self-hosted: **Headscale**

**2. Dados em repouso: LUKS**
- Full-disk encryption AES-XTS com Argon2id
- Configurar durante instalacao do OS

**3. Firewall: UFW + DOCKER-USER fix**
- Docker bypassa UFW por padrao (insere regras iptables antes)
- Todos servicos Docker devem bindar a `127.0.0.1`, NAO `0.0.0.0`
- Fix: regras no chain `DOCKER-USER`

---

## 8. Arquiteturas de Referencia

| Projeto | O que faz | Relevancia |
|---------|-----------|-----------|
| **local-ai-packaged** (coleam00) | Ollama + Supabase + n8n + Open WebUI + Qdrant + Neo4j + Langfuse | Stack all-in-one mais completo |
| **n8n Self-Hosted AI Starter Kit** | n8n + Ollama + Qdrant + PostgreSQL com GPU profiles | Automacao visual + AI |
| **raold/second-brain** | FastAPI + PostgreSQL + pgvector + LLaVA + CLIP | Mais proximo do Segundo Cerebro |
| **Khoj** | Django + PostgreSQL + custom agents | Mais maduro "AI second brain" |

---

## Arquitetura Recomendada Final

```
┌─────────────────────────────────────────────────┐
│                SERVIDOR FISICO                   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Ollama   │  │ PostgreSQL│  │ Redis    │      │
│  │ (GPU)    │  │ + pgvector│  │ (filas)  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Celery   │  │ FastAPI  │  │ Prometheus│      │
│  │ Workers  │  │ (API)    │  │ + Grafana │      │
│  │ (agentes)│  │          │  │           │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│                                                  │
│  ┌──────────┐  ┌──────────┐                     │
│  │ Syncthing│  │ n8n      │                     │
│  │ (sync)   │  │ (ingestao)│                    │
│  └──────────┘  └──────────┘                     │
│                                                  │
│  ══════════ Tailscale VPN ══════════            │
└─────────────────────────────────────────────────┘
         │ sync seletivo │
         ▼               ▼
    ┌──────────┐   ┌──────────┐
    │ Supabase │   │ Vercel   │
    │ (cloud)  │   │ (Next.js)│
    └──────────┘   └──────────┘
```

---

## Decisao de Tecnologia

| Componente | Escolha Recomendada | Alternativa |
|------------|-------------------|-------------|
| Container | Docker Compose | — |
| GPU | NVIDIA Container Toolkit | — |
| Fila | Redis + Celery | Temporal (para workflows longos) |
| Banco | PostgreSQL + pgvector | ChromaDB (POC) |
| Sync cloud | Custom sync agent (Celery task) | pg logical replication |
| Storage | Filesystem organizado | Garage/SeaweedFS (S3) |
| Monitoramento | Prometheus + Grafana + Loki | — |
| Acesso remoto | Tailscale | Headscale (self-hosted) |
| Encryption | LUKS full-disk | + VeraCrypt volumes sensiveis |

---

## Proximos Passos (decisao do Cris)

1. Qual hardware para o servidor? (CPU, RAM, GPU, storage)
2. Linux (qual distro?) ou Windows Server?
3. Tailscale free tier ou Headscale self-hosted?
4. Testar stack no notebook antes de comprar servidor?
