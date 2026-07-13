# 12 — Arquitetura Multi-Tenant para AI Pessoal

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: qual modelo de isolamento adotar para replicar o Segundo Cerebro?

---

## Contexto

O Segundo Cerebro foi projetado como infraestrutura AI pessoal para o Cris. O proximo
passo e permitir que **outras pessoas usem o sistema**, cada uma com seus proprios dados,
agentes, modelos e billing — sem que um usuario veja ou afete os dados de outro.

Isso exige uma **arquitetura multi-tenant**: um unico sistema (ou conjunto de sistemas)
servindo multiplos "tenants" (usuarios/clientes) com isolamento de dados e recursos.

---

## 1. Padroes de Multi-Tenancy

### 1.1 Visao Geral

```
┌──────────────────────────────────────────────────────────────────┐
│              ESPECTRO DE ISOLAMENTO                               │
│                                                                   │
│  Row-Level        Schema-per-Tenant      Database-per-Tenant     │
│  Isolation        (namespaces)           (instancias separadas)  │
│                                                                   │
│  ◄─── Menos isolamento ──────────────── Mais isolamento ───►    │
│  ◄─── Menor custo ──────────────────── Maior custo ────────►    │
│  ◄─── Mais simples ops ─────────────── Ops mais complexo ──►    │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Row-Level Isolation (RLS)

**Como funciona**: Todos os tenants compartilham as mesmas tabelas. Cada linha tem uma
coluna `tenant_id`. Policies no banco garantem que queries so retornam dados do tenant
correto.

```sql
-- Exemplo PostgreSQL Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Na aplicacao, antes de cada request:
SET app.current_tenant = 'uuid-do-tenant';
```

| Vantagem | Desvantagem |
|----------|-------------|
| Menor custo (1 banco, 1 schema) | Bug no RLS = vazamento catastrofico |
| Migrations simples (1 lugar) | Noisy neighbor (tenant pesado afeta outros) |
| Queries cross-tenant faceis (admin) | Backup/restore por tenant e complexo |
| Pool de conexoes compartilhado | Dificil dar compliance individual (GDPR delete) |

**Quando usar**: MVP, ate ~50 tenants, dados nao-criticos, equipe pequena.

### 1.3 Schema-per-Tenant

**Como funciona**: Cada tenant tem seu proprio schema PostgreSQL dentro do mesmo banco.
Tabelas identicas, mas em namespaces separados.

```sql
-- Criar schema para novo tenant
CREATE SCHEMA tenant_abc123;

-- Tabelas dentro do schema
CREATE TABLE tenant_abc123.documents (...);
CREATE TABLE tenant_abc123.embeddings (...);
CREATE TABLE tenant_abc123.memories (...);

-- Na aplicacao:
SET search_path TO tenant_abc123, public;
```

| Vantagem | Desvantagem |
|----------|-------------|
| Bom isolamento logico | Migrations precisam rodar N vezes (1 por schema) |
| Backup por tenant (pg_dump -n schema) | Limite pratico: ~500 schemas antes de degradar |
| Mesma instancia = menor custo | Connection pooling por schema pode complicar |
| Extensions compartilhadas (pgvector) | Monitoramento por schema requer tooling extra |

**Quando usar**: 10-500 tenants, dados sensiveis, necessidade de backup individual.

### 1.4 Database-per-Tenant

**Como funciona**: Cada tenant tem sua propria instancia de banco PostgreSQL.
Isolamento total de dados, recursos e configuracao.

| Vantagem | Desvantagem |
|----------|-------------|
| Isolamento maximo | Custo proporcional ao numero de tenants |
| Performance previsivel por tenant | Ops overhead significativo |
| Compliance trivial (delete = drop database) | Sem queries cross-tenant (precisa de federacao) |
| Backup/restore independente | Cada banco precisa de suas extensions |
| Versoes/configs diferentes por tenant | Connection pooling multiplicado |

**Quando usar**: Tenants enterprise, requisitos regulatorios fortes, <50 tenants de alto valor.

---

## 2. PostgreSQL: Opcoes Especificas

### 2.1 PostgreSQL Vanilla + Schemas

A opcao mais direta. Usar `schema-per-tenant` com uma instancia PostgreSQL local
(como ja existe na arquitetura do Segundo Cerebro).

**Tooling necessario**:
- **Alembic** com migration runner multi-schema
- **pgvector** instalado no `public` schema (compartilhado)
- **PgBouncer** ou **Supavisor** para connection pooling

```python
# Middleware FastAPI para setar schema por request
@app.middleware("http")
async def set_tenant_schema(request: Request, call_next):
    tenant_id = get_tenant_from_token(request)
    async with db.acquire() as conn:
        await conn.execute(f"SET search_path TO tenant_{tenant_id}, public")
    response = await call_next(request)
    return response
