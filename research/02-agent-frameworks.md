# 02 — Frameworks de Orquestracao de Agentes

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: qual framework usar para orquestrar o Amazo?

---

## Requisitos do Amazo

- Rodar agentes 24/7 em background
- Suportar multiplos providers (Claude API, OpenAI API, modelos locais via Ollama)
- Subagent spawning (agente principal delega tarefas)
- Gerenciamento de memoria (curta, longa, consolidacao)
- Rodar localmente em servidor dedicado
- Crash recovery (retomar apos falha)

---

## Comparacao Completa

### 1. LangGraph (LangChain)

| Campo | Detalhe |
|-------|---------|
| Stars | ~24K (LangGraph) / ~126K (ecossistema LangChain) |
| Linguagem | Python, TypeScript |
| Maturidade | ALTA — producao, financas, saude |

**Arquitetura**: Grafo de workflow. Agentes sao nos, transicoes sao arestas, estado flui por um `StateGraph` compilado.

**Ollama**: Suporte total via `ChatOllama` do `langchain-community`.

**Memoria**: MELHOR DA CLASSE. Checkpointing apos cada no. Backends: MemorySaver, PostgreSQL, Redis, SQLite, MongoDB. Memoria longa via MongoDB Store ou LangMem.

**Background**: LangGraph Platform para deploy gerenciado. Self-hosted como processo Python com checkpointing para crash recovery.

**Subagents**: Sim. Nos podem ser sub-grafos. Composicao hierarquica com branches paralelos.

**Pros**: Controle mais preciso; melhor checkpointing; time-travel debugging; enterprise-proven.
**Cons**: Curva de aprendizado mais ingreme; mental model de grafos.

---

### 2. CrewAI

| Campo | Detalhe |
|-------|---------|
| Stars | ~48.4K |
| Linguagem | Python |
| Maturidade | ALTA — 12M execucoes diarias |

**Arquitetura**: Duas camadas: **Crews** (agentes com roles, goals, backstories) + **Flows** (orquestracao event-driven). Config YAML.

**Ollama**: EXCELENTE. LiteLLM built-in. Sem mudanca de codigo para trocar provider.

**Memoria**: Short-term, long-term, entity memory built-in. Menos configuravel que LangGraph.

**Background**: Sem daemon mode built-in. Precisa de process manager (systemd, Docker).

**Subagents**: Sim. Modo hierarquico com manager + workers. Execucao sequencial, paralela, hierarquica.

**Pros**: Mais rapido para prototipar; intuitivo; melhor integracao Ollama; MCP e A2A nativos.
**Cons**: Menos controle fino que LangGraph; memoria menos sofisticada.

---

### 3. Microsoft Agent Framework (substitui AutoGen + Semantic Kernel)

