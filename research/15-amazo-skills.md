# 15 · Sistema de Skills e Capacidades do Amazo

> PESQUISA COMPLETA · Abril 2026
> Parte do projeto **Segundo Cerebro** — infraestrutura pessoal de IA

---

## 1. Visao Geral

O Amazo precisa ser mais do que um chatbot generico. Ele deve funcionar como um **agente multi-especialista**,
capaz de alternar entre dominios de conhecimento (dev, escrita, medicina, direito, construcao, criacao de midia)
de forma fluida e com qualidade profissional em cada area.

Este documento cobre a arquitetura completa para um sistema de skills modulares:
desde o formato de definicao (SKILL.md), passando por integracao de ferramentas (MCP),
adaptadores especializados (LoRA), roteamento inteligente, e desenvolvimento progressivo.

```
+------------------------------------------------------------------+
|                         AMAZO CORE                               |
|  +------------+  +------------+  +----------+  +-------------+  |
|  | Skill      |  | LoRA       |  | MCP Tool |  | Evaluation  |  |
|  | Router     |  | Switcher   |  | Registry |  | Engine      |  |
|  +-----+------+  +-----+------+  +----+-----+  +------+------+  |
|        |               |              |                |         |
|  +-----v---------------v--------------v----------------v------+  |
|  |                   SKILL MODULES                            |  |
|  | [Dev] [Writing] [Construction] [Medical] [Legal] [Creative]|  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

---

## 2. Anthropic SKILL.md — Padrao de Definicao de Skills

### 2.1 O que e o SKILL.md

A Anthropic introduziu o conceito de **skill files** no Claude Code como forma de
ensinar ao agente procedimentos especificos e reproduziveis. Um arquivo `SKILL.md`
e colocado no diretorio `.claude/skills/` do projeto e funciona como uma "receita"
que o agente segue quando determinado tipo de tarefa e detectado.

### 2.2 Estrutura do Arquivo

```markdown
# Skill: Nome da Skill

## Descricao
Breve descricao do que esta skill faz.

## Trigger
Quando esta skill deve ser ativada (palavras-chave, contexto).

## Instrucoes
1. Passo a passo detalhado
2. Com exemplos concretos
3. E regras de validacao

## Ferramentas Necessarias
- Lista de tools MCP ou CLI que a skill usa

## Exemplos
### Input
[exemplo de entrada]
### Output
[exemplo de saida esperada]
```

### 2.3 Adaptacao para o Amazo

Para o Amazo, expandimos o padrao SKILL.md com campos adicionais:

| Campo               | Descricao                                        |
|---------------------|--------------------------------------------------|
| `skill_id`          | Identificador unico (ex: `dev.python`)           |
| `version`           | Versao semantica da skill                        |
| `lora_adapter`      | Caminho para o adaptador LoRA associado          |
| `mcp_tools`         | Lista de servidores MCP que a skill requer       |
| `proficiency_level` | Nivel atual: apprentice, journeyman, master      |
| `eval_benchmark`    | Benchmark usado para medir qualidade             |
| `dependencies`      | Outras skills necessarias                        |
| `disclaimers`       | Avisos legais (essencial para medicina/direito)  |

---

## 3. MCP (Model Context Protocol) para Integracao de Ferramentas

### 3.1 O que e o MCP

O **Model Context Protocol** e um padrao aberto (criado pela Anthropic, adotado amplamente)
que define como agentes de IA se conectam a ferramentas externas. Funciona no modelo
cliente-servidor:

```
Amazo (Host) <---> MCP Client <---> MCP Server (Tool Provider)
                                        |
                                   [Filesystem, API, DB, Browser...]