```

### 2.2 Neon (Serverless PostgreSQL)

Neon oferece **branching** de banco — forks copy-on-write que compartilham storage.

**Como usar para multi-tenant**:
- Branch principal = template com schema base + extensions
- Cada tenant = branch do principal
- Branches sao instancias PostgreSQL completas com isolamento total
- Storage e copy-on-write: so paga pelo delta (dados que o tenant adiciona)
- Scale-to-zero: branches inativos nao consomem compute

**Vantagens Neon**:
- `CREATE BRANCH` leva ~1 segundo (vs minutos para provisionar DB)
- Cada branch tem seu proprio connection string
- Autoscaling de 0.25 a 10 CU (compute units)
- pgvector suportado nativamente
- Free tier: 10 branches, 0.5 GiB storage

**Desvantagens Neon**:
- Dependencia de vendor (hosted only, nao e self-hosted)
- Latencia de cold start quando branch acorda (~500ms-2s)
- Custo escala com numero de branches ativos simultaneamente
- Branches ativos consomem CUs mesmo idle

**Modelo de custo (abril 2026)**:

| Plano | Branches | Storage | Compute | Preco |
|-------|----------|---------|---------|-------|
| Free | 10 | 0.5 GiB | 191h/mes | $0 |
| Launch | 500 | 10 GiB | 300h/mes | ~$19/mes |
| Scale | 500 | 50 GiB | 750h/mes | ~$69/mes |
| Business | 5000 | 500 GiB | 1000h/mes | ~$700/mes |

### 2.3 Supabase Multi-Tenant

Supabase oferece duas abordagens:

**A) RLS nativo (recomendado por Supabase)**:
- Row Level Security com `auth.uid()` como tenant identifier
- Integrado com Supabase Auth (JWT automatico)
- Funciona out-of-the-box com Supabase client libraries
- pgvector disponivel como extension

```sql
-- Supabase RLS com auth integrado
CREATE POLICY "Users see own data" ON documents
  FOR ALL USING (auth.uid() = owner_id);
```

**B) Supabase Management API (database-per-tenant)**:
- API para criar/deletar projetos Supabase programaticamente
- Cada tenant = projeto Supabase separado
- Isolamento total mas custo alto ($25/mes por projeto no plano Pro)
- Bom para modelo B2B de alto valor

**Vantagens Supabase**:
- Auth + RLS integrados = menos codigo
- Realtime subscriptions por tenant
- Storage (S3-like) com RLS por bucket
- Edge Functions para logica serverless
- Dashboard admin por projeto

**Desvantagens Supabase**:
- RLS e poderoso mas erros sao silenciosos (query retorna vazio, nao erro)
- Database-per-tenant via Management API e caro ($25+/tenant/mes)
- Self-hosting Supabase e possivel mas complexo (15+ containers)

### 2.4 Comparacao PostgreSQL

| Criterio | Vanilla + Schemas | Neon Branching | Supabase RLS | Supabase DB/tenant |
|----------|-------------------|----------------|--------------|-------------------|
| Isolamento | Medio | Alto | Baixo-Medio | Alto |
| Custo/tenant | Muito baixo | Baixo-Medio | Muito baixo | Alto ($25+) |
| Setup | Manual | API simples | Mais simples | API simples |
| Ops overhead | Medio | Baixo (managed) | Baixo (managed) | Medio |
| Backup/tenant | pg_dump -n | Branch snapshot | Export manual | Projeto separado |
| pgvector | Sim | Sim | Sim | Sim |
| Self-hosted | Sim | Nao | Sim (complexo) | Nao |
| Max tenants | ~500 schemas | ~5000 branches | Sem limite pratico | ~centenas |
| Cold start | N/A | 500ms-2s | N/A | N/A |

---

## 3. Isolamento de Agentes AI por Tenant

### 3.1 Problema

Cada tenant precisa de seus proprios agentes com:
- Memoria separada (short-term, long-term, entity)
- Contexto isolado (um tenant nao influencia outro)
- Personalidade/configuracao propria
- Acesso apenas aos seus dados

### 3.2 CrewAI: Instancias por Tenant

```
┌───────────────────────────────────────────────────┐
│                 TENANT ROUTER                      │
│        (FastAPI + tenant middleware)               │
└──────────┬──────────┬──────────┬─────────────────┘
           │          │          │
     ┌─────▼────┐┌────▼────┐┌───▼─────┐
     │ Crew     ││ Crew    ││ Crew    │
     │ Tenant A ││ Tenant B││ Tenant C│
     │          ││         ││         │
     │ Memory:  ││ Memory: ││ Memory: │
     │ schema_a ││ schema_b││ schema_c│
     │          ││         ││         │
     │ Config:  ││ Config: ││ Config: │
     │ yaml_a   ││ yaml_b  ││ yaml_c  │
     └──────────┘└─────────┘└─────────┘
