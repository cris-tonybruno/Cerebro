# 08 — Pipeline de Conhecimento: Raw Data → Blocos → Conexoes → Training → Pesos → Referencia

> Status: PESQUISA COMPLETA · Abril 2026
> Escopo: O pipeline intelectual completo do Segundo Cerebro — como dados brutos viram conhecimento internalizado no Amazo.

---

## Visao Geral do Pipeline

```
RAW DATA                 BLOCKS              CONNECTED KNOWLEDGE         TRAINING PAIRS
(email, chat,    -->  (blocos atomicos   -->  (grafo de conhecimento,  -->  (instruction/response,
 voz, arquivos,       com metadados,         embeddings, entidades,       preference pairs,
 screenshots)         tags, scores)          padroes temporais)           style capture)
                                                                               |
                                                                               v
                  REFERENCED KNOWLEDGE  <--  MODEL WEIGHTS               TRAINING PAIRS
                  (hybrid RAG + pesos,       (QLoRA fine-tuned,     <--  (curados, formatados,
                   citacao, confianca,        continual learning,         avaliados)
                   feedback loop)            SDFT anti-forgetting)
```

---

## ESTAGIO 1: Raw Data → Blocos (Informacao Estruturada)

### 1.1 Estrategias de Chunking

O chunking e a conversao de dados brutos em unidades atomicas de conhecimento ("blocos"). A escolha da estrategia impacta diretamente a qualidade de tudo que vem depois.

#### Estrategias Principais

| Estrategia | Como funciona | Melhor para | Limitacao |
|-----------|--------------|-------------|-----------|
| **Fixed-size** | Divide por N caracteres/tokens com overlap | Baseline simples | Corta no meio de ideias |
| **Recursive splitting** | Tenta separadores em ordem: `\n\n` → `\n` → ` ` → `""` | Texto geral | Nao entende semantica |
| **Semantic chunking** | Agrupa por similaridade de embedding entre sentencas | Conteudo complexo | Computacionalmente caro |
| **By title/section** | Respeita limites de secao do documento | Docs estruturados | Depende de formatacao |
| **Agentic chunking** | LLM decide os limites | Maximo qualidade | Lento, caro |

#### Descobertas Importantes da Pesquisa

**NAACL 2025**: Um paper descobriu que chunks fixos de 200 palavras igualaram ou superaram semantic chunking em tarefas padrao de RAG — o overhead computacional nem sempre se justifica.

**CONTRA-PONTO**: Um estudo clinico (MDPI Bioengineering, Nov 2025) mostrou que adaptive chunking alinhado a limites de topico alcancou **87% de acuracia vs 13% para fixed-size** em decisao clinica. A diferenca depende do dominio.

**Recomendacao para o Segundo Cerebro**: Comeca com **recursive splitting** (LangChain `RecursiveCharacterTextSplitter`) como baseline. Adicionar **by_title** (unstructured.io) para documentos com estrutura clara. Semantic chunking reservado para conteudo de alto valor quando a qualidade importa mais que velocidade.

#### Ferramentas

| Ferramenta | Destaque |
|-----------|----------|
| **LangChain** | `RecursiveCharacterTextSplitter`, `MarkdownTextSplitter`, `CodeTextSplitter` |
| **unstructured.io** | Particiona por tipo de elemento (titulo, paragrafo, lista). `by_title` preserva limites de secao |
| **LlamaIndex** | `SentenceSplitter`, `SemanticSplitterNodeParser` |
| **Firecrawl** | Chunking otimizado para conteudo web crawled |

#### Abordagem Karpathy: Bypass do Chunking

Andrei Karpathy (abril 2026) publicou uma arquitetura alternativa chamada "LLM Knowledge Base" que **rejeita chunking e vector databases** para datasets de medio porte:

1. **raw/**: Materiais brutos (papers, repos, artigos web) em Markdown
2. **wiki/**: LLM "compila" os dados — gera sumarios, artigos estilo enciclopedia, backlinks entre conceitos
3. **Manutencao ativa**: LLM executa "health checks" / "linting" periodico buscando inconsistencias

**Vantagem**: Cada claim pode ser rastreada a um arquivo .md legivel por humano. Reduz consumo de tokens em ate 95% vs loading ingenuos. **Desafio**: Requer LLM capaz e tempo de compilacao. Melhor para datasets de ~100s a low 1000s de documentos.

**Relevancia para o Amazo**: O pattern de "compilacao" pode ser usado como estagio intermediario — APIs (Claude/OpenAI) compilam a wiki, Amazo aprende com ela.

### 1.2 Extracao de Metadados

Cada bloco deve carregar metadados ricos para facilitar conexao e busca posterior.

#### Metadados Essenciais por Bloco

```json
{
  "block_id": "uuid",
  "content": "texto do bloco",
  "summary": "resumo de 1-2 sentencas",
  "source": {"type": "email|chat|note|voice|screenshot", "path": "/raw/...", "url": "..."},
  "timestamp": {"created": "ISO8601", "ingested": "ISO8601"},
  "entities": [
    {"name": "John Smith", "type": "person"},
    {"name": "Project Alpha", "type": "project"},
    {"name": "Ottawa", "type": "location"}
  ],
  "topics": ["construction", "budgeting", "crew-management"],
  "sentiment": "neutral|positive|negative",
  "language": "pt-BR|en",
  "importance_score": 0.82,
  "embedding": [0.023, -0.156, ...],
  "consolidated": false
}
```

#### Pipeline de Extracao

```
Bloco de texto
    |
    v
NER (Named Entity Recognition) ──> Entidades (pessoas, locais, orgs, datas)
    |
    v
Topic Modeling / LLM classification ──> Topicos
    |
    v
Sentiment Analysis ──> Sentimento
    |
    v
LLM summarization ──> Resumo
    |
    v
Embedding model (nomic-embed-text) ──> Vetor 768d
    |
    v
LLM importance scoring ──> Score de importancia (0-1)
```

**Modelos locais para extracao** (conforme 04-local-models.md):
- **NER + Entidades**: Qwen3-30B-A3B (3B ativos, ~5GB)
- **Embeddings**: nomic-embed-text v1.5 (<1GB, CPU)
- **Sumarizacao + Topics**: Qwen 2.5-32B ou Gemma 3 27B
- **Classificacao leve**: Phi-4 Mini (3.8B, ~3GB)

### 1.3 Quality Scoring

Nem todo bloco tem o mesmo valor. O sistema precisa separar sinal de ruido.

#### Criterios de Qualidade

| Criterio | O que mede | Como medir |
|---------|------------|-----------|
| **Unicidade** | Informacao nova vs redundante | Similaridade com blocos existentes (embedding distance) |
| **Especificidade** | Fatos concretos vs generalidades vagas | LLM scoring + entidade density |
| **Acionabilidade** | Contem algo util para decisoes futuras | LLM classification |
| **Riqueza de contexto** | Tem who/what/when/where/why | Metadata completeness score |
| **Relevancia pessoal** | Relacionado a projetos/interesses do Cris | Similarity com perfil pessoal |

#### Pattern do Google Always-On Memory Agent

O agente do Google atribui um **importance score (0-1)** a cada memoria durante ingestao, usando o LLM (Gemini Flash-Lite) para avaliar:
- Relevancia para os interesses do usuario
- Novidade da informacao
- Potencial para conexoes futuras

**Implementacao**: Pode ser replicado com Qwen3-30B-A3B (MoE, 3B ativos) como scorer rapido durante ingestao.

---

## ESTAGIO 2: Blocos → Conhecimento Conectado

### 2.1 Tipos de Conexao

| Tipo | Como detectar | Exemplo |
|------|--------------|---------|
| **Semantica** | Similaridade de embedding (cosine > threshold) | "Orcamento do projeto X" ↔ "Custos de material framing" |
| **Entidade** | Mesma entidade em blocos diferentes | Todos os blocos que mencionam "Project Alpha" |
| **Temporal** | Timestamps proximos | Eventos da mesma semana/mes |
| **Causal** | LLM identifica relacao causa-efeito | "Decisao de usar 2x6 → resultado: frame ficou torto" |
| **Tematica** | Mesmo topico/categoria | Todos os blocos sobre "budget management" |
| **Contradicao** | Informacoes conflitantes | "Budget: $50K" vs "Budget revisado: $75K" |

### 2.2 Embedding Similarity (Conexoes Semanticas)

**Como funciona**: Cada bloco tem um vetor de embedding. Blocos com alta similaridade de cosseno estao semanticamente proximos.

**Implementacao pratica**:
```
1. Gerar embedding para cada bloco (nomic-embed-text)
2. Armazenar em pgvector
3. Para cada novo bloco, encontrar top-K vizinhos mais proximos
4. Registrar conexoes acima do threshold (ex: cosine > 0.75)
```

**Estatisticas de embedding (2025)**:
- nomic-embed-text processa ~100 documentos/segundo em GPU consumer
- Vetores ocupam ~3KB por bloco (768 dimensoes * 4 bytes)
- Vetores tendem a se agrupar em regioes de similaridade semantica

**Nota tecnica**: Hybrid search (BM25 + embedding) reduz volume de queries em 90% e melhora recall vs embedding puro.

### 2.3 Knowledge Graph Construction

#### Abordagem LLM-Based (2025 state of art)

A construcao de knowledge graphs foi fundamentalmente transformada por LLMs — extracao de informacao agora e uma tarefa generativa.

**Pipeline de construcao**:
```
Bloco de texto
    |
    v
Entity Extractor (LLM) ──> Nodes: pessoas, locais, conceitos, projetos
    |
    v
Relation Generator (LLM) ──> Edges: "trabalha_em", "causa_de", "parte_de"
    |
    v
Knowledge Graph (Neo4j/Graphiti) ──> Grafo navegavel e queryable
```

**KGGEN (Mo et al., 2025)**: Decompoe extracao em duas invocacoes LLM sequenciais — primeiro entidades, depois relacoes — para reduzir carga cognitiva e propagacao de erros.

#### Microsoft GraphRAG: Deteccao de Padroes

GraphRAG aplica **community detection hierarquica** (algoritmo de Leiden) para encontrar clusters de entidades densamente conectadas:

1. Extrai knowledge graph dos documentos
2. Aplica clustering hierarquico para detectar "comunidades"
3. Gera sumarios para cada comunidade via LLM
4. Permite queries tematicas que abrangem todo o corpus

**Relevancia**: GraphRAG pode revelar padroes que ninguem pediu — "Quais temas conectam suas decisoes de construcao com suas ideias de design?" — atraves dos community summaries.

**LazyGraphRAG (junho 2025)**: Reduziu custos de indexacao a **0.1% do custo original** mantendo qualidade.

#### Graphiti: Knowledge Graph Temporal

Graphiti (Zep) traz **tempo como dimensao first-class**:
- Entidades, relacoes e fatos tem **timestamps**
- Fatos podem ser **superados** (ex: "Budget era $50K" → "Budget agora e $75K")
- Suporta queries temporais: "O que mudou no projeto X entre janeiro e marco?"

### 2.4 Consolidacao de Memoria

#### Pattern Google Always-On Memory Agent

O agente do Google consolida automaticamente a cada 30 minutos:

1. **Review**: Escaneia memorias nao-consolidadas
2. **Connection mapping**: Identifica relacoes entre memorias distintas
3. **Insight generation**: Sintetiza temas transversais
4. **Compression**: Merge informacoes relacionadas para reduzir redundancia

**Armazenamento**: SQLite com 3 tabelas (memories, consolidations, connections). 5MB por 1000 sessoes vs 150MB com vector DB.

#### Mem0: Dual-Store (Vector + Graph)

**Fase de Extracao**: Analisa pares de mensagens usando LLM com contexto de (1) resumo da conversa, (2) mensagens recentes, (3) exchange atual. Identifica "memorias salientes".

**Fase de Update**: Cada fato extraido e avaliado contra memorias existentes. Operacoes: ADD (novo), UPDATE (augmentar), DELETE (contradicao), NOOP (sem mudanca).

**Mem0^g (Graph)**:
- Nodes: Entidades com tipo, embedding semantico, timestamp
- Edges: Relacoes rotuladas (triplets: source, relation, destination)
- **Entity Extractor**: Identifica pessoas, locais, conceitos, eventos
- **Relation Generator**: Deriva conexoes (ex: "mora_em", "prefere", "trabalha_com")
- Relacoes conflitantes sao **marcadas como invalidas** em vez de deletadas — preserva raciocinio temporal

**Performance (benchmark LOCOMO)**:
- Single-hop accuracy: 67.13% (Mem0) vs 63.79% (melhor baseline)
- Temporal accuracy: 58.13% (Mem0^g) — melhor que todos os baselines
- Latencia p95: 0.200s (Mem0) vs 17.117s (full-context)
- Economia de tokens: >90%

---

## ESTAGIO 3: Conhecimento Conectado → Training Pairs

### 3.1 Formatos de Training Data

#### Instruction Tuning (formato basico)

```json
{
  "instruction": "Qual e a melhor madeira para framing em clima frio canadense?",
  "input": "",
  "output": "SPF (Spruce-Pine-Fir) e o padrao no Canada para framing residencial em clima frio. A razao principal e o custo-beneficio: SPF e abundante, tem boa resistencia estrutural para as cargas tipicas, e seca bem. Para joists e headers com span maior, LVL (Laminated Veneer Lumber) e mais confiavel que madeira dimensional. No inverno de Ottawa, o key e nao instalar madeira com moisture content acima de 19% — isso causa shrinkage e pregos que afrouxam na primavera."
}
```

#### Conversation Format (multi-turn)

```json
{
  "messages": [
    {"role": "user", "content": "Preciso calcular material para um deck de 12x16."},
    {"role": "assistant", "content": "Para um deck de 12x16 (192 sq ft), vamos calcular por componente..."},
    {"role": "user", "content": "E se eu usar composite em vez de pressure-treated?"},
    {"role": "assistant", "content": "Composite muda o calculo de material e custo significativamente..."}
  ]
}
```

#### Preference Data (DPO format)

```json
{
  "prompt": "Como voce organizaria o schedule de um projeto de framing?",
  "chosen": "Eu comecaria pelo layout e snapping linhas no foundation... [resposta detalhada com experiencia real]",
  "rejected": "Um schedule de framing tipicamente envolve... [resposta generica de textbook]"
}
```

### 3.2 Estrategias de Geracao de Training Pairs

#### A. Geracao de Q&A a partir de Blocos

```
Para cada bloco de conhecimento:
    1. LLM (Claude/OpenAI) gera 3-5 perguntas que o bloco responde
    2. LLM gera respostas usando APENAS informacao do bloco + contexto conectado
    3. Humano (Cris) valida: resposta soa como ele pensaria?
    4. Pares validados entram no dataset de treinamento
```

**Tecnica de Alpaca**: Usar um LLM forte (Claude) para gerar instruction-response pairs de alta qualidade. O Alpaca original usou 52,000 pares gerados por GPT-3.5 para fine-tunar LLaMA-7B com resultados impressionantes.

#### B. Captura de Reasoning Patterns (nao so fatos)

**Metodo "Distilling Step-by-Step"**: O LLM gera rationales intermediarios para cada resposta — explicando o PORQUE, nao so o QUE. Treina o modelo menor com multi-task: predicao de resposta + geracao de rationale.

```json
{
  "instruction": "O cliente quer mudar de 2x6 para 2x8 nas paredes externas. Vale a pena?",
  "reasoning": "Analisando: 2x8 daria R-25 vs R-21 com 2x6. Custo adicional: ~15% mais em lumber. Em Ottawa, com -30C no inverno, a diferenca de insulation e significativa. Mas preciso verificar o span table — 2x8 a 16\" OC suporta mais carga lateral. Para uma parede exterior de basement, isso e overkill a menos que tenha tall wall. O tradeoff real e custo vs performance energetica.",
  "output": "Para paredes externas em Ottawa, a mudanca para 2x8 vale a pena se..."
}
```

#### C. Captura de Writing Style

**Processo de estilo**:
1. Coletar paragrafos escritos pelo Cris (notas, emails, mensagens)
2. LLM gera "versao neutra" de cada paragrafo (estilo generico)
3. **Anotacao**: Parear versao neutra ↔ versao original do Cris
4. Fine-tuning aprende a transformar texto neutro → estilo do Cris

**Paper ACL 2025**: "Can Language Models Capture Human Writing Styles?" — modelos fine-tuned conseguem replicar padroes estilisticos individuais, especialmente com paragrafos como unidade (vs sentencas).

#### D. Captura de Decision-Making Patterns

Para decisoes do Cris (construcao, design, negocio):
```json
{
  "instruction": "Cenario: Cliente quer adicionar um segundo andar no projeto. Budget apertado.",
  "input": "Contexto: fundacao existente para 1 andar, bearing wall layout ja definido, inverno chegando em 2 meses",
  "output": "Minha abordagem: primeiro verifico a fundacao — se foi projetada so para 1 andar, nao da para simplesmente adicionar. Precisaria de um structural engineer para avaliar. Se a fundacao suporta, o timeline e o killer — 2 meses antes do inverno nao e suficiente para levantar o segundo andar E fechar o envelope. Eu recomendaria ao cliente: (1) fazer o structural assessment agora, (2) planejar para primavera, (3) usar o inverno para permitting e material procurement. Budget apertado + rush = desastre em construcao."
}
```

### 3.3 Quality Curation de Training Pairs

| Criterio | O que filtrar | Como |
|---------|--------------|------|
| **Factual accuracy** | Pares com informacao incorreta | Verificacao cruzada com knowledge graph |
| **Consistency** | Pares que contradizem outros pares | Embedding similarity + contradiction detection |
| **Representatividade** | Pares que capturam o "jeito do Cris" | Scoring de estilo vs baseline generico |
| **Diversidade** | Evitar repeticao de patterns identicos | Clustering de embeddings dos pares |
| **Dificuldade balanceada** | Mix de perguntas simples + complexas | Distribuicao por complexidade |

**Minimo viavel para fine-tuning**: 1,000-5,000 pares de alta qualidade (QLoRA research). Para capturar domain expertise: 10,000-50,000+.

**Principio fundamental**: 1,000 pares limpos > 100,000 ruidosos. Qualidade domina quantidade.

---

## ESTAGIO 4: Training Pairs → Model Weights

### 4.1 Quando Ha "Dados Suficientes"?

| Quantidade | O que captura | Adequado para |
|-----------|--------------|---------------|
| **500-1,000** | Estilo basico, preferencias simples | POC / proof of concept |
| **1,000-5,000** | Domain knowledge basico, tom de voz | Primeira versao funcional |
| **5,000-10,000** | Reasoning patterns, decisoes complexas | Modelo util para assistencia |
| **10,000-50,000** | Expertise profunda, multi-dominio | "Pensa como o Cris" |
| **50,000+** | Nuances sutis, edge cases, criatividade | Digital twin cognitivo |

### 4.2 QLoRA Fine-Tuning (conforme 04-local-models.md)

**Stack recomendado**: Unsloth + QLoRA (4-bit)

```
Modelo base (ex: Qwen 2.5-7B-Instruct)
    |
    v
QLoRA adapter (LoRA rank 16-64, alpha 32)
    |
    v
Training: 1-3 epochs sobre dataset pessoal
    |
    v
Merge adapter → Modelo fine-tuned
    |
    v
Quantizar → GGUF Q4_K_M → Deploy no Ollama
```

**Recursos necessarios** (RTX 3090/4090, 24GB VRAM):
- 7-8B: 8-10 GB VRAM, ~1-2h de treinamento
- 13-14B: 12-16 GB, ~2-4h
- 32B: 20-24 GB, ~4-6h (apertado)

### 4.3 Avaliacao: "O Modelo Pensa Como o Cris?"

#### Metodos de Avaliacao

**1. Behavioral testing (mais direto)**:
- Apresentar cenarios que o Cris ja enfrentou (com resposta conhecida)
- Comparar resposta do modelo vs resposta real do Cris
- **Stanford Digital Twin study**: Copias digitais atingiram **85% de concordancia** com humanos em questionarios — similar a consistencia do proprio humano em re-teste

**2. Psychometric evaluation**:
- Paper Nature Machine Intelligence (2025): Framework psicometrico para avaliar tracos de personalidade em LLMs
- Big Five, MBTI, questionarios customizados
- Modelos maiores com instruction-tuning mostram perfis **reliaveis e preditivos de comportamento**

**3. A/B testing com o proprio Cris**:
- Gerar respostas do modelo fine-tuned vs modelo base
- Cris escolhe qual "soa mais como ele" (gera preference data para DPO)
- Iterativo: cada rodada de feedback melhora o alinhamento

**4. Domain expertise probes**:
- Perguntas tecnicas de construcao onde ha resposta "certa" profissional
- Medir nao so a resposta, mas o RACIOCINIO por tras dela
- O modelo deveria pensar em termos de "timeline, budget, structural load, weather" — nao apenas fatos

### 4.4 Catastrophic Forgetting: O Grande Desafio

**O problema**: Ao fine-tunar com dados pessoais, o modelo pode ESQUECER conhecimento geral (idiomas, raciocinio, fatos do mundo).

**Descobertas de pesquisa (2025)**:
- Forgetting e **mais severo em modelos maiores** (paradoxalmente, porque tem mais a perder)
- **"Spurious Forgetting"** (ICLR 2025): Muitas vezes o que parece esquecimento e na verdade perda de alinhamento com a tarefa, nao perda real de conhecimento
- Decoder-only models (como a familia Qwen) esquecem **menos** que encoder-decoder

#### Tecnicas Anti-Forgetting

| Tecnica | Como funciona | Overhead | Eficacia |
|---------|--------------|----------|----------|
| **SDFT (Self-Distillation Fine-Tuning)** | Modelo usa a si mesmo como professor via in-context learning | 2.5x FLOPS | MELHOR disponivel (Jan 2026, MIT) |
| **SSR (Self-Synthesized Rehearsal)** | Gera dados sinteticos das tasks anteriores para replay | Moderado | Boa |
| **Instruction tuning previa** | General instruction tuning antes do fine-tuning especifico | Baixo | Moderada |
| **LoRA/QLoRA** | Modifica apenas um subset de parametros | Minimo | Boa (preserva base) |
| **Model merging** | Merge pesos do modelo original com fine-tuned | Baixo | Variavel |
| **Replay buffer** | Mix de dados originais + novos durante training | Proporcional ao buffer | Boa |

#### SDFT em Detalhe (Breakthrough, Janeiro 2026)

**Self-Distillation Fine-Tuning** (MIT/Harvard) e a tecnica mais promissora para continual learning:

1. **Professor**: O mesmo modelo base, condicionado com demonstracoes (in-context learning)
2. **Aluno**: O modelo sendo treinado, condicionado apenas com input
3. **Signal**: Minimizar divergencia KL entre professor e aluno
4. **EMA update**: Professor atualizado com media movel exponencial dos pesos do aluno

**Resultados**:
- Sequencia de 3 tasks: SDFT mantem performance estavel em tasks anteriores enquanto aprende novas
- SFT padrao: performance oscila violentamente entre tasks
- Knowledge acquisition: 89% vs 80% (SFT), com 98% vs 80% em out-of-distribution
- **Desvantagem**: Requer ~2.5x mais compute que SFT padrao, e modelos >=7B para funcionar

**Relevancia para o Amazo**: SDFT seria ideal para o ciclo incremental — adicionar novos dados do Cris sem perder o que ja aprendeu. Mas requer modelo >=7B (Qwen 2.5-7B minimo) e mais tempo de treinamento.

### 4.5 Continual Learning: Adicionar Sem Perder

**Estrategia proposta para o Amazo**:

```
Semana 1-4: Acumular blocos, gerar training pairs (Claude/OpenAI como juiz)
Semana 5: Primeiro fine-tuning (base: Qwen 2.5-7B, 1000-2000 pares, QLoRA)
Semana 6-8: Avaliar + gerar mais pares com feedback do Cris
Semana 9: Segundo fine-tuning (SDFT sobre modelo anterior, novos pares)
    ...ciclo contínuo...
```

**Regra pratica**: Novo fine-tuning a cada 2-4 semanas, ou quando houver 500+ novos pares validados.

---

## ESTAGIO 5: Weights → Referenced Knowledge

### 5.1 RAG vs Weights: Quando Usar Cada Um

| Caracteristica | Fine-tuning (Weights) | RAG (Retrieval) |
|---------------|----------------------|-----------------|
| **Melhor para** | Estilo, raciocinio, patterns, expertise estavel | Fatos especificos, dados recentes, detalhes |
| **Atualizacao** | Requer re-treinamento | Instantanea (adicionar ao vector DB) |
| **Latencia** | Mais rapido (conhecimento internalizado) | Mais lento (busca + contexto) |
| **Transparencia** | Opaco (nao sabe de onde veio) | Rastreavel (cita fonte) |
| **Alucinacao** | Pode "lembrar" errado com confianca | Pode recuperar contexto errado |
| **Custo** | Alto upfront, zero marginal | Baixo upfront, custo por query |

### 5.2 Abordagem Hibrida (Recomendada)

**RAFT (Retrieval Augmented Fine-Tuning)** — UC Berkeley + Microsoft + Meta:

O modelo e treinado para funcionar em modo "open-book" — recebe documentos junto com a pergunta e aprende a:
1. **Ignorar distratores** (documentos irrelevantes recuperados)
2. **Citar verbatim** do documento relevante
3. **Decidir** quando confiar no retrieval vs conhecimento internalizado

**Training split**: 80% dos exemplos incluem o documento correto ("oracle"), 20% nao incluem — forcando o modelo a aprender quando pode e quando nao pode confiar no retrieval.

**Resultado**: RAFT com Llama-2 7B **superou GPT-3.5 com RAG** na maioria dos benchmarks.

**Estrategia para o Amazo**:
```
Pergunta do Cris
    |
    v
Roteador de confianca (Phi-4 Mini):
    - "Qual a melhor madeira para framing?" → Weights (expertise internalizada)
    - "Qual era o budget do projeto X em janeiro?" → RAG (fato especifico)
    - "Como voce abordaria este problema de design?" → Hybrid (raciocinio + dados)
```

### 5.3 Hallucination vs Memory: Como Saber

#### Deteccao de Alucinacao

**Abordagens em 2025-2026**:

1. **Sequence log-probability**: Medir confianca do modelo via probabilidade normalizada dos tokens gerados. Baixa probabilidade = maior risco de alucinacao

2. **HaluGate (vLLM, 2025)**: Pipeline de deteccao token-by-token em tempo real — detecta claims nao-suportadas antes de chegarem ao usuario

3. **Attention weight analysis**: Quedas sistematicas no peso de atencao a tokens precedentes correlacionam com posicoes factualmente incorretas

4. **Cross-reference com knowledge graph**: Se o modelo afirma algo, verificar se existe suporte no grafo de conhecimento. Sem suporte = flag como potencial alucinacao

#### Confidence Scoring

```
Para cada resposta do Amazo:
    1. Calcular log-probability media dos tokens
    2. Verificar se entidades mencionadas existem no knowledge graph
    3. Buscar blocos de suporte via RAG
    4. Score final: combinacao ponderada dos 3 sinais

    Confianca ALTA (>0.8): Resposta direta
    Confianca MEDIA (0.5-0.8): Resposta com caveat "baseado no que sei..."
    Confianca BAIXA (<0.5): "Nao tenho certeza. Quer que eu busque?"
```

### 5.4 Citation / Attribution

**O desafio**: Modelos fine-tuned NAO sabem de onde vem seu conhecimento — esta nos pesos, nao em fontes rastreáveis.

**Solucoes**:

1. **RAG para citacao**: Quando a resposta usa RAG, incluir block_id dos blocos recuperados
2. **RAFT-style training**: Treinar o modelo para citar fontes quando disponíveis
3. **Post-hoc verification**: Apos gerar resposta, buscar blocos que a suportam e linkar como "fontes provaveis"
4. **Dual response**: Modelo gera resposta + lista de topicos/entidades → sistema busca blocos correspondentes

---

## ESTAGIO 6: O Feedback Loop

### 6.1 Correcao → Novo Training Data

```
Cris: "Qual o spanning maximo para 2x10 a 16 OC?"
Amazo: "O spanning maximo e 14'6\"..."
Cris: "Errado. Para SPF #2 com live load 40psf, e 15'5\". Confere o span table do NBCC."
    |
    v
Sistema registra:
    - Bloco de correcao: {pergunta, resposta_errada, correcao, fonte_correta}
    - Gera training pair: instruction=pergunta, output=resposta_corrigida + raciocinio
    - Atualiza knowledge graph: fato corrigido com timestamp e autoridade
    - Proximo fine-tuning incorpora a correcao
```

### 6.2 Validacao Humana → Training Pairs

```
Amazo gera resposta sobre topico X
    |
    v
Cris avalia: 👍 (bom) / 👎 (ruim) / ✏️ (editar)
    |
    v
Se 👍: Par validado → dataset de treinamento
Se ✏️: Versao editada = "chosen", original = "rejected" → DPO dataset
Se 👎: Descartado + flag para review do topico
```

### 6.3 DPO (Direct Preference Optimization) em Escala Pessoal

DPO e a alternativa pratica ao RLHF para escala pessoal — nao precisa de reward model separado.

**Como funciona**:
1. Para o mesmo prompt, gerar 2+ respostas (variando temperatura/sampling)
2. Cris escolhe a melhor ("chosen") e a pior ("rejected")
3. DPO otimiza diretamente: maximizar probabilidade de "chosen" vs "rejected"
4. Loss function simples: classificacao binaria, sem reinforcement learning

**Vantagens para uso pessoal**:
- Nao precisa treinar reward model (elimina instabilidade do RLHF)
- Computacionalmente eficiente (convergencia rapida)
- Funciona com datasets menores que RLHF
- Resultados iguais ou superiores ao PPO-based RLHF em dialog e sumarizacao

**Dataset necessario**: 500-2,000 preference pairs para efeito perceptivel.

**Ferramentas**: Axolotl suporta DPO nativamente. PEFT (HuggingFace) com TRL library.

### 6.4 O Ciclo Completo

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    v                                  │
    RAW DATA → BLOCOS → KNOWLEDGE GRAPH → TRAINING PAIRS
                                              │
                                              v
                                         FINE-TUNING
                                              │
                                              v
                                         AMAZO v(N)
                                              │
                                              v
                                    AMAZO GERA RESPOSTAS
                                              │
                                              v
                                    CRIS AVALIA / CORRIGE
                                              │
                                              v
                              CORRECOES VIRAM NOVOS TRAINING PAIRS ──┘
```

---

## SISTEMAS DE REFERENCIA: Arquiteturas Existentes

### Google Always-On Memory Agent

**Arquitetura**: 3 agentes especializados (ADK + Gemini Flash-Lite + SQLite):

| Agente | Funcao | Quando |
|--------|--------|--------|
| **IngestAgent** | Extrai informacao estruturada (summary, entities, topics, importance) | A cada novo input |
| **ConsolidateAgent** | Revisa memorias, encontra conexoes, gera insights, comprime | A cada 30 min |
| **QueryAgent** | Sintetiza respostas com citacoes de memoria | Quando perguntado |

**27 formatos suportados**: text, images, audio, video, PDF.
**Sem embeddings, sem vector DB** — memoria estruturada puro LLM em SQLite.
**5MB por 1000 sessoes** vs 150MB com vector DB.

### Mem0

**Dual-store**: Vector (rapido, ~7K tokens/conversa) + Graph (relacional, ~14K tokens/conversa).
**Pipeline**: Extract → Compare → ADD/UPDATE/DELETE/NOOP.
**Mem0^g**: Grafos dirigidos rotulados. Entity Extractor + Relation Generator.
**OpenMemory MCP**: Integra com Claude, ChatGPT, Perplexity via Model Context Protocol.

### Letta (MemGPT)

**Paradigma LLM-as-OS**: Modelo gerencia sua propria memoria como um OS gerencia RAM e disco.
**Tiers**: Core memory (sempre em contexto) → Recall memory (conversas recentes) → Archival (longo prazo).
**Self-editing**: O agente decide o que manter, comprimir, ou arquivar.
**Strategic forgetting**: Summarization + targeted deletion. Instancias especificas → fatos semanticos gerais.

### Karpathy LLM Knowledge Base

**3 pastas**: raw/ → wiki/ → (manutencao continua).
**LLM como bibliotecario**: Compila, linta, interliga arquivos Markdown.
**Sem chunking, sem vector DB**: Wiki articles ja sao sumarios em contexto completo.
**95% reducao de tokens** vs loading ingenuos.

### Stanford Digital Twins (2025)

**AI twins de 1,000+ pessoas**: Treinados com dados pessoais (surveys, entrevistas, logs comportamentais).
**85% de concordancia** com humanos em questionarios — equivalente a re-teste humano.
**Limitacao**: "No momento que voce pede para pensar sobre preferencias ou raciocinar sobre uma decisao dificil, esses modelos vao ter dificuldade."

### Cognitive Digital Twins (Academia 2025)

**Tres camadas** (diversos papers):
1. **Ontology layer**: Estrutura conceitos em rede de conhecimento
2. **Knowledge layer**: Mapeia dados em tempo real
3. **Cognitive layer**: ML + reasoning para evolucao autonoma

---

## RECOMENDACOES PARA O SEGUNDO CEREBRO

### Fase 1: Foundation (Meses 1-2)

1. **Chunking**: RecursiveCharacterTextSplitter (LangChain) + by_title (unstructured.io)
2. **Metadados**: Pipeline de extracao com Qwen3-30B-A3B (entidades, topicos) + Phi-4 Mini (classificacao) + nomic-embed-text (embeddings)
3. **Armazenamento**: PostgreSQL + pgvector (conforme decisao do 05-server-architecture.md)
4. **Consolidacao**: Pattern Google Always-On Memory Agent adaptado para CrewAI
5. **Quality scoring**: Importance score via LLM durante ingestao

### Fase 2: Conexoes (Meses 2-3)

1. **Embedding search**: pgvector com hybrid BM25 + semantic
2. **Knowledge graph**: Mem0 como base + Graphiti para dimensao temporal
3. **GraphRAG patterns**: Community detection para descobrir temas emergentes
4. **Consolidacao automatica**: Agente background a cada 30 min

### Fase 3: Training Pipeline (Meses 3-5)

1. **Geracao de pares**: Claude/OpenAI geram Q&A a partir de blocos curados
2. **Captura de estilo**: Paragrafos do Cris → versao neutra → pares de estilo
3. **Reasoning pairs**: "Distilling Step-by-Step" para capturar raciocinio
4. **Curation**: Filtragem por qualidade, diversidade, consistencia
5. **Meta**: Acumular 2,000-5,000 pares validados antes do primeiro fine-tuning

### Fase 4: Fine-Tuning (Mes 5+)

1. **Primeiro modelo**: Qwen 2.5-7B + QLoRA via Unsloth
2. **Avaliacao**: Behavioral testing + A/B com o Cris
3. **DPO**: Preference pairs do feedback do Cris
4. **Continual learning**: SDFT para adicionar dados sem esquecer
5. **RAFT training**: Ensinar o modelo a funcionar em modo hybrid (weights + RAG)

### Fase 5: Hybrid Deployment (Mes 6+)

1. **Roteador de confianca**: Phi-4 Mini decide weights vs RAG vs hybrid
2. **Confidence scoring**: Log-probability + knowledge graph verification
3. **Citation**: RAG-backed attribution para respostas fatuais
4. **Feedback loop**: Correcoes do Cris → novos pares → proximo ciclo de fine-tuning

---

## METRICAS DE SUCESSO

| Metrica | Como medir | Alvo |
|---------|-----------|------|
| **Chunking quality** | % de blocos com metadados completos | >90% |
| **Connection density** | Media de conexoes por bloco | >3 |
| **Training pair quality** | % aprovados pelo Cris no review | >80% |
| **Style match** | A/B test: Cris identifica "voz" do modelo | >70% preferencia |
| **Factual accuracy** | Probes de domain knowledge (construcao) | >85% |
| **Forgetting** | Performance em tasks anteriores apos novo fine-tuning | <5% drop |
| **Confidence calibration** | High-confidence respostas realmente corretas | >90% |
| **Feedback incorporation** | Correcao aceita → nao repete erro | >95% |

---

## Fontes Principais

### Ferramentas e Projetos
- [Mem0](https://github.com/mem0ai/mem0) — Universal memory layer para agentes AI
- [Graphiti/Zep](https://github.com/getzep/graphiti) — Knowledge graph temporal
- [Google Always-On Memory Agent](https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/agents/always-on-memory-agent) — Consolidacao de memoria sem vector DB
- [Letta/MemGPT](https://github.com/letta-ai/letta) — Agentes stateful com memoria em camadas
- [Microsoft GraphRAG](https://microsoft.github.io/graphrag/) — Knowledge graph + community detection
- [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — Markdown-first knowledge base
- [Unsloth](https://github.com/unslothai/unsloth) — Fine-tuning eficiente (2x rapido, 70% menos VRAM)

### Papers e Pesquisa
- [SDFT: Self-Distillation Enables Continual Learning](https://arxiv.org/abs/2601.19897) (MIT, Jan 2026)
- [Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory](https://arxiv.org/abs/2504.19413)
- [RAFT: Adapting Language Model to Domain Specific RAG](https://arxiv.org/abs/2403.10131) (UC Berkeley)
- [DPO: Direct Preference Optimization](https://arxiv.org/abs/2305.18290) (Stanford)
- [MemGPT: Towards LLMs as Operating Systems](https://arxiv.org/abs/2310.08560)
- [QLoRA: Efficient Finetuning of Quantized LLMs](https://arxiv.org/abs/2305.14314)
- [Catastrophic Forgetting in LLMs During Continual Fine-tuning](https://arxiv.org/abs/2308.08747)
- [Beyond Believability: Accurate Human Behavior Simulation with Fine-Tuned LLMs](https://arxiv.org/html/2503.20749v1) (Stanford Digital Twins)
- [Psychometric Framework for LLM Personality](https://www.nature.com/articles/s42256-025-01115-6) (Nature Machine Intelligence, 2025)
- [Knowledge Graph Construction with LLMs Survey](https://arxiv.org/html/2510.20345v1)
- [Cognitive Digital Twin Frameworks Survey](https://www.sciencedirect.com/science/article/pii/S027861252500250X) (2025)

### Guias e Artigos
- [Chunking Strategies for RAG](https://weaviate.io/blog/chunking-strategies-for-rag) (Weaviate)
- [Best Chunking Strategies 2026](https://www.firecrawl.dev/blog/best-chunking-strategies-rag) (Firecrawl)
- [RAG vs Fine-Tuning vs Hybrid](https://www.actian.com/blog/databases/should-you-use-rag-or-fine-tune-your-llm/) (Actian)
- [State of AI Agent Memory 2026](https://mem0.ai/blog/state-of-ai-agent-memory-2026) (Mem0)
- [LLM Knowledge Distillation Survey](https://link.springer.com/article/10.1007/s10462-025-11423-3) (Springer, 2025)
- [HaluGate: Token-Level Hallucination Detection](https://blog.vllm.ai/2025/12/14/halugate.html) (vLLM)
- [Fine-Tuning AI for Authors](https://www.novelcrafter.com/blog/fine-tuning-ai-for-authors) (Novelcrafter)
- [From PKM to Personal AI Companion](https://dl.acm.org/doi/10.1145/3688828.3699647) (ACM, 2025)