```

### 3.2 Capacidades do MCP

| Capacidade    | Descricao                                          |
|---------------|----------------------------------------------------|
| **Tools**     | Funcoes executaveis (ex: buscar no banco, compilar) |
| **Resources** | Dados contextuais (ex: arquivos, schemas)          |
| **Prompts**   | Templates reutilizaveis de prompts                 |
| **Sampling**  | Permite ao servidor pedir completions ao modelo    |

### 3.3 Skills Expondo Tools via MCP

Cada skill do Amazo pode registrar seus proprios servidores MCP:

| Skill         | MCP Servers                                         |
|---------------|-----------------------------------------------------|
| Dev           | filesystem, git, docker, npm, linter, test-runner   |
| Writing       | grammar-checker, style-analyzer, plagiarism-check   |
| Construction  | code-lookup (OBC), calculator, CAD-viewer           |
| Medical       | pubmed-search, drug-interaction-checker             |
| Legal         | canlii-search, statute-lookup, case-citation        |
| Image         | stable-diffusion, comfyui, image-editor             |
| Video         | ffmpeg, video-gen-api, subtitle-generator           |
| Music/Audio   | udio-api, audio-editor, transcription               |

### 3.4 Configuracao MCP no Amazo

```json
{
  "mcpServers": {
    "dev-tools": {
      "command": "node",
      "args": ["./mcp-servers/dev-tools/index.js"],
      "skills": ["dev.*"]
    },
    "legal-canada": {
      "command": "python",
      "args": ["./mcp-servers/legal/canlii_server.py"],
      "skills": ["legal.canadian"]
    },
    "medical-search": {
      "command": "python",
      "args": ["./mcp-servers/medical/pubmed_server.py"],
      "skills": ["medical.*"],
      "disclaimer": "NAO substitui consulta medica profissional"
    }
  }
}
```

---

## 4. LoRA Adapters como Modulos de Skill

### 4.1 Conceito

**LoRA (Low-Rank Adaptation)** permite criar especializacoes leves sobre um modelo base
sem retreinar o modelo inteiro. Cada adaptador LoRA adiciona tipicamente 0.1%-2% dos
parametros do modelo base, ocupando entre 10MB e 500MB dependendo do rank.

```
Modelo Base (ex: Llama 3.1 70B)
    |
    +-- LoRA: dev-python (rank 64, ~200MB)
    +-- LoRA: dev-typescript (rank 64, ~200MB)
    +-- LoRA: writing-pt-br (rank 32, ~100MB)
    +-- LoRA: medical-general (rank 64, ~200MB)
    +-- LoRA: legal-canadian (rank 64, ~200MB)
    +-- LoRA: construction-obc (rank 32, ~100MB)
```

### 4.2 Vantagens do Modelo LoRA-per-Skill

| Vantagem                  | Descricao                                          |
|---------------------------|----------------------------------------------------|
| Modularidade              | Adicionar/remover skills sem tocar no modelo base  |
| Eficiencia de memoria     | Todos compartilham o modelo base na GPU            |
| Treino independente       | Cada skill e treinada separadamente                |
| Versionamento             | Skills podem ter versoes diferentes                |
| Rollback facil            | Reverter uma skill sem afetar outras               |
| Composicao                | Possivel merge de multiplos LoRAs                  |

### 4.3 Parametros Recomendados por Dominio

| Dominio       | Rank | Alpha | Target Modules        | Tamanho Estimado |
|---------------|------|-------|-----------------------|------------------|
| Dev (codigo)  | 64   | 128   | q,k,v,o,gate,up,down  | 150-300MB        |
| Escrita       | 32   | 64    | q,k,v,o               | 80-150MB         |
| Construcao    | 64   | 128   | q,k,v,o,gate,up,down  | 150-300MB        |
| Medicina      | 64   | 128   | q,k,v,o,gate,up,down  | 150-300MB        |
| Direito       | 64   | 128   | q,k,v,o,gate,up,down  | 150-300MB        |
| Criacao visual| 32   | 64    | q,k,v,o               | 80-150MB         |

---

## 5. LoRA Switching em Runtime

### 5.1 Tecnologias Disponiveis

| Tecnologia  | Descricao                                              | Status       |
|-------------|--------------------------------------------------------|--------------|
| **vLLM**    | Suporte nativo a multi-LoRA com paged attention        | Producao     |
| **S-LoRA**  | Serving de milhares de LoRAs simultaneamente           | Pesquisa     |
| **Punica**  | Kernel CUDA otimizado para multi-LoRA batching         | Pesquisa     |
| **LoRAX**   | Framework de serving multi-LoRA pela Predibase         | Producao     |
| **SGLang**  | Runtime com suporte a LoRA switching rapido             | Producao     |

### 5.2 vLLM Multi-LoRA (Recomendado)

O vLLM e a opcao mais madura para o Amazo. Permite carregar multiplos LoRAs
e rotea-los por request:

```python
# Inicializacao do servidor vLLM com multi-LoRA
from vllm import LLM, SamplingParams
from vllm.lora.request import LoRARequest

llm = LLM(
    model="meta-llama/Llama-3.1-70B-Instruct",
    enable_lora=True,
    max_loras=8,           # ate 8 LoRAs simultaneos na memoria
    max_lora_rank=64,
    tensor_parallel_size=2  # 2 GPUs
)