```

**Estrategia**: Nao criar processos separados por tenant. Em vez disso:

1. **Pool de Crews reutilizaveis**: Instanciar Crew por request, injetando tenant config
2. **Memory backends por schema**: Cada Crew aponta para `schema_{tenant_id}`
3. **YAML configs por tenant**: Roles, goals, backstories customizaveis
4. **Celery workers**: Tasks taggeadas com `tenant_id`, routed para filas por tenant

```python
# Factory de Crew por tenant
def create_tenant_crew(tenant_id: str, task_type: str) -> Crew:
    config = load_tenant_config(tenant_id)  # YAML do tenant
    memory_backend = PostgresMemory(schema=f"tenant_{tenant_id}")

    return Crew(
        agents=build_agents(config, memory_backend),
        tasks=build_tasks(task_type, config),
        memory=True,
        memory_config={"provider": memory_backend},
        verbose=config.get("verbose", False),
    )
```

### 3.3 LangGraph: Isolamento via Checkpoints

LangGraph ja suporta multi-tenant via **thread_id** em checkpoints:
- Cada tenant tem seus proprios threads
- State e isolado por thread
- PostgreSQL checkpoint backend com schema-per-tenant

### 3.4 Ollama: Contextos por Tenant

Ollama nao tem conceito nativo de "tenant". Estrategias:

**A) Modelo compartilhado, contexto isolado** (RECOMENDADO):
- Mesmo modelo carregado 1x na VRAM
- Cada request leva seu proprio contexto (sem state entre requests)
- Isolamento natural: LLM e stateless por design
- Sem custo extra de VRAM por tenant

**B) LoRA adapters por tenant** (avancado — ver secao 4):
- Modelo base compartilhado + LoRA por tenant
- Personalidade/estilo diferente por usuario
- Requer vLLM ou TabbyAPI para hot-swap de LoRA

**C) Instancias Ollama separadas** (overkill para maioria):
- 1 container Ollama por tenant
- Isolamento maximo, custo maximo
- So faz sentido se tenants tem GPUs dedicadas

---

## 4. Customizacao de Modelo por Tenant

### 4.1 LoRA Adapters per User

**Conceito**: Modelo base grande (ex: Qwen 2.5-32B) compartilhado entre todos os
tenants. Cada tenant tem um pequeno LoRA adapter (~50-200MB) que personaliza o
comportamento do modelo para aquele usuario.

```
┌─────────────────────────────────────────┐
│          Modelo Base (32B)               │
│          Compartilhado na VRAM           │
│                                          │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │LoRA A│  │LoRA B│  │LoRA C│          │
│  │ 150MB│  │ 120MB│  │ 180MB│          │
│  │      │  │      │  │      │          │
│  │Tenant│  │Tenant│  │Tenant│          │
│  │  A   │  │  B   │  │  C   │          │
│  └──────┘  └──────┘  └──────┘          │
└─────────────────────────────────────────┘
```

### 4.2 vLLM com LoRA Hot-Swap

vLLM (v0.17+) suporta serving de multiplos LoRA adapters simultaneamente:

```bash
# Iniciar vLLM com suporte a multiplos LoRA
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-32B-Instruct \
    --enable-lora \
    --lora-modules \
        tenant_a=/models/lora/tenant_a \
        tenant_b=/models/lora/tenant_b \
        tenant_c=/models/lora/tenant_c \
    --max-lora-rank 64
