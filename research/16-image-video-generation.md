# 16 — Geracao de Imagens, Videos e Audio IA Local

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: quais ferramentas instalar primeiro?

---

## Visao Geral

```
                    GERACAO DE MIDIA LOCAL (24GB VRAM)
                    ==================================

  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │   IMAGEM     │  │    VIDEO     │  │    AUDIO     │  │     3D       │
  │              │  │              │  │              │  │              │
  │ FLUX.2 dev   │  │ Wan 2.2      │  │ ACE-Step 1.5 │  │ TripoSR     │
  │ SDXL         │  │ HunyuanVideo │  │ Fish Speech  │  │ InstantMesh  │
  │ CHROMA       │  │ CogVideoX    │  │ Kokoro       │  │              │
  │              │  │ LTX Video    │  │ Piper        │  │              │
  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
         │                 │                 │                 │
         └────────┬────────┴────────┬────────┘                 │
                  │                 │                           │
           ┌──────▼──────┐  ┌──────▼──────┐            ┌──────▼──────┐
           │  ComfyUI    │  │  Forge/     │            │  ComfyUI    │
           │  (nodes)    │  │  Fooocus    │            │  (nodes)    │
           └─────────────┘  └─────────────┘            └─────────────┘
```

---

## 1. GERACAO DE IMAGENS

### Modelos para 24GB VRAM

| Modelo | Params | VRAM (fp16) | VRAM (fp8/nf4) | Qualidade | Licenca |
|--------|--------|-------------|----------------|-----------|---------|
| **FLUX.2 dev** | ~12B | ~24 GB | ~12 GB (fp8) | Top tier | Non-commercial |
| **FLUX.1 dev** | ~12B | ~24 GB | ~12 GB (fp8) | Muito boa | Non-commercial |
| **FLUX.1 schnell** | ~12B | ~24 GB | ~12 GB (fp8) | Boa (4 steps) | Apache 2.0 |
| **Stable Diffusion 3.5 Large** | ~8B | ~18 GB | ~10 GB | Boa | Stability Community |
| **SDXL** | ~6.6B | ~7 GB | ~5 GB | Boa (madura) | CreativeML Open RAIL-M |
| **CHROMA** | ~12B | ~24 GB | ~12 GB (fp8) | Excelente | Varia |
| **Playground v3** | ~? | ~16 GB | ~10 GB | Muito boa (estetica) | Playground |
| **PixArt-Sigma** | ~0.6B | ~4 GB | ~3 GB | Boa (leve) | Apache 2.0 |

### Detalhes dos Modelos

**FLUX.2 dev (Black Forest Labs)**:
- Sucessor do FLUX.1. Transformer-based (DiT architecture)
- Melhor prompt following da categoria
- fp8 quantization reduz VRAM para ~12GB sem perda significativa
- NF4 quantization (~8GB) para uso com outros modelos simultaneamente
- **RECOMENDADO** para qualidade maxima em 24GB

**FLUX.1 schnell**:
- Mesma arquitetura, mas destilado para 1-4 steps
- 10x mais rapido que dev. Ideal para previews rapidos
- Apache 2.0 — uso comercial livre
- **RECOMENDADO** para iteracao rapida

**SDXL (Stability AI)**:
- Ecossistema mais maduro. Milhares de LoRAs, ControlNets, checkpoints
- 7GB VRAM — cabe facil, roda rapido
- Ainda relevante por causa do ecossistema
- **RECOMENDADO** como workhorse acessivel

**Stable Diffusion 3.5 Large**:
- MMDiT architecture. Melhora em text rendering e anatomia
- Ecossistema de LoRAs menor que SDXL

**CHROMA**:
- Fork community do SD3 com melhorias em cores e consistencia
- Requer verificacao de disponibilidade e licenca

**PixArt-Sigma**:
- Extremamente leve (~600M params). Roda ate em CPU
- Bom para tarefas simples e prototipagem

### Interfaces / UIs

| Interface | Tipo | Melhor para | Complexidade |
|-----------|------|-------------|-------------|
| **ComfyUI** | Node-based | Workflows complexos, automacao, video | Alta |
| **Forge** | WebUI (fork A1111) | Uso diario, LoRA switching | Media |
| **Fooocus** | Simples | Iniciantes, uso rapido | Baixa |
| **InvokeAI** | Profissional | Canvas painting, inpainting | Media |
| **Draw Things** | iOS/macOS | Mobile | Baixa |