# Request com LoRA especifico
result = llm.generate(
    "Analise este contrato de locacao...",
    sampling_params=SamplingParams(temperature=0.3),
    lora_request=LoRARequest(
        lora_name="legal-canadian",
        lora_int_id=3,
        lora_local_path="/models/loras/legal-canadian-v2"
    )
)
```

### 5.3 S-LoRA e Punica — Escalabilidade

S-LoRA introduz **Unified Paging** para gerenciar memoria de LoRA adapters
de forma similar ao paged attention do vLLM. Permite servir potencialmente
milhares de adapters com overhead minimo. Punica fornece kernels CUDA
customizados (BGMV) que permitem batching de requests com LoRAs diferentes
no mesmo batch, sem padding.

### 5.4 Fluxo de Switching

```
Request do Usuario
       |
       v
[Skill Router] --> identifica dominio --> "legal"
       |
       v
[LoRA Manager] --> verifica se "legal-canadian" esta na GPU
       |
       +-- SIM --> roteia request com lora_request
       |
       +-- NAO --> carrega adapter (swap LRU) --> roteia
       |
       v
[Modelo Base + LoRA] --> gera resposta
       |
       v
[Post-processing] --> aplica disclaimers se necessario
```

---

## 6. Skill Routing — Deteccao e Roteamento

### 6.1 Estrategias de Roteamento

| Estrategia              | Descricao                                      | Latencia |
|-------------------------|-------------------------------------------------|----------|
| **Keyword matching**    | Regras simples por palavras-chave               | ~0ms     |
| **Classifier leve**     | Modelo pequeno (BERT) treinado para classificar | ~5ms     |
| **LLM self-routing**    | O proprio modelo decide qual skill usar         | ~100ms   |
| **Embedding similarity**| Compara embedding do input com perfil da skill  | ~10ms    |
| **Hybrid**              | Keyword rapido + classifier para desempate      | ~5-10ms  |

### 6.2 Implementacao Recomendada (Hybrid Router)

```python
class SkillRouter:
    def __init__(self):
        self.keyword_rules = load_keyword_rules()     # rapido
        self.classifier = load_skill_classifier()      # fallback
        self.skill_embeddings = load_skill_profiles()  # semantico

    def route(self, user_input: str) -> SkillMatch:
        # Fase 1: keyword matching (< 1ms)
        match = self.keyword_rules.match(user_input)
        if match and match.confidence > 0.9:
            return match

        # Fase 2: classifier (< 10ms)
        match = self.classifier.predict(user_input)
        if match.confidence > 0.8:
            return match

        # Fase 3: embedding similarity (< 15ms)
        input_emb = embed(user_input)
        match = self.skill_embeddings.nearest(input_emb)
        return match
