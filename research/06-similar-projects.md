# 06 — Projetos Similares no GitHub

> Status: PESQUISA COMPLETA · Abril 2026
> Nenhum projeto faz tudo. O Segundo Cerebro precisa combinar building blocks.

---

## Conclusao Principal

**Nenhum projeto existente combina todos os elementos**:
1. Life logging (so Screenpipe)
2. Agregacao multi-fonte (so Onyx tem 40+ connectors)
3. Memoria persistente com consolidacao (so Mem0 / Google Always-On Memory)
4. Agentes autonomos em background (so Khoj e Screenpipe)
5. Local-first com privacidade (muitos suportam)
6. Knowledge graph temporal (so Graphiti/Zep)
7. Self-improvement com feedback (so PAI)

---

## CATEGORIA 1: Knowledge Management com AI

### Khoj ★34K — MAIS RELEVANTE
- **GitHub**: `khoj-ai/khoj` | **Licenca**: AGPL-3.0
- Self-hostable AI second brain. Indexa PDFs, Markdown, Notion, Word, Org-mode, GitHub repos
- Semantic search + RAG chat. Custom agents, automacoes agendadas, deep research
- **Stack**: Python, PostgreSQL + pgvector, FastAPI
- **Ollama**: SIM — full support para operacao offline
- **Forca**: Mais proximo de um "AI second brain" que ja existe. Automacoes em background
- **Fraqueza**: Sem life logging. Sem consolidacao de memoria. Focado em documentos

### Reor ★8.5K
- Desktop note-taking com auto-linking via embeddings
- Electron + Transformers.js + LanceDB + Llama.cpp
- **Desenvolvimento aparenta ter desacelerado** (ultimo commit maio 2025)

### SiYuan ★42.5K
- PKM open-source maturo. Block-level references. Sync via S3/WebDAV
- AI nao e o foco principal. Precisaria de camada AI externa

### Obsidian + Smart Connections ★4.8K
- Plugin que cria embeddings locais. "Related Notes" automatico
- Preso ao ecossistema Obsidian

---

## CATEGORIA 2: Life Logging / Digital Twin

### Screenpipe ★18.1K — MAIS RELEVANTE
- **GitHub**: `screenpipe/screenpipe` | **Licenca**: MIT
- Captura continua de tela (OCR) e audio (Whisper local)
- "Pipes" = agentes AI que atuam sobre seus dados capturados
- **Stack**: Rust. SQLite local. REST API
- **Ollama**: SIM — tudo local
- **Forca**: MAIS PROXIMO de um "digital twin". Records everything. Agent system
- **Fraqueza**: Resource intensive. Sem agregacao de email/chat/arquivos fora da tela

### Limitless (ex-Rewind.ai) — MORTO
- **Adquirido pela Meta em dezembro 2025**. Pendant descontinuado. App Mac encerrado
- **Licao**: Abordagem proprietaria/cloud falhou pros usuarios. Open-source local-first e o caminho

### Windrecorder
- Open source, grava tela, query por OCR. Windows Recall open source
- Totalmente local

---

## CATEGORIA 3: Assistentes AI Locais

### OpenClaw ★354K (!!)
- **GitHub**: `openclaw/openclaw` | **Licenca**: MIT
- AI pessoal que responde em 20+ canais (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams, Matrix)
- 100+ skills/plugins. BYOK model routing
- **Forca**: Multi-canal massivo. Skills extensiveis. Memoria persistente
- **Fraqueza**: Chatbot/assistente, nao "subconsciente". Nao processa autonomamente em background

### AnythingLLM ★58K
- All-in-one: document chat, RAG, agents, workflows
- Zero-config. Multi-user RBAC. No-code agent builder
- **Forca**: UX mais polida. 2GB RAM
- **Fraqueza**: Document chat focused. Sem background processing. Sem life logging

### PrivateGPT ★57.2K
- Interaja com documentos 100% privadamente. RAG via LlamaIndex
- **Desenvolvimento desacelerou** comparado com 2024

### LocalGPT ★22.2K
- Chat com documentos local. Simples, tutorial que cresceu

---

## CATEGORIA 4: Memoria Aumentada — CRITICO PARA O AMAZO

### Mem0 ★52.6K — MAIS RELEVANTE
- **GitHub**: `mem0ai/mem0` | **Licenca**: Apache-2.0
- Camada de memoria universal para agentes AI
- Dual-store: vector DB (semantic search) + knowledge graph (relacoes)
- 26% mais preciso que memoria built-in da OpenAI. 91% menor latencia
- **Forca**: LIDER em memoria para AI. Vector + graph. Muito ativo
- **Fraqueza**: E uma biblioteca, nao um app completo. Focado em conversa, nao life data