**ComfyUI** (RECOMENDADO):
- Node-based workflow. Totalmente programavel
- Workflows exportaveis como JSON — versionaveis no git
- Suporte nativo para FLUX, SDXL, video generation, audio
- **ComfyUI Manager**: instala nodes/modelos automaticamente
- API HTTP para automacao (integravel com Amazo)
- Docker: `ghcr.io/ai-dock/comfyui:latest`

**Forge** (RECOMENDADO como alternativa simples):
- Fork otimizado do Automatic1111
- Menos VRAM que A1111 (~2GB menos para mesmos modelos)
- Interface familiar para quem vem do Stable Diffusion

### LoRA Training (Estilo Pessoal)

| Ferramenta | Melhor para | Dificuldade |
|------------|-------------|-------------|
| **Kohya-ss** | SDXL e FLUX LoRAs. GUI + CLI | Media |
| **ai-toolkit (Ostris)** | FLUX LoRAs especificamente | Media |
| **SimpleTuner** | Multi-modelo, multi-GPU | Alta |
| **LoRA-Easy-Training-Scripts** | Wrapper amigavel do Kohya | Baixa |

**Recomendacoes de training**:
- 15-30 imagens de alta qualidade (512x512 ou 1024x1024)
- Captions descritivos com trigger word unica
- SDXL LoRA: ~30 min na RTX 4090, ~4GB VRAM
- FLUX LoRA: ~1-2h na RTX 4090, ~16GB VRAM
- Rank 16-32 para estilos, rank 64-128 para conceitos

### Controle e Composicao

| Tecnica | O que faz | VRAM extra |
|---------|-----------|------------|
| **ControlNet** | Controla pose, edges, depth, normals | ~1-2 GB |
| **IP-Adapter** | Transfere estilo de imagem referencia | ~1-2 GB |
| **Inpainting** | Edita regiao especifica da imagem | Mesmo modelo |
| **Outpainting** | Expande imagem alem das bordas | Mesmo modelo |
| **InstantID** | Face swapping / face consistency | ~2 GB |
| **Regional Prompting** | Prompts diferentes por regiao | Minimo |

### Otimizacao de VRAM

| Tecnica | Economia | Impacto na qualidade |
|---------|----------|---------------------|
| **fp8** (FLUX) | ~50% | Minimo |
| **NF4** (FLUX) | ~70% | Leve |
| **Model offloading** | Usa RAM como overflow | Mais lento |
| **Tiled VAE** | Processa em tiles, menos VRAM | Nenhum |
| **Attention slicing** | Trade speed por VRAM | Mais lento |
| **GGUF quantization** | Varia | Varia |

---

## 2. GERACAO DE VIDEO

### Modelos para 24GB VRAM

| Modelo | Resolucao | Duracao | VRAM | FPS | Qualidade |
|--------|-----------|---------|------|-----|-----------|
| **Wan 2.2** (Alibaba) | 720p | 5-10s | 12-20 GB | 16 | Excelente |
| **HunyuanVideo 1.5** (Tencent) | 720p | 5s | 20-24 GB | 24 | Top tier |
| **CogVideoX-5B** (Zhipu) | 720p | 6s | ~18 GB | 8 | Boa |
| **LTX Video** (Lightricks) | 768p | 5s | ~12 GB | 24 | Boa (rapido) |
| **Open-Sora 1.2** | 720p | 2-16s | ~20 GB | 24 | Razoavel |
| **Mochi 1** (Genmo) | 480p | 5s | ~16 GB | 30 | Boa (motion) |

### Detalhes

**Wan 2.2 (Alibaba)**:
- Text-to-video E image-to-video
- Melhor relacao qualidade/VRAM
- Modelos: 1.3B (rapido, ~6GB) e 14B (qualidade, ~20GB)
- Suporta camera control, subject-driven generation
- Apache 2.0
- **RECOMENDADO** como principal

**HunyuanVideo 1.5 (Tencent)**:
- Qualidade comparavel a Sora em cenas simples
- Requer quase toda a VRAM (24GB)
- Image-to-video excelente
- Tencent Community License

**LTX Video (Lightricks)**:
- Mais rapido da categoria (~12GB)
- Bom para iteracao rapida e previews
- MIT License

