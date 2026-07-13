# 04 — Modelos Locais: Ollama, Quantizacao, Benchmarks

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: quais modelos usar para cada tarefa?

---

## Correcao Importante

**RTX 4090 tem 24GB VRAM** (nao 48GB). Tanto RTX 3090 quanto 4090 compartilham 24GB.
A 4090 e ~1.5-2x mais rapida (Tensor cores 4a gen, bandwidth 1 TB/s vs 936 GB/s).

---

## 1. Runtimes / Servidores de Inferencia

### Ollama (RECOMENDADO para dev)
- Mais popular. v0.5.x. 112M+ model pulls para Llama 3.1
- 100+ modelos suportados
- API compativel com OpenAI (`/v1/chat/completions`, `/v1/embeddings`)
- Function calling com modelos compativeis (Llama 3.1+)
- GPU: NVIDIA compute 5.0+, AMD ROCm v7, Apple Metal

### vLLM (RECOMENDADO para producao)
- v0.17+ (marco 2026). PagedAttention otimizado
- 793 TPS peak vs 41 TPS do Ollama sob carga
- P99 latencia: 80ms vs 673ms do Ollama em pico
- **Quando usar**: 4-5+ usuarios simultaneos

### llama.cpp
- Engine C/C++ que alimenta o Ollama
- Formato GGUF: padrao de quantizacao
- Inferencia hibrida CPU+GPU

### LocalAI (ALTERNATIVA all-in-one)
- v3.11.0. API compativel com OpenAI + Anthropic
- 35+ backends. Multi-GPU. RAG built-in. TTS, ASR, image gen
- Bom quando voce quer um unico servidor cobrindo texto + visao + audio

### Outros
| Engine | Inovacao | Melhor para |
|--------|----------|-------------|
| **SGLang** | RadixAttention — cache de contexto compartilhado | Chatbots, RAG, multi-turn |
| **TensorRT-LLM** | Engine compilado NVIDIA | Maximo throughput em NVIDIA |
| **ExLlamaV2 / TabbyAPI** | EXL2 quantizacao state-of-art | Consumer GPU, LoRA switching |
| **LM Studio** | GUI + daemon `llmster` | Avaliacao de modelos, iniciantes |

**Estrategia**: Ollama para dev → vLLM ou SGLang para producao.

---

## 2. Melhores Modelos por Tarefa (24GB VRAM)

### Classificacao / Tagging (leve, rapido)
| Modelo | Params | VRAM (Q4_K_M) | Notas |
|--------|--------|---------------|-------|
| **Phi-4 Mini** | 3.8B | ~3 GB | Forte para tarefas estruturadas |
| **Gemma 3 4B** | 4B | ~3 GB | 140+ linguas |
| **Qwen 2.5-7B-Instruct** | 7B | ~5-6 GB | Excelente instruction following |
| **Llama 3.1-8B-Instruct** | 8B | ~5-6 GB | Forte geral |

### Embeddings → ver secao 5

### Sumarizacao
| Modelo | Params | VRAM (Q4_K_M) | Context | Notas |
|--------|--------|---------------|---------|-------|
| **Gemma 3 27B** | 27B | ~14 GB | 128K | Sobra 10GB para KV cache |
| **Qwen 2.5-32B** | 32B | ~20 GB | 128K | Melhor qualidade em 24GB |
| **Mistral Small 3.1** | 24B | ~14 GB | 128K | Apache 2.0, 150 tok/s |

### Extracao de Entidades
| Modelo | Params | VRAM (Q4_K_M) | Notas |
|--------|--------|---------------|-------|
| **Qwen3-30B-A3B** | 30B total / 3B ativo | ~5-6 GB | MoE — supera QwQ-32B com 10x menos params ativos |
| **Qwen 2.5-14B-Instruct** | 14B | ~9 GB | Forte em dados estruturados |

### Raciocinio Geral (melhor qualidade em 24GB)
| Modelo | Params | VRAM (Q4_K_M) | Notas |
|--------|--------|---------------|-------|
| **Qwen 2.5-32B-Instruct** | 32B | ~20 GB | Top qualidade |
| **DeepSeek-R1-Distill-32B** | 32B | ~20 GB | Comparavel a o1-mini; chain-of-thought |
| **Mistral Small 3.1** | 24B | ~14 GB | Forte geral, multimodal |

### Codigo
| Modelo | Params | VRAM (Q4_K_M) | Notas |
|--------|--------|---------------|-------|
| **Qwen 2.5-Coder-32B** | 32B | ~20 GB | 92.7% HumanEval. Campeao indiscutivel |

---

## 3. Modelos Especificos

### Familia Llama (Meta)
- **Llama 3.1-8B**: Workhorse para dev local. Rapido, capaz
- **Llama 4 Scout**: 109B total / 17B ativo (MoE, 16 experts). 10M tokens context. Multimodal
- **Llama 4 Maverick**: 400B/17B MoE. Precisa multi-GPU

### Familia DeepSeek
- **R1-Distill-7B**: ~5 GB Q4. Bom entry point para raciocinio
- **R1-Distill-14B**: ~9 GB Q4. 12GB minimo
- **R1-Distill-32B**: ~20 GB Q4. Comparavel a o1-mini
- **V3**: 671B MoE. Nao cabe em consumer GPU

### Familia Qwen (Alibaba)
- **Qwen 2.5-14B**: Sweet spot qualidade/velocidade (~9 GB Q4)
- **Qwen 2.5-32B**: Melhor dense em 24GB (~20 GB Q4)
- **Qwen 2.5-Coder-32B**: Melhor coding local
- **Qwen3-30B-A3B**: DESTAQUE — 30B total, 3B ativo, supera modelos dense de 32B

