# CÉREBRO — Personal AI Brain (Voice-First Council System)

> Projeto: destino único voice-first que escuta o Cris, lembra de tudo, sabe onde/quando está,
> e roteia cada pedido para a inteligência certa (direta, agente, ou conselho de 5 IAs).
> Autor: Cris Tony · Ottawa, ON · Julho 2026
> Status: EM CONSTRUÇÃO — M1 (Fundação) iniciado em 2026-07-11.

---

## FONTE CANÔNICA

**`CEREBRO_DIRECTIVE.md` é a diretiva vigente (v1.0).** Toda decisão de arquitetura, escopo,
segurança e ordem de build vem dela. Leia ela antes de qualquer trabalho neste repo.

A fase de pesquisa anterior (docs em `/research/`, `segundo-cerebro-visao.docx`,
`amazo-pesquisa.docx`) está **SUPERSEDED como direção** — serve só como referência histórica.
Em conflito, a diretiva vence. Em particular:

- **Amazo (modelo local, fine-tune, servidor físico 24/7) está FORA deste projeto.** É projeto
  futuro. O schema (`training_pairs`) já nasce preparado para alimentá-lo depois.
- Nada de CrewAI, n8n, Ollama, ComfyUI etc. aqui — Fase 1 é cloud: Next.js + Vercel + Supabase
  + Anthropic API + OpenRouter.

## Quem é o Cris (contexto para qualquer IA que leia isso)

Cris NÃO é engenheiro de software. É um construtor — carpinteiro e supervisor de framing
na construção civil canadense, cursando Interactive Media Design no Algonquin College.
Ele é um "vibe coder": traduz visão em código através de IA.

**Como trabalhar com o Cris**:
- Ele escreve prompts human-like, em linguagem natural. A IA interpreta tecnicamente.
- Decisões técnicas são DELEGADAS para a IA. Cris decide direção, filosofia e prioridades.
- Cris implementa e testa. A IA projeta e explica.
- Explicações em linguagem de construção quando possível (fundação, estrutura, carga, canteiro).
- Responder no idioma que o Cris usou (PT-BR ou EN).

## Estrutura do repo

| Caminho | O que é |
|---|---|
| `CEREBRO_DIRECTIVE.md` | **Diretiva canônica v1.0** — missão, arquitetura, milestones M1–M11 |
| `app/` | O Cloud Brain — Next.js 15 (App Router), deploy na Vercel, PWA |
| `supabase/migrations/` | Migrations do projeto Supabase dedicado `cerebro` |
| `research/` | Pesquisa histórica (superseded como direção; referência apenas) |

## Banco de dados — exceção consciente à regra do ecossistema

O Cérebro usa um projeto Supabase dedicado `cerebro` em uma **conta Supabase PESSOAL do
Cris** — fora da org `onsite_inc`, sem NENHUMA relação com o `onsite-core` da empresa.
Decisão do Cris (2026-07-13), alinhada com a diretiva §3.1: este projeto é do `lab/`
(pessoal), não faz parte da holding, e a topologia onsite/yoinkr/invoicepass fica intocada.
Migrations vivem AQUI, em `supabase/migrations/` — não em `onsite-core-db`.

## Regras vivas (resumo da diretiva — ela detalha tudo)

1. **Claude é o principal.** Escuta tudo primeiro; roteia: direct | tool | council.
2. **Memória é a fundação.** Editável, legível, com zonas `pessoal|negocios|criativo|familia`.
   Conselho (modelos terceiros) e exports NUNCA veem `pessoal`/`familia` sem liberação por sessão.
3. **Segurança estilo Aside:** credenciais nunca no contexto do modelo; aprovação humana na
   borda (pagamento, mensagem, post); audit log de tudo; kill switch (Protocolo Blackout).
4. **Cost-aware:** budget mensal (`MONTHLY_BUDGET_CAD`, default 50); 80% → aviso; 100% →
   conselho desativado.
5. **A IA nunca EXECUTA pagamento.** Prepara; Cris aprova (única exceção: §16.4, off by default).
6. **Build order M1→M11** (diretiva §13). Cada milestone deployável na Vercel antes do próximo.
   Gate do M1: Cris usa diariamente por uma semana e sente falta quando não usa.

## Estado atual

- **M1 — Fundação**: em construção. Escopo: schema Supabase + shell Next.js + chat TEXTO com
  Claude Principal + memória write/read com zonas + Memory Browser + botão export + contador
  de custo. Sem voz, sem conselho, sem polimento — deliberadamente feio.

## Custódia de Éon (módulo futuro — milestone a definir)

O Cérebro será o zelador do universo simulado Éon (`c:\Dev\lab\thomasz-kroll\eon`), projeto
pessoal do Cris. Quando esse módulo for construído — e TODA VEZ que qualquer agente do
Cérebro for tratar de Éon — a leitura obrigatória, nesta ordem, é:

1. `c:\Dev\lab\thomasz-kroll\eon\PROTOCOLO-PONTE.md` — a conexão de mão dupla (rituais de
   entrada/saída, o que o Cérebro pode e não pode tocar, histórico de deliberação)
2. `c:\Dev\lab\thomasz-kroll\eon\CONSTITUICAO.md` — o semáforo e as leis de custódia

Regras inegociáveis vindas de lá: toda deliberação lê o histórico (`custodia_log`) antes e
grava registro depois (append-only); o Cérebro nunca escreve no canon de Éon; o raciocínio
de custódia JAMAIS entra no corpus da Mente de Éon (a IA de dentro não pode saber que tem
zelador). O plano de implantação inteiro está em
`c:\Dev\lab\thomasz-kroll\eon\DIRETIVA-IMPLANTACAO.md` (a ponte é a Fase 4).