| Campo | Detalhe |
|-------|---------|
| Stars | ~54K (repo AutoGen) |
| Versao | v1.0 (3 abril 2026 — acabou de sair) |
| Linguagem | Python e .NET (C#) |

**Ollama**: Sim. `OllamaChatClient` nativo com tool calling e streaming.

**Memoria**: Session-based state management. Middleware, telemetria.

**Background**: Event-driven async-first. Bom para long-running server processes.

**Subagents**: Sim. Sequencial, concorrente, handoff, group chat, Magentic-One.

**Pros**: Enterprise com Microsoft backing; .NET first-class; Azure integration; Magentic-One.
**Cons**: AutoGen migration nao-trivial; .NET-first; abstractions mais pesadas.

**Nota**: Semantic Kernel agora em maintenance mode. Supersedido pelo MAF.

---

### 4. OpenAI Agents SDK

| Campo | Detalhe |
|-------|---------|
| Stars | ~21K |
| Linguagem | Python, JavaScript/TypeScript |

**Ollama**: Sim via LiteLLM ou API OpenAI-compatible do Ollama.

**Memoria**: FORTE. Sessions com backends: SQLite, SQLAlchemy (qualquer SQL), Dapr. Context management com trimming e compression.

**Subagents**: Sim. "Agents as tools" e "handoffs" como primitivas first-class.

**Pros**: Mais simples de aprender; minimo boilerplate; tracing excelente; multi-provider apesar do nome.
**Cons**: Branding OpenAI; sem graph-based workflows; sem deployment story.

---

### 5. Claude Agent SDK (Anthropic)

| Campo | Detalhe |
|-------|---------|
| Versao | v0.1.54+ (Python), v0.2.71+ (TypeScript) |
| Maturidade | Pre-1.0 mas funcional; powers Claude Code |

**Ollama**: Parcial. Ollama v0.14.0+ suporta Anthropic Messages API. Funciona para basico mas perde otimizacoes Claude-specific.

**Memoria**: Foco em within-session. Precisaria de Mem0 ou similar para long-term.

**Subagents**: Sim, first-class. Contexto isolado por subagente.

**Pros**: Mesmo runtime do Claude Code; MCP integration; Managed Agents para hosting.
**Cons**: Pre-1.0; Claude-centric; memoria cross-session limitada.

---

### 6. Haystack (deepset)

| Campo | Detalhe |
|-------|---------|
| Stars | ~21.5K |
| Linguagem | Python |

**Foco**: Pipeline-based. Melhor para RAG do que para agentes autonomos.

**Ollama**: Excelente. Components dedicados: `OllamaGenerator`, `OllamaChatGenerator`, `OllamaDocumentEmbedder`.

**Pros**: Melhor-da-classe para RAG; modular; boa documentacao.
**Cons**: Orquestracao de agentes e secundaria; sem checkpointing; sem multi-agent patterns robustos.

---

### 7. Outros Notaveis

| Framework | Stars | Linguagem | Destaque |
|-----------|-------|-----------|----------|
| **Google ADK** | ~15.6K | Python, Go | Model-agnostic via LiteLLM. Dev UI built-in |
| **Smolagents** (HuggingFace) | ~25K | Python | Ultra-minimo (~1000 linhas). Agentes escrevem Python |
| **Mastra** | ~22K | TypeScript | Lider TypeScript-native. Short/long-term memory |
| **Agent Zero** | — | Python | FOCO PESSOAL. Hybrid FAISS memory. Self-learning. Docker |
| **Letta** (ex-MemGPT) | — | Python | Memoria OS-style. Tiered memory hierarchy |
| **Mem0** | ~52.6K | Python | Camada de memoria universal. Vector + knowledge graph |

---

## Matriz de Recomendacao para o Amazo

| Requisito | Melhor Fit | Runner-Up |
|-----------|-----------|-----------|
| **24/7 Background** | LangGraph (checkpointing + crash recovery) | CrewAI Flows + systemd |
| **Multi-Provider** | CrewAI (LiteLLM built-in) | LangGraph / OpenAI Agents SDK |
| **Subagent Spawning** | LangGraph (composicao de grafos) | Claude Agent SDK |
| **Gerenciamento de Memoria** | LangGraph + Mem0 ou Letta | OpenAI Agents SDK (Sessions) |
| **Servidor Local** | Todos suportam | CrewAI e Agent Zero sao mais faceis |
| **Facilidade de Setup** | CrewAI | OpenAI Agents SDK |

---

## Recomendacoes

### Opcao A: LangGraph + Mem0 (MAIS CONTROLE)
Melhor checkpointing para 24/7. Crash recovery. Composicao de grafos poderosa. Pairing com Mem0 para memoria cross-session.

### Opcao B: CrewAI (MAIS RAPIDO)
Setup mais simples. LiteLLM built-in. Role-based metaphor natural. Precisa de Mem0 para memoria.

### Opcao C: Agent Zero (MAIS ALINHADO)
Projetado especificamente para "personal AI assistant". Hybrid FAISS memory. Self-learning. Docker. Comunidade menor.

### Opcao D: Construir do Zero (MAIS CONTROLE TOTAL)
Usar Claw Code + Google Always-On Memory Agent como referencia de arquitetura. Maximo controle, maximo esforco.

---

## Proximos Passos (decisao do Cris)

1. Qual opcao? (A / B / C / D / mix)
2. Testar CrewAI + Ollama no notebook como POC?
3. Avaliar Mem0 como camada de memoria independente?