```

### 6.3 Mapeamento de Dominios

| Input (exemplo)                                  | Skill Detectada      |
|--------------------------------------------------|----------------------|
| "Crie uma funcao Python que..."                  | dev.python           |
| "Revise este paragrafo do meu artigo"            | writing.revision     |
| "Qual o recuo minimo do OBC para garagem?"       | construction.obc     |
| "Quais os efeitos colaterais da metformina?"     | medical.pharma       |
| "Analise este contrato de trabalho"              | legal.employment     |
| "Gere uma imagem de um por-do-sol cyberpunk"     | creative.image       |
| "Crie uma trilha sonora ambient de 2 minutos"    | creative.music       |

---

## 7. Dados de Treinamento por Dominio

### 7.1 Desenvolvimento de Software

| Fonte                    | Tipo                  | Volume Estimado   |
|--------------------------|-----------------------|-------------------|
| The Stack v2             | Codigo multilingual   | 67TB              |
| GitHub repos curados     | Codigo de qualidade   | Variavel          |
| Stack Overflow dump      | Q&A tecnico           | ~60GB             |
| Documentacao oficial     | Docs de frameworks    | ~10GB             |
| Commits + code reviews   | Praticas de engenharia| Variavel          |
| Projetos pessoais do user| Estilo do usuario     | Variavel          |

### 7.2 Escrita e Comunicacao

| Fonte                    | Tipo                  | Notas              |
|--------------------------|-----------------------|--------------------|
| Textos do proprio usuario| Estilo pessoal        | ESSENCIAL          |
| Wikipedia PT-BR          | Referencia factual    | Licenca livre      |
| Corpus academico         | Escrita formal        | Com permissao      |
| Blogs/artigos do user    | Tom e voz pessoal     | Fine-tune de estilo|

### 7.3 Construcao e Engenharia

| Fonte                           | Tipo                | Jurisdicao    |
|---------------------------------|---------------------|---------------|
| Ontario Building Code (OBC)     | Codigo de obras     | Ontario, CA   |
| CSA Standards                   | Normas tecnicas     | Canada        |
| National Building Code (NBC)    | Codigo nacional     | Canada        |
| RSMeans                         | Custos construcao   | America Norte |
| Manuais de fabricantes          | Especificacoes      | Geral         |

> **NOTA**: OBC e CSA sao documentos protegidos por copyright.
> Usar para fine-tune pessoal (fair use pessoal), nunca redistribuir.

### 7.4 Medicina e Saude

| Fonte                    | Tipo                  | Acesso         |
|--------------------------|-----------------------|----------------|
| PubMed / PMC Open Access | Artigos cientificos  | Aberto         |
| Clinical Guidelines (CMA)| Diretrizes clinicas  | Parcial        |
| DrugBank                 | Interacoes farmaco   | Aberto         |
| MedQA dataset            | Q&A medico           | Aberto         |
| UpToDate (resumos)       | Referencia clinica   | Assinatura     |

> **DISCLAIMER OBRIGATORIO**: O Amazo NAO e um profissional de saude.
> Respostas medicas sao APENAS informativas e NAO substituem consulta medica.
> Sempre incluir este aviso nas respostas do dominio medico.

### 7.5 Direito e Legal

| Fonte                    | Tipo                  | Jurisdicao     |
|--------------------------|-----------------------|----------------|
| CanLII                   | Jurisprudencia        | Canada         |
| Ontario e-Laws           | Legislacao provincial | Ontario        |
| Federal Laws (Justice.gc)| Legislacao federal    | Canada         |
| Legal Q&A datasets       | Treinamento           | Geral          |
| Bar exam prep materials  | Referencia            | Geral          |

> **DISCLAIMER OBRIGATORIO**: O Amazo NAO e um advogado.
> Respostas legais sao APENAS informativas e NAO constituem aconselhamento juridico.

### 7.6 Criacao de Midia (Imagem, Video, Audio)

| Tipo     | Abordagem                                         |
|----------|----------------------------------------------------|
| Imagem   | Prompt engineering para SD/DALL-E/Midjourney + ComfyUI |
| Video    | Integracao com Runway, Kling, ffmpeg pipelines     |
| Musica   | APIs de geracao (Udio, Suno) + edicao local        |
| Audio    | TTS (Coqui/XTTS), edicao com ffmpeg/sox           |

> Para criacao de midia, o foco e em **orquestracao** (prompts + pipelines)
> mais do que em fine-tune do LLM. O LoRA aqui ajuda na qualidade dos prompts.

---

## 8. Avaliacao e Metricas de Qualidade

### 8.1 Benchmarks por Dominio

| Dominio       | Benchmark                | Metrica           | Meta Inicial |
|---------------|--------------------------|--------------------|-------------|
| Dev           | HumanEval, MBPP, SWE-bench | pass@1, resolve% | 70%+        |
| Escrita       | Avaliacao humana (user)  | Nota 1-5           | 4.0+        |
| Construcao    | Quiz OBC customizado     | Acuracia           | 80%+        |
| Medicina      | MedQA, PubMedQA          | Acuracia           | 75%+        |
| Direito       | Quiz CanLII customizado  | Acuracia           | 75%+        |
| Imagem        | FID score, user rating   | Qualidade          | 4.0+ user   |
| Video         | User rating              | Qualidade          | 3.5+ user   |
| Audio/Musica  | User rating              | Qualidade          | 3.5+ user   |

### 8.2 Pipeline de Avaliacao

```
[Novo LoRA treinado]
       |
       v
[Benchmark automatico] --> score < threshold? --> REJEITAR
       |
       v (score OK)
[A/B Test com versao anterior] --> pior? --> MANTER versao atual
       |
       v (melhor)
[Deploy para staging] --> user feedback por 7 dias
       |
       v (aprovado)