### Graphiti ★24.7K — TEMPORAL
- **GitHub**: `getzep/graphiti` | **Licenca**: Apache-2.0
- Knowledge graph TEMPORAL — entidades, relacoes e fatos tem timestamps
- **Forca**: EXATAMENTE o que um "subconsciente" precisa — conhecimento muda ao longo do tempo
- **Fraqueza**: Building block. Requer Neo4j. Complexo

### Zep ★4.4K
- Context engineering + agent memory. Graphiti como engine
- TIME como dimensao first-class

### Google Always-On Memory Agent — REFERENCIA DE ARQUITETURA
- **GitHub**: `GoogleCloudPlatform/generative-ai/.../always-on-memory-agent`
- Agente que roda continuamente, ingere informacao, consolida memoria a cada 30 min
- **SEM vector database** — memoria estruturada via LLM em SQLite
- 3 tabelas: memories, consolidations, connections
- **Forca**: MELHOR referencia para consolidacao de memoria. 5MB por 1000 sessoes vs 150MB com vector DB
- **Fraqueza**: Referencia apenas. Tied a Gemini

### Letta (ex-MemGPT)
- Runtime de agente com virtual context management estilo OS
- Memoria em tiers hierarquicos (ativa, comprimida, arquivada)

---

## CATEGORIA 5: Plataformas Completas

### Daniel Miessler's PAI ★11.2K
- **GitHub**: `danielmiessler/Personal_AI_Infrastructure` | **Licenca**: MIT
- Memoria persistente, skills customizados, contexto pessoal (goals, contatos, preferencias), routing inteligente
- **Forca**: MAIS FILOSOFICAMENTE ALINHADO com "AI subconsciente". Self-improvement explicito
- **Fraqueza**: Acoplado ao Claude Code. Framework/metodologia, nao sistema deployavel

### Onyx (ex-Danswer) ★26.4K
- 40+ connectors (Slack, Google Drive, GitHub, Salesforce, Confluence, email)
- Hybrid search (embeddings + BM25 + reranking + knowledge graphs)
- **Forca**: MELHOR ecossistema de connectors — critico para agregar vida digital
- **Fraqueza**: Enterprise-focused. Sem agentes autonomos. Sem life logging

### Quivr ★39.1K — DESACELERANDO
- RAG framework. Ultimo update julho 2025. Pode estar entrando em maintenance mode

### Simon Willison's LLM ★11.6K
- CLI tool para qualquer LLM. Toda interacao logada em SQLite local. Plugin system
- **Filosofia**: "tools that work together" — composable, simples, extensivel

---

## Building Blocks Recomendados (ranked por relevancia)

| # | Componente | Melhor Projeto | Papel no Amazo |
|---|-----------|----------------|----------------|
| 1 | Memoria + consolidacao | **Mem0** + patterns do **Google Always-On Memory** | Core do subconsciente |
| 2 | Life logging | **Screenpipe** | Captura de tudo que acontece na tela/audio |
| 3 | Knowledge base + RAG | **Khoj** | Busca semantica sobre todos os dados |
| 4 | Connectors de dados | **Onyx** | Agregar email, Slack, Drive, GitHub |
| 5 | Knowledge graph temporal | **Graphiti** | Relacoes que mudam no tempo |
| 6 | Contexto pessoal + routing | **PAI** | Goals, preferencias, self-improvement |
| 7 | Composabilidade CLI | **Simon Willison's LLM** | Log tudo, plugin tudo |

---

## Licoes Arquiteturais

1. **Mem0 dual-store** (vector + graph) e o padrao emergente para memoria AI
2. **Google consolidation pattern** (background scheduled → summarize → connect) e a peca que falta na maioria dos projetos
3. **Screenpipe "pipes"** (agentes AI triggered por atividade real) e o mais proximo de processamento autonomo
4. **Graphiti temporal dimension** (fatos com timestamps que podem ser superados) e essencial
5. **PAI self-improvement loop** (AI aprende com feedback para ajudar VOCE especificamente) e o que torna "pessoal" vs apenas "privado"

---

## Proximos Passos (decisao do Cris)

1. Quais building blocks incorporar? (Mem0? Graphiti? Screenpipe?)
2. Construir em cima do Khoj ou from scratch?
3. Screenpipe como captura-tudo ou fontes individuais?