**CogVideoX-5B**:
- Versao 5B cabe em 24GB. Versao 2B para testes rapidos
- Strong motion coherence

### Workflows em ComfyUI

ComfyUI e o hub central para video generation:
- **WanVideoWrapper**: Nodes nativos para Wan 2.1/2.2
- **ComfyUI-HunyuanVideoWrapper**: Nodes para HunyuanVideo
- **ComfyUI-CogVideoXWrapper**: Nodes para CogVideoX
- Workflows combinaveis: text→image (FLUX) → image→video (Wan) → upscale (Real-ESRGAN)

### Frame Interpolation e Upscaling

| Ferramenta | Funcao | VRAM |
|------------|--------|------|
| **RIFE** | Frame interpolation (24→60fps) | ~2 GB |
| **Real-ESRGAN** | Upscaling 2x-4x | ~2 GB |
| **FILM** (Google) | Frame interpolation | ~4 GB |
| **VideoGigaGAN** | Video super-resolution | ~12 GB |

Pipeline tipico:
```
Prompt → Wan 2.2 (720p, 16fps, 5s) → RIFE (16→30fps) → Real-ESRGAN (720p→1440p)
```

---

## 3. AUDIO E MUSICA

### Text-to-Speech (TTS)

| Modelo | Qualidade | Velocidade | VRAM | Voice Cloning | Licenca |
|--------|-----------|------------|------|---------------|---------|
| **Fish Speech 1.5** | Excelente | Rapido | ~2 GB | SIM (15s sample) | Apache 2.0 |
| **Kokoro** | Muito boa | Muito rapido | <1 GB | NAO (vozes pre-built) | Apache 2.0 |
| **Piper** | Boa | Extremamente rapido | CPU only | NAO | MIT |
| **XTTS v2** (Coqui) | Muito boa | Medio | ~4 GB | SIM (6s sample) | MPL 2.0 |
| **StyleTTS 2** | Natural | Medio | ~2 GB | SIM | MIT |

**Fish Speech 1.5** (RECOMENDADO):
- Voice cloning com apenas 15 segundos de audio
- Multilingue (en, pt, es, zh, ja, ko, etc.)
- Streaming mode para low latency
- Ideal para dar voz ao Amazo

**Kokoro** (RECOMENDADO para velocidade):
- Ultra-leve, roda em CPU
- Vozes pre-definidas de alta qualidade
- Ideal para notificacoes, leitura de textos

### Speech-to-Text (STT)

| Modelo | Velocidade vs Whisper | VRAM | WER (en) | Diarization |
|--------|----------------------|------|----------|-------------|
| **faster-whisper large-v3** | 4x mais rapido | ~3 GB | 5.5% | Via pyannote |
| **WhisperX** | 70x real-time | ~3 GB | ~6% | Built-in |
| **whisper.cpp** | CPU otimizado | CPU | ~6% | Nao |
| **Moonshine** (Useful Sensors) | Ultra-rapido, streaming | <1 GB | ~7% | Nao |

**faster-whisper** ja documentado em `03-ingestion-pipeline.md`. Continua RECOMENDADO.

### Geracao de Musica

| Modelo | Duracao | VRAM | Qualidade | Controle |
|--------|---------|------|-----------|----------|
| **ACE-Step 1.5** | ~3 min | ~8 GB | Boa | Lyrics + style tags |
| **MusicGen** (Meta) | 30s | ~4 GB | Boa | Text prompt |
| **Stable Audio Open** | 47s | ~6 GB | Boa | Text prompt |
| **AudioCraft** (Meta) | 30s | ~4 GB | Boa | Text/melody conditioning |

**ACE-Step 1.5** (RECOMENDADO):
- Gera musica com letra (lyrics-conditioned)
- Ate ~3 minutos de duracao
- Style tags para controlar genero, BPM, instrumentos
- Ideal para o Amazo criar trilhas personalizadas

---

## 4. GERACAO 3D (BONUS)

| Modelo | Input | Output | VRAM | Tempo |
|--------|-------|--------|------|-------|
| **TripoSR** (Stability + Tripo) | 1 imagem | Mesh 3D | ~6 GB | ~1s |
| **InstantMesh** | 1-4 imagens | Mesh 3D | ~8 GB | ~10s |
| **Shap-E** (OpenAI) | Texto ou imagem | Mesh 3D | ~4 GB | ~15s |
| **Zero123++** | 1 imagem | Multi-view | ~6 GB | ~30s |