[Promover para producao]
```

---

## 9. Composicao de Skills

### 9.1 Tarefas Multi-Dominio

Muitas tarefas reais exigem multiplas skills simultaneamente:

| Tarefa                                    | Skills Necessarias           |
|-------------------------------------------|------------------------------|
| "Revise o README deste projeto"           | dev + writing                |
| "Analise riscos legais deste contrato de obra" | legal + construction    |
| "Crie um video explicando este remedio"   | medical + creative.video     |
| "Escreva um artigo tecnico sobre React"   | dev + writing                |
| "Gere imagens para documentacao de API"   | dev + creative.image         |

### 9.2 Estrategias de Composicao

| Estrategia         | Descricao                                       | Complexidade |
|--------------------|-------------------------------------------------|-------------|
| **Sequential**     | Executa uma skill por vez, passa contexto        | Baixa       |
| **LoRA Merging**   | Merge de 2+ LoRAs (ties-merging, DARE)          | Media       |
| **Multi-turn**     | Alterna LoRAs entre turnos da conversa           | Baixa       |
| **Ensemble**       | Gera com cada LoRA, combina respostas            | Alta        |
| **Router cascade** | Skill primaria gera, skill secundaria refina     | Media       |

### 9.3 LoRA Merging (Combinacao de Adapters)

```python
# Merge de LoRAs para tarefa hibrida (dev + writing)
from peft import PeftModel
import torch

# Carregar adapters
model_dev = PeftModel.from_pretrained(base_model, "loras/dev-python")
model_writing = PeftModel.from_pretrained(base_model, "loras/writing-ptbr")

# TIES-Merging com peso ajustavel
merged = ties_merge(
    adapters=[model_dev, model_writing],
    weights=[0.7, 0.3],  # 70% dev, 30% writing
    density=0.5
)
```

---

## 10. Desenvolvimento Progressivo de Skills

### 10.1 Niveis de Proficiencia

```
APPRENTICE (Aprendiz)       JOURNEYMAN (Oficial)        MASTER (Mestre)
    |                            |                           |
    | - Modelo base              | - LoRA fine-tuned         | - LoRA refinado
    | - Prompt engineering       | - MCP tools basicos       | - MCP tools avancados
    | - Skills de referencia     | - Avaliacao automatica    | - Auto-avaliacao
    | - Precisa supervisao       | - Semi-autonomo           | - Autonomo confiavel
    |                            |                           |
    | Benchmark: 50-69%          | Benchmark: 70-84%         | Benchmark: 85%+