```

```python
# Request com LoRA especifico do tenant
import openai
client = openai.OpenAI(base_url="http://localhost:8000/v1")

response = client.chat.completions.create(
    model="tenant_a",  # nome do LoRA adapter
    messages=[{"role": "user", "content": "..."}]
)
```

**Limitacoes vLLM LoRA**:
- Max ~50-100 LoRA adapters carregados simultaneamente
- Hot-swap tem latencia de ~100-500ms na primeira request
- Rank do LoRA afeta VRAM: rank 64 x 50 adapters = ~3-5GB extra
- Nem todos os modelos suportam LoRA via vLLM

### 4.3 Punica (Multi-LoRA Serving)

Punica e uma engine otimizada especificamente para multi-LoRA serving:
- Batching de requests com LoRA diferentes no mesmo batch
- Kernel CUDA customizado para multi-LoRA
- 1.7x throughput vs vLLM para cenarios multi-LoRA
- Projeto academico — menor comunidade e suporte

### 4.4 SGLang com LoRA

SGLang tambem suporta multi-LoRA com RadixAttention:
- Cache de prefix compartilhado entre tenants
- LoRA switching integrado ao scheduler
- Melhor para cenarios com system prompts compartilhados

### 4.5 ExLlamaV2 / TabbyAPI

Para GPUs consumer (RTX 4090 com 24GB VRAM):
- ExLlamaV2 tem o melhor suporte de LoRA hot-swap em consumer hardware
- TabbyAPI e um wrapper OpenAI-compatible para ExLlamaV2
- EXL2 quantizacao + LoRA = eficiente em VRAM
- Ideal para setup single-GPU do Segundo Cerebro

### 4.6 Quando Fine-Tunar por Tenant

| Cenario | Abordagem |
|---------|-----------|
| Estilo de escrita personalizado | LoRA fine-tune com textos do usuario |
| Jargao/vocabulario especifico | LoRA fine-tune com documentos do dominio |
| Preferencias de resposta | Melhor resolver com system prompts |
| Conhecimento especifico | RAG (nao fine-tuning) |
| Tom/personalidade | LoRA leve (rank 8-16) |

**ATENCAO**: Fine-tuning com dados de terceiros = risco de privacidade
(ver doc 07-privacy-guardrails.md). Usar somente dados proprios do tenant.

---

## 5. Billing e Routing por Tenant com LiteLLM

### 5.1 LiteLLM Proxy como Gateway

LiteLLM Proxy funciona como gateway centralizado para todas as chamadas LLM,
com suporte nativo a multi-tenant billing e routing.

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Tenant A │  │ Tenant B │  │ Tenant C │
└────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
            ┌───────▼───────┐
            │  LiteLLM      │
            │  Proxy         │
            │                │
            │ - Auth por key │
            │ - Rate limits  │
            │ - Billing      │
            │ - Routing      │
            │ - Fallbacks    │
            └───────┬───────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
   ┌────▼───┐ ┌────▼───┐ ┌────▼───┐
   │ Ollama │ │ Claude │ │ OpenAI │
   │ (local)│ │  API   │ │  API   │
   └────────┘ └────────┘ └────────┘
```

### 5.2 Configuracao Multi-Tenant

```yaml
# litellm_config.yaml
model_list:
  - model_name: gpt-local
    litellm_params:
      model: ollama/qwen2.5:32b
      api_base: http://ollama:11434

  - model_name: gpt-cloud
    litellm_params:
      model: claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  database_url: postgresql://...
  master_key: sk-master-key

  # Budgets por tenant
  enable_budget_tracking: true
```

### 5.3 Features de Multi-Tenancy no LiteLLM

