# 01 — Claw Code: Validacao e Alternativas

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: usar Claw Code, alternativa, ou construir do zero?

---

## O Leak do Claude Code (VERIFICADO)

- **Data**: 31 de marco de 2026
- **O que aconteceu**: Versao 2.1.88 do `@anthropic-ai/claude-code` publicada no npm com source map de 59.8MB
- **Escala**: ~512.000 linhas de TypeScript em ~1.900 arquivos
- **Causa**: Bun (runtime que Anthropic adquiriu em 2025) gera source maps por default. `.npmignore` nao excluiu `.map`
- **Descoberta**: Pesquisador Chaofan Shou publicou no X (28.8M+ views)
- **Resposta da Anthropic**: "Erro de empacotamento, nao breach de seguranca"
- **Incidente paralelo**: Entre 00:21 e 03:29 UTC, ataque supply chain com versoes trojanizadas do `axios`

### Fontes
- VentureBeat, The Register, The Hacker News, InfoQ, Zscaler ThreatLabz, Yahoo Finance, Layer5

---

## Claw Code: Status Atual (VERIFICADO — REAL)

| Campo | Valor |
|-------|-------|
| **Repositorio** | `ultraworkers/claw-code` (originalmente `instructkr/claw-code`) |
| **Stars** | **180.902** (10 abril 2026) |
| **Forks** | 107.012 |
| **Linguagem** | Rust ~95.6% + Python ~3.4% |
| **Criado** | 31 marco 2026 |
| **Ultimo push** | 10 abril 2026 (HOJE) |
| **Issues abertas** | 1.413 |
| **Licenca** | **NENHUMA** (risco legal significativo) |

### Sobre o criador: Sigrid Jin
- **Pessoa real verificada**: GitHub `sigridjineth`
- Seoul, Coreia do Sul / Kelowna, Vancouver, BC, Canada
- UBC, Sionic AI
- Perfilado pelo Wall Street Journal como power user de Claude Code (25B+ tokens consumidos)

### Arquitetura

**`/src/` (Python)**: Orquestracao de agentes, CLI, tools, memoria, plugins, voice
**`/rust/` (Rust)**: Runtime de performance com Cargo workspace

### Features Verificadas

| Feature | Status | Descricao |
|---------|--------|-----------|
| **autoDream** | VERIFICADO | Consolidacao de memoria em background (orient → gather → consolidate → prune) |
| **Memoria em 3 camadas** | VERIFICADO | CLAUDE.md (instrucoes) + Auto Memory (notas por sessao) + Session Memory + Auto Dream |
| **Subagent spawning** | VERIFICADO | 3 modelos: fork, teammate, worktree |
| **Multi-provider** | VERIFICADO | Claude, OpenAI, Ollama. Commits de HOJE tratam `OPENAI_BASE_URL` routing |

### Riscos

- **SEM LICENCA** → ambiguidade legal. Usar em producao e arriscado.
- **NAO estavel** → port para Rust nao esta completo
- **NAO tem paridade** com Claude Code
- **Clean-room rewrite** → legalmente independente, mas sem licenca explicita

---

## Alternativas Verificadas

| Projeto | Stars | Linguagem | Ollama | Notas |
|---------|-------|-----------|--------|-------|
| **OpenClaw** | 354.275 | TypeScript | Sim (200+ providers) | MIT. Multi-skill. Renomeado de Moltbot/Clawdbot |
| **OpenCode** | Verificado | Go (Bubble Tea TUI) | Sim, first-class | Terminal agent. 75+ LLM providers |
| **Aider** | Alto | Python | Sim (OpenAI-compat) | Terminal-first, Git-centric. Forte local model support |
| **OpenHands** | Alto | Python | Sim | Full-capability dev agent. Ex-OpenDevin |
| **Goose** | Alto | Rust/Python | Sim | Autonomo, plugin extensivel. By Block (Square) |
| **Cline** | Alto | TypeScript | Sim (via extension) | VS Code extension. Safety controls |

---

## Relevancia para o Amazo

O autoDream e a memoria em 3 camadas sao os blueprints mais relevantes:
- **autoDream** = exatamente o que o Amazo fara: consolidar memoria em background 24h
- **Memoria em camadas** = como decidir o que manter ativo, comprimir, ou arquivar
- **Subagent spawning** = agente principal delega sem corromper seu contexto
- **Multi-provider** = trocar entre Claude API e modelo local sem mudar o harness

### Recomendacao
Usar Claw Code como **referencia de arquitetura** (estudar o codigo), mas NAO como dependencia de producao (sem licenca, instavel). Construir o harness do Amazo inspirado nos patterns, usando um framework maduro como base.

---

## Proximos Passos (decisao do Cris)

1. **Estudar o Claw Code** como referencia? (sim/nao)
2. **Qual framework usar como base?** (LangGraph / CrewAI / custom — ver `02-agent-frameworks.md`)
3. **Clonar e testar o Claw Code** no notebook atual? (risco: sem licenca)