```

### 10.2 Criterios de Progressao

| Transicao                | Criterios                                        |
|--------------------------|--------------------------------------------------|
| Apprentice -> Journeyman | Benchmark >= 70%, 100+ interacoes avaliadas      |
| Journeyman -> Master     | Benchmark >= 85%, 500+ interacoes, user approval |

### 10.3 Roadmap de Desenvolvimento por Skill

| Skill         | Fase 1 (Mes 1-2)    | Fase 2 (Mes 3-6)    | Fase 3 (Mes 7-12)   |
|---------------|----------------------|----------------------|----------------------|
| Dev           | Prompt + MCP tools   | LoRA code-specific   | Master + auto-debug  |
| Escrita       | Prompt + style guide | LoRA estilo pessoal  | Master + auto-review |
| Construcao    | Prompt + OBC lookup  | LoRA OBC/CSA         | Master + calculo     |
| Medicina      | Prompt + PubMed      | LoRA MedQA           | Journeyman (limite*) |
| Direito       | Prompt + CanLII      | LoRA legal-CA        | Journeyman (limite*) |
| Imagem        | Prompt engineering   | Pipeline ComfyUI     | Style-tuned prompts  |
| Video         | Prompt + ffmpeg      | Pipeline automatizado| Multi-modal gen      |
| Musica        | API integration      | Prompt refinado      | Custom generation    |

> (*) Medicina e Direito ficam limitados a Journeyman por seguranca.
> Nunca devem ser tratados como substitutos de profissionais licenciados.

---

## 11. Projetos Open-Source Relevantes

| Projeto          | Funcao                              | URL / Referencia            |
|------------------|-------------------------------------|-----------------------------|
| **vLLM**         | Serving com multi-LoRA              | github.com/vllm-project     |
| **SGLang**       | Runtime alternativo com LoRA        | github.com/sgl-project      |
| **LoRAX**        | Multi-LoRA serving (Predibase)      | github.com/predibase/lorax  |
| **PEFT**         | Biblioteca HuggingFace para LoRA    | github.com/huggingface/peft |
| **Axolotl**      | Framework de fine-tuning            | github.com/axolotl-ai       |
| **Unsloth**      | Fine-tuning 2-5x mais rapido       | github.com/unslothai        |
| **LitGPT**       | Fine-tuning simplificado            | github.com/Lightning-AI     |
| **MCP SDK**      | SDK oficial do Model Context Proto  | github.com/modelcontextprot |
| **ComfyUI**      | Pipeline visual para geracao img    | github.com/comfyanonymous   |
| **Open WebUI**   | Interface para LLMs locais          | github.com/open-webui       |
| **Mergekit**     | Merge de modelos e LoRAs            | github.com/arcee-ai         |
| **LM Harness**   | Avaliacao de modelos                | github.com/EleutherAI       |

---

## 12. Recomendacoes por Tier

### Tier 1 — Fundacao (Implementar Primeiro)

| Item                           | Prioridade | Esforco  |
|--------------------------------|------------|----------|
| Definir SKILL.md para cada dominio | CRITICA | 1 semana |
| Setup vLLM com multi-LoRA     | CRITICA    | 2-3 dias |
| Skill Router basico (keyword + classifier) | CRITICA | 1 semana |
| MCP servers: filesystem, git   | CRITICA    | 2-3 dias |
| Skill: Dev (prompt engineering + MCP) | ALTA  | 1 semana |
| Skill: Writing (prompt + style guide) | ALTA  | 3-5 dias |

### Tier 2 — Expansao (Mes 2-3)

| Item                           | Prioridade | Esforco   |
|--------------------------------|------------|-----------|
| Primeiro LoRA: dev-python      | ALTA       | 1-2 semanas |
| MCP servers: CanLII, PubMed   | ALTA       | 1 semana  |
| LoRA: writing-estilo-pessoal   | MEDIA      | 1-2 semanas |
| Pipeline de avaliacao automatica| ALTA      | 1 semana  |
| Skill: Construction (OBC lookup)| MEDIA     | 1 semana  |
| Skill: Legal (CanLII search)   | MEDIA      | 1 semana  |

### Tier 3 — Especializacao (Mes 4-6)

| Item                           | Prioridade | Esforco   |
|--------------------------------|------------|-----------|
| LoRA: legal-canadian           | MEDIA      | 2-3 semanas |
| LoRA: medical-general          | MEDIA      | 2-3 semanas |
| LoRA: construction-obc         | MEDIA      | 2-3 semanas |
| Composicao de skills (merging) | MEDIA      | 1-2 semanas |
| Pipeline criacao de imagem     | MEDIA      | 1-2 semanas |
| A/B testing de LoRAs           | MEDIA      | 1 semana  |

### Tier 4 — Maturidade (Mes 7-12)

| Item                           | Prioridade | Esforco   |
|--------------------------------|------------|-----------|
| Skill progression automatica   | BAIXA      | 2 semanas |
| Video generation pipeline      | BAIXA      | 2-3 semanas |
| Music/audio generation         | BAIXA      | 2 semanas |
| Auto-avaliacao de skills       | MEDIA      | 2 semanas |
| Dashboard de skills do Amazo   | BAIXA      | 1 semana  |

---

## 13. Consideracoes Finais

### Seguranca e Etica

- **Medicina e Direito** devem SEMPRE incluir disclaimers automaticos
- Nunca apresentar respostas medicas/legais como definitivas
- Manter logs de todas as respostas em dominios sensiveis
- O usuario deve poder desativar qualquer skill a qualquer momento

### Custos de Treinamento Estimados

| Recurso                  | Custo Estimado                     |
|--------------------------|------------------------------------|
| Fine-tune LoRA (70B)     | 4-8 horas em 2x A100 (~$20-40 cloud) |
| Fine-tune LoRA (8B)      | 1-2 horas em 1x RTX 4090 (local)  |
| Avaliacao por benchmark  | ~$5-10 em compute por rodada      |
| MCP server hosting       | Custo minimo (local)               |

### Arquitetura Final

```
[Usuario] --> [Interface] --> [Skill Router]
                                   |
                    +--------------+--------------+
                    |              |              |
               [LoRA Dev]    [LoRA Legal]   [LoRA Med]
                    |              |              |
               [MCP: git,     [MCP: CanLII, [MCP: PubMed,
                docker,        e-Laws]       DrugBank]
                npm]
                    |              |              |
                    +--------------+--------------+
                                   |
                            [Resposta + Disclaimer]
                                   |
                            [Evaluation Engine]
                                   |
                            [Feedback Loop]
```

---

> **Proximos passos**: Comecar pelo Tier 1 — definir os arquivos SKILL.md,
> configurar vLLM com multi-LoRA, e implementar o router basico.
> O primeiro LoRA a treinar deve ser o de desenvolvimento (dev.python),
> pois e o dominio com mais dados disponiveis e feedback imediato.