| Feature | Descricao |
|---------|-----------|
| **Virtual Keys** | API key por tenant com budget e rate limits |
| **Teams** | Agrupar tenants em organizacoes |
| **Budget Limits** | Limite de gasto mensal por key/team ($) |
| **Rate Limits** | RPM e TPM por key/team |
| **Model Access** | Restringir quais modelos cada tenant pode usar |
| **Spend Tracking** | Log detalhado de custo por request/tenant |
| **Alertas** | Webhook quando tenant atinge X% do budget |
| **Tagging** | Metadata customizado por request para analytics |

### 5.4 Routing Inteligente por Tenant

```python
# Regras de routing por tenant
routing_rules = {
    "tenant_free": {
        "allowed_models": ["ollama/qwen2.5:7b"],
        "max_rpm": 10,
        "max_budget_monthly": 0,  # somente modelos locais
    },
    "tenant_pro": {
        "allowed_models": ["ollama/qwen2.5:32b", "claude-sonnet-4-20250514"],
        "max_rpm": 60,
        "max_budget_monthly": 50.00,
    },
    "tenant_enterprise": {
        "allowed_models": ["*"],  # todos os modelos
        "max_rpm": 300,
        "max_budget_monthly": 500.00,
        "custom_lora": True,
    },
}
```

---

## 6. Isolamento de Dados e Privacidade

### 6.1 Camadas de Isolamento

```
┌─────────────────────────────────────────────────┐
│  Camada 1: AUTENTICACAO                          │
│  JWT com tenant_id no claim                      │
│  Validado em CADA request                        │
├─────────────────────────────────────────────────┤
│  Camada 2: ROUTING                               │
│  Middleware seta schema/database por tenant       │
│  Connection pool por tenant (ou schema switch)    │
├─────────────────────────────────────────────────┤
│  Camada 3: BANCO DE DADOS                        │
│  RLS policies OU schema isolation                 │
│  pgvector indexes por schema                     │
├─────────────────────────────────────────────────┤
│  Camada 4: STORAGE                               │
│  Filesystem: /data/{tenant_id}/                   │
│  Ou S3 buckets/prefixes por tenant               │
├─────────────────────────────────────────────────┤
│  Camada 5: AI/LLM                                │
│  Contexto isolado por request                    │
│  LoRA adapters separados                         │
│  Memoria (embeddings) no schema do tenant        │
├─────────────────────────────────────────────────┤
│  Camada 6: OBSERVABILIDADE                       │
│  Logs taggeados com tenant_id                    │
│  Metricas segregadas                             │
│  Traces por tenant no Langfuse                   │
└─────────────────────────────────────────────────┘
```

### 6.2 Principios de Privacidade Multi-Tenant

1. **Zero cross-contamination**: Embeddings de Tenant A NUNCA aparecem em buscas de Tenant B
2. **Tenant-scoped search**: Queries vetoriais sempre filtradas por tenant (`WHERE tenant_id = X`)
3. **Contexto limpo**: LLM nao carrega historico de outro tenant entre requests
4. **Deletabilidade**: `DROP SCHEMA tenant_x CASCADE` remove TUDO do tenant
5. **Auditoria**: Log de todo acesso a dados com tenant_id + user_id + timestamp
6. **Encryption per tenant**: Opcional — chaves de criptografia diferentes por tenant

### 6.3 Riscos Especificos de AI Multi-Tenant

| Risco | Descricao | Mitigacao |
|-------|-----------|-----------|
| **Embedding leakage** | Busca vetorial retorna docs de outro tenant | Filter por tenant_id ANTES da busca ANN |
| **Context bleed** | Modelo "lembra" conversa anterior de outro tenant | Contexto limpo por request; sem session sharing |
| **LoRA poisoning** | Fine-tune de um tenant contamina modelo base | LoRA sao adapters separados; base e read-only |
| **Prompt injection cross-tenant** | Input malicioso tenta acessar dados de outro | Sanitizacao + schema isolation |
| **Log leakage** | Logs de um tenant visiveis para outro | Tenant tag obrigatorio em todo log |
| **Backup leakage** | Backup de um tenant contem dados de outro | Backups por schema (nao por banco inteiro) |

---

## 7. Projetos e Ferramentas Open-Source

### 7.1 Infraestrutura Multi-Tenant