### Familia Phi (Microsoft)
- **Phi-4**: 14B. MMLU 84.8. Supera Gemini Pro 1.5 em math
- **Phi-4-reasoning**: 14B. Supera o1-mini em math/science PhD-level

### Familia Gemma (Google)
- **Gemma 3 27B**: 128K context. Multimodal. Otimo para sumarizacao
- **Gemma 4 31B**: Abril 2026. Multimodal nativo, reasoning mode, function calling

---

## 4. Trade-offs de Quantizacao

| Quant | Bits | Tamanho (7B) | Tamanho (32B) | Retencao | Melhor para |
|-------|------|-------------|---------------|----------|-------------|
| **FP16** | 16 | ~14 GB | ~64 GB | 100% | Referencia |
| **Q8_0** | 8 | ~7 GB | ~32 GB | ~99% | Near-lossless; reasoning |
| **Q6_K** | 6 | ~5.5 GB | ~25 GB | ~97-98% | Default para qualidade |
| **Q5_K_M** | 5 | ~4.7 GB | ~21 GB | ~96% | Minimo para reasoning/code |
| **Q4_K_M** | 4.5 | ~4.5 GB | ~20 GB | ~92-95% | **Sweet spot geral** |
| **Q3_K_M** | 3.5 | ~3.5 GB | ~16 GB | ~85-88% | Cliff de qualidade |
| **Q2_K** | 2.5 | ~2.8 GB | ~13 GB | ~70-80% | Emergencia apenas |

**Regras**:
- Classificacao/tagging: Q4_K_M funciona bem, ate Q3_K_M aceitavel
- Raciocinio/math: NUNCA abaixo de Q4_K_M. Preferir Q6_K ou Q8_0
- Embeddings: NAO quantizar abaixo de Q8
- Codigo: Q4_K_M minimo, Q5_K_M mais seguro

---

## 5. Modelos de Embedding Locais

| Modelo | Params | Dims | Context | vs ada-002 | VRAM |
|--------|--------|------|---------|------------|------|
| **nomic-embed-text v1.5** | 137M | 64-768 | 8192 | **Supera** at 512d | <1 GB |
| **mxbai-embed-large** | 335M | 1024 | 512 | **Supera** text-embedding-3-large | ~1 GB |
| **BGE-M3** | 568M | 1024 | 8192 | Comparavel | ~1.5 GB |

**Recomendacao default**: `nomic-embed-text` via Ollama. 768d, 8K context, supera ada-002, roda em CPU.

```bash
ollama pull nomic-embed-text
curl http://localhost:11434/v1/embeddings -d '{"model": "nomic-embed-text", "input": "Seu texto"}'
```

---

## 6. Fine-Tuning Local

### QLoRA em Consumer GPU

| Modelo | Metodo | VRAM | Tempo | GPU |
|--------|--------|------|-------|-----|
| 7-8B | QLoRA (4-bit) | 8-10 GB | ~1-2h | RTX 3090/4090 |
| 13-14B | QLoRA (4-bit) | 12-16 GB | ~2-4h | RTX 3090/4090 |
| 32B | QLoRA (4-bit) | 20-24 GB | ~4-6h | RTX 4090 (apertado) |

### Ferramentas

| Ferramenta | Destaque | Melhor para |
|------------|----------|-------------|
| **Unsloth** | 2x mais rapido, 70% menos VRAM. GTX 1070 ate H100 | INICIO. Mais simples |
| **Axolotl** | Mais configuravel. RLHF/RLVR pipelines. YAML configs | Multi-GPU, pipelines complexos |
| **PEFT** (HuggingFace) | Biblioteca base. LoRA/QLoRA standard | Custom training loops |

### Dataset
- Formato: JSONL com `instruction`/`input`/`output` ou `messages` array
- Tamanho: 1.000-10.000 exemplos de alta qualidade geralmente suficiente
- **Qualidade > Quantidade**: 1.000 exemplos limpos > 100.000 ruidosos

---

## Setup Recomendado para RTX 3090/4090

| Tarefa | Modelo | Quant | VRAM | Runtime |
|--------|--------|-------|------|---------|
| Classificacao/tagging | Qwen3-30B-A3B ou Phi-4 Mini | Q4_K_M | 5-6 GB | Ollama |
| Embeddings | nomic-embed-text v1.5 | FP16 | <1 GB | Ollama |
| Sumarizacao | Qwen 2.5-32B ou Gemma 3 27B | Q4_K_M | 14-20 GB | Ollama |
| Extracao de entidades | Qwen3-30B-A3B ou Qwen 2.5-14B | Q4_K_M | 5-9 GB | Ollama |
| Raciocinio geral | DeepSeek-R1-Distill-32B | Q4_K_M | ~20 GB | Ollama |
| Codigo | Qwen 2.5-Coder-32B | Q4_K_M | ~20 GB | Ollama |
| Fine-tuning 7B-14B | Qualquer base acima | QLoRA 4-bit | 8-16 GB | Unsloth |

**Nota**: Modelos menores podem rodar simultaneamente (embedding + classificacao < 7 GB). Modelos 32B consomem quase toda a VRAM — rodar um de cada vez.

---

## Proximos Passos (decisao do Cris)

1. Qual GPU vai comprar para o servidor? RTX 3090 (usada, mais barata) ou 4090?
2. Qwen como familia principal? (domina em quase todas as categorias)
3. Testar Ollama + nomic-embed-text + Qwen3-30B-A3B no notebook como POC?