Relevancia para o Segundo Cerebro: baixa no curto prazo, mas util para:
- Visualizacao 3D do mapa mental/cerebro
- Prototipagem de projetos de construcao
- Assets para apresentacoes

---

## 5. DEPLOYMENT COM DOCKER

### ComfyUI (hub central)

```yaml
services:
  comfyui:
    image: ghcr.io/ai-dock/comfyui:latest
    ports:
      - "8188:8188"
    volumes:
      - ./comfyui-models:/opt/ComfyUI/models
      - ./comfyui-output:/opt/ComfyUI/output
      - ./comfyui-workflows:/opt/ComfyUI/user/workflows
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - CLI_ARGS=--listen 0.0.0.0 --port 8188
```

### Fish Speech

```yaml
services:
  fish-speech:
    image: fishaudio/fish-speech:latest
    ports:
      - "8080:8080"
    volumes:
      - ./fish-models:/root/.cache/fish-speech
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

### Organizacao de Storage

```
/data/cerebro/generated/
├── images/
│   ├── 2026-04/
│   │   ├── img_20260411_001.png
│   │   └── img_20260411_001_metadata.json  ← prompt, model, seed, params
│   └── loras/
│       ├── style-cris-v1/
│       └── concept-cerebro-v1/
├── videos/
│   ├── 2026-04/
│   └── workflows/  ← ComfyUI JSONs
├── audio/
│   ├── tts/
│   ├── music/
│   └── voice-clones/
└── 3d/
    └── meshes/
```

Cada asset gerado deve ter metadata JSON associado contendo:
- Prompt usado
- Modelo e versao
- Seed (para reproducibilidade)
- Parametros (CFG, steps, sampler, scheduler)
- Timestamp
- Tags geradas por AI

---

## 6. Integracao com o Amazo

### Fluxo

```
Usuario pede "cria uma imagem do meu escritorio ideal"
    │
    ▼
Amazo (Skill Router) → detecta skill "image_creation"
    │
    ▼
Amazo → gera prompt detalhado (positive + negative)
    │
    ▼
ComfyUI API → POST /prompt com workflow JSON
    │
    ▼
FLUX.2 dev → gera imagem
    │
    ▼
Amazo → salva com metadata → indexa no PostgreSQL → embedding CLIP
    │
    ▼
Imagem disponivel na interface + buscavel semanticamente
```

### API do ComfyUI

```python
import requests
import json

def generate_image(prompt, workflow_path, server="http://localhost:8188"):
    with open(workflow_path) as f:
        workflow = json.load(f)

    # Injeta prompt no node correto
    workflow["6"]["inputs"]["text"] = prompt

    response = requests.post(f"{server}/prompt", json={"prompt": workflow})
    return response.json()["prompt_id"]
```

---

## Recomendacoes por Tier

### Tier 1: Obrigatorio (Dia 1)
1. ComfyUI como hub central de geracao
2. FLUX.1 schnell para testes rapidos (Apache 2.0)
3. faster-whisper para STT (ja decidido em doc 03)
4. Kokoro para TTS basico (leve, CPU)

### Tier 2: Fortemente Recomendado (Mes 1)
5. FLUX.2 dev (fp8) para qualidade maxima de imagem
6. SDXL para acesso ao ecossistema de LoRAs
7. Wan 2.2 (1.3B) para video generation
8. Fish Speech para voice cloning do Amazo
9. Kohya-ss para treinar LoRAs pessoais

### Tier 3: Best Practice (Mes 2-3)
10. Wan 2.2 (14B) para video de alta qualidade
11. HunyuanVideo 1.5 para cenarios complexos
12. ACE-Step para geracao de musica
13. ControlNet + IP-Adapter para controle fino
14. RIFE + Real-ESRGAN para upscaling
15. LoRA de estilo pessoal treinada com obras do Cris

### Tier 4: Exploratorio
16. TripoSR para geracao 3D
17. InstantID para face consistency
18. Pipeline automatizado: prompt → imagem → video → audio

---

## Proximos Passos (decisao do Cris)

1. Instalar ComfyUI como primeiro servico de geracao?
2. FLUX.2 dev como modelo principal de imagem?
3. Prioridade: imagem primeiro, video depois, audio por ultimo?
4. Treinar LoRA pessoal com que tipo de conteudo?