| Projeto | O que faz | Relevancia |
|---------|-----------|-----------|
| **Neon** | PostgreSQL serverless com branching | Database-per-tenant sem ops overhead |
| **Supabase** | BaaS com RLS + Auth + Storage | Multi-tenant ready out-of-the-box |
| **Citus** (Microsoft) | PostgreSQL distribuido com sharding nativo | Multi-tenant em escala (milhares de tenants) |
| **PgBouncer** | Connection pooler para PostgreSQL | Essencial para muitos schemas/databases |
| **django-tenants** | Multi-tenant para Django (schema-per-tenant) | Referencia de arquitetura mesmo fora de Django |

### 7.2 AI/LLM Multi-Tenant

| Projeto | O que faz | Relevancia |
|---------|-----------|-----------|
| **LiteLLM** | Proxy LLM com billing/routing multi-tenant | Gateway centralizado para todas as chamadas |
| **vLLM** | Serving com multi-LoRA simultaneous | Modelos customizados por tenant |
| **Langfuse** | Observabilidade LLM com tenant tagging | Traces e custos por tenant |
| **Dify** | Plataforma AI com workspaces multi-tenant | Referencia de como fazer multi-tenant AI |
| **OpenWebUI** | Interface chat com multi-user | Frontend multi-tenant para LLMs |
| **Anything LLM** | RAG platform com workspaces isolados | Cada workspace = tenant com docs separados |

### 7.3 Fine-Tuning e Customizacao

| Projeto | O que faz | Relevancia |
|---------|-----------|-----------|
| **Unsloth** | Fine-tuning 2-5x mais rapido | LoRA training por tenant |
| **Axolotl** | Framework de fine-tuning configuravel | Pipeline de fine-tuning automatizado |
| **PEFT** (HuggingFace) | LoRA, QLoRA, adapters | Biblioteca base para todos os LoRA |
| **Punica** | Multi-LoRA serving otimizado | Batching eficiente multi-tenant |
| **LoRAX** (Predibase) | LoRA exchange — serving multi-adapter | Alternativa open-source ao Punica |

### 7.4 Orquestracao e Deploy

| Projeto | O que faz | Relevancia |
|---------|-----------|-----------|
| **Coolify** | Self-hosted PaaS (alternativa Heroku) | Deploy de containers por tenant |
| **Dokku** | Mini-Heroku self-hosted | Apps isolados por tenant |
| **Portainer** | UI para gerenciar Docker containers | Visibilidade de containers por tenant |
| **Traefik** | Reverse proxy com routing dinamico | Subdomain por tenant (a.app.com, b.app.com) |

---

## 8. Recomendacoes por Tier

### Tier 1: Obrigatorio (Dia 1)

| # | Recomendacao | Justificativa |
|---|-------------|---------------|
| 1 | **Schema-per-tenant no PostgreSQL local** | Melhor equilibrio custo/isolamento para comecar |
| 2 | **tenant_id em TODA tabela + middleware** | Defesa em profundidade mesmo com schemas |
| 3 | **JWT com tenant_id claim** | Autenticacao e isolamento em cada request |
| 4 | **LiteLLM Proxy como gateway** | Billing, rate limiting, routing centralizado |
| 5 | **Filesystem isolado por tenant** | `/data/{tenant_id}/` com permissoes Unix |
| 6 | **Contexto LLM limpo por request** | Sem carryover entre tenants |

### Tier 2: Fortemente Recomendado (Mes 1-2)

| # | Recomendacao | Justificativa |
|---|-------------|---------------|
| 7 | **Langfuse com tenant tagging** | Observabilidade de custo/uso por tenant |
| 8 | **PgBouncer para connection pooling** | Performance com muitos schemas |
| 9 | **Backup automatizado por schema** | Compliance e disaster recovery individual |
| 10 | **Migration runner multi-schema** | Alembic script que aplica migrations em todos os schemas |
| 11 | **Rate limiting por tenant** | Protecao contra noisy neighbor |
| 12 | **Traefik com subdomain routing** | `tenant-a.cerebro.app`, `tenant-b.cerebro.app` |

### Tier 3: Nice-to-Have (Mes 3+)

| # | Recomendacao | Justificativa |
|---|-------------|---------------|
| 13 | **LoRA per-tenant via vLLM/ExLlamaV2** | Personalizacao profunda do modelo |
| 14 | **Neon branching para tenants cloud** | Scale-to-zero para tenants inativos |
| 15 | **Per-tenant encryption keys** | Isolamento criptografico adicional |
| 16 | **Self-service onboarding** | API que cria schema + config + keys automaticamente |
| 17 | **Tenant admin dashboard** | Uso, custos, storage por tenant |
| 18 | **CrewAI configs YAML por tenant** | Cada tenant customiza seus agentes |

---

## 9. Arquitetura Recomendada

```
┌───────────────────────────────────────────────────────────────┐
│                      SERVIDOR FISICO                           │
│                                                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │  Traefik    │  │  FastAPI    │  │  LiteLLM    │          │
│  │  (routing)  │──│  (API)      │──│  Proxy      │          │
│  │             │  │  + tenant   │  │  (billing)  │          │
│  │  *.cerebro  │  │  middleware │  │             │          │
│  └─────────────┘  └──────┬──────┘  └──────┬──────┘          │
│                          │                 │                  │
│  ┌───────────────────────┼─────────────────┼──────────────┐  │
│  │    PostgreSQL + pgvector                │              │  │
│  │                                         │              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐│              │  │
│  │  │ schema   │ │ schema   │ │ schema   ││              │  │
│  │  │ tenant_a │ │ tenant_b │ │ tenant_c ││              │  │
│  │  │          │ │          │ │          ││              │  │
│  │  │ docs     │ │ docs     │ │ docs     ││              │  │
│  │  │ memories │ │ memories │ │ memories ││              │  │
│  │  │ vectors  │ │ vectors  │ │ vectors  ││              │  │
│  │  └──────────┘ └──────────┘ └──────────┘│              │  │
│  └────────────────────────────────────────┘              │  │
│                                                           │  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │ Ollama/  │  │ Celery   │  │ Redis    │               │  │
│  │ vLLM     │  │ Workers  │  │ (filas)  │               │  │
│  │ (GPU)    │  │ (agentes)│  │          │               │  │
│  │          │  │          │  │ filas por│               │  │
│  │ LoRA per │  │ tenant-  │  │ tenant   │               │  │
│  │ tenant   │  │ aware    │  │          │               │  │
│  └──────────┘  └──────────┘  └──────────┘               │  │
│                                                           │  │
│  ┌──────────────────────────────────────┐                │  │
│  │         /data/                        │                │  │
│  │         ├── tenant_a/                 │                │  │
│  │         │   ├── raw/                  │                │  │
│  │         │   ├── processed/            │                │  │
│  │         │   └── models/lora/          │                │  │
│  │         ├── tenant_b/                 │                │  │
│  │         └── tenant_c/                 │                │  │
│  └──────────────────────────────────────┘                │  │
└───────────────────────────────────────────────────────────┘
```

---

## 10. Plano de Migracao (Single → Multi-Tenant)

### Fase 1: Preparacao (sem quebrar nada)

1. Adicionar `tenant_id` em todas as tabelas existentes (default = ID do Cris)
2. Criar middleware de tenant no FastAPI
3. Mover dados existentes para `schema_cris`
4. Instalar LiteLLM Proxy entre app e Ollama/APIs

### Fase 2: Isolamento

5. Implementar schema creation automatico para novos tenants
6. Migration runner multi-schema
7. Filesystem per-tenant (`/data/{tenant_id}/`)
8. Celery queue tagging por tenant

### Fase 3: Onboarding

9. API de self-service: `POST /tenants` → cria schema + keys + dirs
10. Traefik routing por subdomain
11. Dashboard admin com metricas por tenant
12. Billing via LiteLLM spend tracking

### Fase 4: Customizacao (opcional)

13. Pipeline de fine-tuning LoRA por tenant (Unsloth + vLLM)
14. CrewAI configs YAML editaveis por tenant
15. Neon branching para tenants cloud-only

---

## Proximos Passos (decisao do Cris)

1. **Quantos tenants iniciais?** (5? 50? 500?) — define a abordagem
2. **Schema-per-tenant ou RLS?** (recomendacao: schema para < 500)
3. **Self-hosted only ou hibrido com Neon/Supabase?**
4. **Billing: gratuito, freemium, ou pago desde o dia 1?**
5. **LoRA per-tenant e prioridade ou pode esperar?**
6. **Comecar a migrar o Segundo Cerebro atual ou criar branch separado?**
