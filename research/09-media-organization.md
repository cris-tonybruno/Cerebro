# 09 — Media Processing Pipelines

> Status: PESQUISA COMPLETA · Abril 2026
> Tema: Como ingerir, processar, buscar e conectar video, audio, imagem e texto/documentos no Segundo Cerebro

---

## Visao Geral

O documento `03-ingestion-pipeline.md` cobre COMO capturar dados de fontes diversas.
Este documento cobre o proximo passo: **como PROCESSAR cada tipo de midia** para que se torne
conhecimento pesquisavel, conectavel e util para o Segundo Cerebro.

```
MIDIA RAW (video, audio, imagem, documento)
                |
                v
    PIPELINE DE PROCESSAMENTO POR TIPO
    - Video  → transcricao + keyframes + cenas + resumo
    - Audio  → transcricao + diarizacao + classificacao + resumo
    - Imagem → OCR + descricao + EXIF + embeddings CLIP
    - Texto  → parsing + chunking + entidades + embeddings
                |
                v
    REPRESENTACAO UNIFICADA
    - Bloco de conhecimento (metadados + texto + embedding)
    - Armazenado em PostgreSQL + pgvector
    - Pesquisavel por texto, semantica, e cross-modal
                |
                v
    BUSCA UNIFICADA ACROSS ALL MEDIA
    - "Achar a foto daquela reuniao onde falamos de X"
    - "O que eu disse naquele audio de voz semana passada?"
    - "Mostrar todos os documentos sobre o projeto Y"
```

---

## 1. Pipeline de Video

### 1.1 Arquitetura Geral

```
Video (MP4/MKV/WebM)
    |
    ├─> FFmpeg ──> Audio track ──> faster-whisper ──> Transcricao timestamped
    |
    ├─> PySceneDetect ──> Deteccao de cenas ──> Timestamps de cortes
    |
    ├─> FFmpeg (keyframes) ──> Frames PNG ──> Vision LLM ──> Descricao visual
    |
    ├─> yt-dlp ──> Metadados (titulo, canal, descricao, tags, thumbnails)
    |
    └─> LLM ──> Resumo do video (baseado em transcricao + descricoes visuais)
```

### 1.2 Extracao de Audio e Transcricao

**FFmpeg para extrair audio:**
```bash
ffmpeg -i video.mp4 -ac 1 -ar 16000 -f wav audio.wav
```
- Mono (`-ac 1`), 16kHz (`-ar 16000`) — formato ideal para Whisper

**faster-whisper para transcricao:**
- CTranslate2-based, **4x mais rapido** que Whisper original com mesma acuracia
- Output: segmentos com timestamps `[00:01:23 -> 00:01:45] "texto aqui"`
- Suporte a 99+ idiomas
- WhisperX vai alem: batched inference com 60-70x velocidade real, word-level timestamps, VAD, diarizacao via pyannote

**Referencia no projeto:** ja coberto em `03-ingestion-pipeline.md` secao 6

### 1.3 Deteccao de Cenas e Keyframes

**PySceneDetect:**
- Biblioteca Python + OpenCV para deteccao de cortes/transicoes em video
- Dois metodos principais:
  - `detect-content`: compara frames sequenciais (mudanca de conteudo). Bom para cortes rapidos
  - `detect-threshold`: compara cada frame contra nivel de preto. Bom para fades
- **94.7% de acuracia** em test sets padrao
- Mantido ativamente desde 2014, usado em producao por grandes empresas
- MIT license

**Uso programatico:**
```python
from scenedetect import detect, ContentDetector
scene_list = detect('video.mp4', ContentDetector())
# Retorna lista de pares (start_timecode, end_timecode)
```

**Extracao de keyframes com FFmpeg:**
```bash
# Extrair 1 frame por cena detectada
ffmpeg -i video.mp4 -vf "select=eq(pict_type\,I)" -fps_mode passthrough frame_%04d.png

# Ou a cada N segundos
ffmpeg -i video.mp4 -vf "fps=1/30" frame_%04d.png  # 1 frame a cada 30s
```

### 1.4 Analise Visual de Frames (Vision LLMs)

Cada keyframe extraido pode ser analisado por um Vision LLM local:

| Modelo | Params | RAM | Melhor Para |
|--------|--------|-----|-------------|
| **Moondream** | 1.86B | ~2GB | Edge devices, velocidade maxima |
| **Qwen2.5-VL-3B** | 3B | ~4GB | Bom equilibrio custo/qualidade |
| **Qwen2.5-VL-7B** | 7B | ~8GB | Melhor qualidade, mais descritivo |
| **LLaVA 1.5** | 7-13B | 8-16GB | Maior acuracia, mais pesado |

**Qwen2.5-VL-3B** — melhor custo-beneficio para batch processing:
- 126,650 imagens captionadas por dolar em RTX 4080
- **98.4% mais barato** que rodar o mesmo volume na OpenAI
- Roda local via Ollama: `ollama run qwen2.5-vl:3b`

**Pipeline de descricao:**
```
Keyframe → Vision LLM → "Uma sala de reuniao com 4 pessoas,
                          quadro branco com diagrama de arquitetura,
                          laptop aberto mostrando codigo Python"
```

### 1.5 Sumarizacao de Video com AI

**WhisperFrame** — toolkit que combina Whisper + extracao de frames:
- Audio extraction via FFmpeg
- Transcricao via Whisper
- Frame extraction com taxa configuravel
- Output em .txt, .vtt, .srt, .json

**Pipeline de sumarizacao:**
```
1. Transcricao completa (faster-whisper)
2. Descricoes visuais dos keyframes (Vision LLM)
3. Merge: transcricao + descricoes visuais + metadados
4. LLM de sumarizacao: gera resumo estruturado, topicos, action items
```

**Ferramentas open-source para sumarizacao:**
- `martinopiaggi/summarize`: YouTube, Instagram, TikTok, Twitter, Reddit, Facebook, Google Drive, local files. Funciona com qualquer LLM compativel com OpenAI API (incluindo Ollama local)
- `sidedwards/ai-video-summarizer`: WhisperX + LLM para transcricao e resumo
- Suporte a Ollama local: llama3, mistral, deepseek — escolher por velocidade/acuracia/tamanho

### 1.6 yt-dlp: Download e Metadados

**Arquitetura do yt-dlp:**
- Pipeline: `extract_info()` → InfoExtractors por plataforma → `info_dict` padronizado
- `info_dict` contem: titulo, canal, descricao, tags, thumbnails, duracao, formato, idioma, legendas
- Post-processing: merge de streams, embedding de metadados, escrita de thumbnails
- Suporta 1000+ sites

**Uso para o Segundo Cerebro:**
```bash
# Download + metadados + legendas
yt-dlp --write-info-json --write-thumbnail --write-auto-sub \
       --sub-lang pt,en --convert-subs srt \
       -o "%(upload_date)s_%(title)s.%(ext)s" URL

# So metadados (sem baixar video)
yt-dlp --write-info-json --skip-download URL
```

### 1.7 Estrategia de Storage para Video

**Decisao critica: guardar originais ou so metadata + transcricao + keyframes?**

**Opcao A — So metadata (ECONOMICO):**
- Transcricao completa timestamped (.json)
- Keyframes como imagens (.webp, qualidade 80%)
- Descricoes visuais dos keyframes
- Metadados completos (info_dict do yt-dlp)
- Link para o original (URL ou path)
- **Tamanho**: ~1-5 MB por video vs 500 MB-5 GB do original

**Opcao B — Proxy + metadata (EQUILIBRADO):**
- Tudo de Opcao A
- Proxy em 720p H.264 (1/3 do tamanho do original)
- Bom para re-visualizar trechos sem voltar ao original

**Opcao C — Original + metadata (COMPLETO):**
- Tudo de Opcao B
- Original em resolucao maxima
- Cold storage para originais antigos (HDD barato)
- Projetos ativos em SSD

**Recomendacao para o Segundo Cerebro:**
- **Fase 1**: Opcao A (so metadata). Economiza espaco, maximo de conhecimento pesquisavel
- **Videos proprios** (gravacoes pessoais, meetings): Opcao C (manter original em cold storage)
- **Videos de terceiros** (YouTube, cursos): Opcao A (sempre re-baixavel)
- Regra: **metadata e SEMPRE extraida e armazenada, independente do original**

### 1.8 Busca em Video: Transcricoes Indexadas por Timestamp

**Formato de armazenamento:**
```json
{
  "video_id": "abc123",
  "source": "youtube",
  "title": "Talk sobre arquitetura de microsservicos",
  "segments": [
    {
      "start": 63.5,
      "end": 78.2,
      "text": "O padrao event sourcing resolve esse problema...",
      "speaker": "Speaker_1",
      "embedding": [0.123, -0.456, ...]
    }
  ],
  "keyframes": [
    {
      "timestamp": 65.0,
      "path": "/media/keyframes/abc123_0065.webp",
      "description": "Slide com diagrama de event sourcing",
      "embedding_clip": [0.789, -0.012, ...]
    }
  ],
  "summary": "...",
  "topics": ["event sourcing", "microsservicos", "CQRS"]
}
```

**Busca por timestamp:**
- Query: "event sourcing" → encontra segmento em 1:03 → link direto para momento do video
- Cada segmento tem seu proprio embedding para busca semantica

---

## 2. Pipeline de Audio

### 2.1 Arquitetura Geral

```
Audio (MP3/WAV/M4A/FLAC/OGG)
    |
    ├─> YAMNet/PANNs ──> Classificacao (fala, musica, ruido, ambiente)
    |
    ├─> faster-whisper ──> Transcricao
    |
    ├─> pyannote-audio ──> Speaker diarization (quem falou quando)
    |
    ├─> WhisperX ──> Transcricao + diarizacao + alignment word-level (all-in-one)
    |
    └─> LLM ──> Resumo, action items, topicos-chave
```

### 2.2 Transcricao e Diarizacao

**WhisperX (melhor opcao all-in-one):**
- Base: faster-whisper com batched inference
- **4.8% WER** vs 12.5% do Whisper vanilla (word error rate)
- **0.25 RTF** em A100 (4x speedup via batching + VAD)
- Diarizacao integrada via pyannote.audio
- Word-level timestamps via forced alignment
- GitHub: `m-bain/whisperX`

**pyannote-audio 4.0 (diarizacao estado-da-arte):**
- Deep neural network para identificacao de speakers
- Pipeline de 3 modelos especializados:
  1. **VAD** (Voice Activity Detection): detecta fala vs silencio
  2. **Speaker Embedding Extraction**: gera vetores que capturam caracteristicas da voz
  3. **Clustering**: agrupa embeddings — cada cluster = 1 speaker unico
- Funciona com ruido de fundo e fala sobreposta
- Requer token do Hugging Face (modelo gratuito para uso pessoal)
- GitHub: `pyannote/pyannote-audio`

**Output combinado (WhisperX):**
```
[00:00:15 -> 00:00:32] Speaker_1: "Eu acho que deveriamos mudar a arquitetura..."
[00:00:33 -> 00:00:45] Speaker_2: "Concordo, mas o timeline esta apertado"
[00:00:46 -> 00:01:10] Speaker_1: "Podemos fazer em duas fases..."
```

### 2.3 Classificacao de Audio

**YAMNet (Yet Another Audio MobileNet Network):**
- 521 classes de eventos de audio (AudioSet corpus)
- Arquitetura MobileNet_v1 (leve)
- Input: mono 16kHz, float32 [-1.0, 1.0]
- Uso: classificar tipo de audio ANTES de decidir pipeline
- TensorFlow Hub

**PANNs (Pre-trained Audio Neural Networks):**
- Treinados no AudioSet dataset (larga escala)
- Extraem features de audio generalizaveis
- Bom para classificacao customizada

**pyAudioAnalysis:**
- Biblioteca Python para feature extraction, classificacao e segmentacao
- Mais classico, menos deep learning

**Pipeline de decisao:**
```
Audio chegou
    |
    ├─> YAMNet classifica: "speech" → pipeline de transcricao
    ├─> YAMNet classifica: "music"  → metadata + fingerprinting
    ├─> YAMNet classifica: "noise"  → descarta ou arquiva
    └─> YAMNet classifica: misto    → segmenta e processa cada parte
```

### 2.4 Podcast e Meeting Processing

**Pipeline completo para podcasts/meetings:**
```
1. Classificacao (YAMNet): confirmar que e fala
2. Transcricao + diarizacao (WhisperX): quem disse o que, quando
3. Post-processing LLM:
   - Resumo executivo (3-5 bullet points)
   - Topicos discutidos
   - Action items (com responsavel, se identificado)
   - Decisoes tomadas
   - Perguntas em aberto
4. Armazenamento: transcript full + resumo + metadata
```

**Formato de output:**
```json
{
  "type": "meeting",
  "date": "2026-04-10",
  "duration": "45:23",
  "speakers": ["Cris", "Speaker_2"],
  "transcript": [...],
  "summary": "Reuniao sobre redesign do pipeline de ingestao...",
  "action_items": [
    {"owner": "Cris", "task": "Testar n8n local", "deadline": null}
  ],
  "topics": ["pipeline", "n8n", "ingestao"],
  "decisions": ["Usar n8n para Fase 1"]
}
```

### 2.5 Voice Notes do Celular

**Workflow:**
```
Celular (gravacao de voz)
    |
    Syncthing (sync automatico para servidor)
    |
    File watcher (watchdog) detecta novo .m4a/.ogg
    |
    faster-whisper → transcricao
    |
    LLM → classificar tipo (ideia, lembrete, reflexao, tarefa)
         → extrair entidades e tags
         → conectar com blocos existentes
    |
    Bloco de conhecimento no banco
```

**Tendencia 2025-2026:**
- Voice notes estao evoluindo de "gravacao" para "brain dump" — o valor emerge da web acumulada de pensamentos conectados, nao do transcript individual
- Ferramentas como Voicenotes e Plaud Note constroem knowledge graphs a partir de audio
- O Segundo Cerebro pode fazer isso localmente com faster-whisper + LLM + pgvector

---

## 3. Pipeline de Imagens

### 3.1 Arquitetura Geral

```
Imagem (JPG/PNG/WebP/HEIC)
    |
    ├─> Classificacao: screenshot vs foto vs scan vs diagrama
    |
    ├─> EXIF extractor ──> Data, localizacao, camera, orientacao
    |
    ├─> OCR (PaddleOCR/Tesseract) ──> Texto na imagem
    |
    ├─> Vision LLM (Qwen-VL/Moondream) ──> Descricao semantica
    |
    ├─> CLIP encoder ──> Embedding multimodal (busca por texto)
    |
    ├─> Face detection (DeepFace/InsightFace) ──> Rostos identificados
    |
    └─> LLM ──> Tags, categoria, conexoes com blocos existentes
```

### 3.2 OCR: Extracao de Texto de Imagens

**PaddleOCR (RECOMENDADO):**
- Pipeline completa: text detection → recognition
- PP-OCRv5 (maio 2025): alta acuracia
- PaddleOCR-VL (outubro 2025): combina vision encoder + LLM para OCR end-to-end
- 100+ idiomas
- Significativamente melhor que Tesseract em layouts complexos
- GitHub: `PaddlePaddle/PaddleOCR`

**Tesseract (alternativa mais leve):**
- Motor OCR mais estabelecido (originalmente HP, mantido por Google)
- 100+ idiomas
- Fraco em: caligrafia, layouts complexos, tabelas
- Precisa de preprocessamento (deskew, denoise via OpenCV)
- Bom como fallback rapido

**Evolucao 2025: OCR com Vision-Language Models:**
- A grande mudanca: de pipelines separadas (detect → recognize → layout) para VLMs end-to-end
- Um VLM pega a imagem do documento e gera markdown/HTML estruturado em um unico passo
- Modelos lancados em outubro 2025: Nanonets OCR2-3B, PaddleOCR-VL-0.9B, DeepSeek-OCR-3B, OlmOCR-2-7B
- **Estes igualam ou superam servicos proprietarios** (Google Vision, Azure OCR)

**Recomendacao para o Segundo Cerebro:**
- **Screenshots e textos simples**: PaddleOCR (rapido, preciso)
- **Documentos complexos (tabelas, formulas, layouts mistos)**: VLM como Qwen2.5-VL-7B ou PaddleOCR-VL
- **Fallback para CPU-only**: Tesseract + OpenCV preprocessing

### 3.3 Descricao e Captioning (Vision LLMs Locais)

Alem de OCR, um Vision LLM gera descricao semantica da imagem:

```python
# Exemplo com Ollama + Qwen2.5-VL
import ollama
response = ollama.chat(model='qwen2.5-vl:7b', messages=[{
    'role': 'user',
    'content': 'Descreva esta imagem em detalhes. Inclua objetos, pessoas, texto visivel, e contexto.',
    'images': ['./photo.jpg']
}])
```

**Comparacao de modelos locais para captioning:**

| Modelo | Params | VQAv2 Score | Velocidade | Ideal Para |
|--------|--------|-------------|------------|------------|
| Moondream 2 | 1.86B | 74.3 | Muito rapido | Volume alto, edge |
| Qwen2.5-VL-3B | 3B | ~77 | Rapido | Equilibrio geral |
| Qwen2.5-VL-7B | 7B | ~80 | Moderado | Melhor qualidade |
| LLaVA 1.5-7B | 7.3B | 78.5 | Moderado | Bom geral |
| LLaVA 1.5-13B | 13.3B | 80.0 | Lento | Maxima qualidade |

**Estrategia dual:**
1. Moondream/Qwen-3B para batch processing inicial (rapido, todas as imagens)
2. Qwen-7B/LLaVA-13B para imagens que precisam de descricao mais rica (sob demanda)

### 3.4 EXIF e Metadata

**Bibliotecas Python:**
- `exifread` — leve, sem dependencias, pure Python
- `Pillow` (PIL.ExifTags) — ja presente na maioria dos projetos
- `piexif` — leitura e escrita de EXIF

**Dados extraidos:**
```python
{
    "date_taken": "2026-04-10 14:30:00",
    "gps_lat": 45.4215,
    "gps_lon": -75.6972,
    "camera_make": "Apple",
    "camera_model": "iPhone 15 Pro",
    "orientation": 1,
    "focal_length": 6.86,
    "exposure": "1/120",
    "iso": 64,
    "software": "17.4.1"
}
```

**Importancia para o Segundo Cerebro:**
- GPS → associar com locais (escritorio, obra, casa)
- Data → timeline automatica
- Camera/software → classificar fonte (celular vs camera vs screenshot)

### 3.5 Face Detection e Recognition

**DeepFace (RECOMENDADO para simplicidade):**
- Wrapper de multiplos modelos: VGG-Face, FaceNet, ArcFace, DeepID, etc.
- Pipeline de 5 estagios: detect → align → normalize → represent → verify
- Uma linha de codigo para verificacao ou busca
- Detectores disponiveis: RetinaFace (estado-da-arte), MTCNN, OpenCV, YOLO, MediaPipe
- Atributos: idade, genero, emocao, etnia
- GitHub: `serengil/deepface`

**InsightFace (RECOMENDADO para qualidade):**
- Usado pelo Immich para reconhecimento facial
- Modelos 2D e 3D
- Melhor acuracia em benchmarks
- Mais complexo de configurar

**Face clustering para fotos pessoais:**
```
1. Detectar faces em todas as fotos (RetinaFace)
2. Gerar embedding de cada face (FaceNet/ArcFace)
3. Clustering (DBSCAN) — agrupar faces similares
4. Cris rotula manualmente os clusters: "Cris", "Joao", "Maria"
5. Novas fotos sao automaticamente associadas aos clusters
```

**Implicacoes de privacidade:**
- TUDO local — nenhum dado facial sai do servidor
- Face embeddings sao vetores numericos, nao imagens
- Banco de rostos so contem pessoas que o Cris conhece/autoriza
- Util para: organizar fotos pessoais, encontrar "todas as fotos com X pessoa"

### 3.6 Classificacao de Tipo de Imagem

**Classificacao automatica antes de processar:**
```
Imagem
    |
    ├─> Screenshot: OCR prioritario, provavelmente interface/codigo
    ├─> Foto: EXIF + Vision LLM + Face detection + CLIP
    ├─> Scan de documento: OCR + layout analysis + extender para texto puro
    ├─> Diagrama/whiteboard: Vision LLM para entendimento + OCR para texto
    ├─> Meme/arte: CLIP embedding + Vision LLM description
    └─> Codigo (screenshot de terminal): OCR especializado em monoespace
```

**Como classificar:**
- EXIF presente + GPS → provavelmente foto
- Resolucao padrao de tela (1920x1080, 2560x1440) → provavelmente screenshot
- Aspect ratio de documento (A4, Letter) → provavelmente scan
- Vision LLM pode classificar se os heuristicos falharem

### 3.7 CLIP Embeddings para Busca por Imagem

**CLIP (Contrastive Language-Image Pre-training):**
- Dois encoders treinados juntos: texto (transformer) e imagem (ViT)
- Ambos geram vetores de 512 dimensoes no MESMO espaco
- Permite buscar imagens com texto natural: "gato dormindo no sofa"
- Permite buscar imagens similares a outras imagens

**Implementacao:**
```python
# Gerar embedding de imagem
from PIL import Image
import clip, torch

model, preprocess = clip.load("ViT-B/32")
image = preprocess(Image.open("foto.jpg")).unsqueeze(0)
image_embedding = model.encode_image(image)  # vetor 512d

# Gerar embedding de texto (para busca)
text = clip.tokenize(["foto da reuniao no escritorio"])
text_embedding = model.encode_text(text)  # vetor 512d

# Similaridade
similarity = torch.cosine_similarity(image_embedding, text_embedding)
```

**Extensoes multimodais:**
- **CLAP**: analogo ao CLIP para audio (audio + texto no mesmo espaco)
- **AudioCLIP**: tri-modal (imagem + texto + audio) — extensao do CLIP
- **ImageBind** (Meta): 6 modalidades em um unico espaco de embedding

**Armazenamento:**
- Cada imagem gera um embedding CLIP de 512d
- Armazenado no pgvector junto com o bloco de conhecimento
- Busca KNN para encontrar imagens mais similares a uma query de texto

---

## 4. Pipeline de Texto/Documentos

### 4.1 Arquitetura Geral

```
Documento (PDF/DOCX/XLSX/PPTX/MD/HTML/EML/TXT)
    |
    ├─> Detector de formato
    |
    ├─> Parser especifico:
    |   ├─> PDF: PyMuPDF4LLM / Marker / Unstructured
    |   ├─> DOCX: python-docx
    |   ├─> XLSX: openpyxl
    |   ├─> PPTX: python-pptx
    |   ├─> HTML: BeautifulSoup / trafilatura
    |   ├─> Markdown: markdown-it / mistune
    |   ├─> Email: email.parser (stdlib) / eml-parser
    |   └─> Chat export: Chatistics / parsers customizados
    |
    ├─> Chunking (split em blocos semanticos)
    |
    ├─> Embedding (nomic-embed-text)
    |
    └─> LLM ──> Resumo, entidades, tags, conexoes
```

### 4.2 PDF Parsing

**Comparacao de ferramentas (testadas em 2025):**

| Ferramenta | Velocidade | Qualidade | Melhor Para |
|------------|-----------|-----------|-------------|
| **pymupdf4llm** | 0.12s | Alta | PDFs digitais, equilibrio speed/quality |
| **Marker** | 11.3s | Muito alta | PDFs escaneados, layouts mistos, OCR |
| **Unstructured** | 1.29s | Alta | RAG (chunks semanticos rotulados) |
| **pypdf** | 0.024s | Basica | Extracao rapida de texto simples |
| **pdfplumber** | 0.10s | Boa | Tabelas e layouts estruturados |

**PyMuPDF4LLM (RECOMENDADO para uso geral):**
- Converte paginas de PDF para Markdown
- Detecta tabelas automaticamente
- Mantem ordem correta de leitura
- Melhor equilibrio velocidade/qualidade
- GitHub: `pymupdf/pymupdf4llm`

**PyMuPDF-Layout (NOVIDADE 2025):**
- Usa parsing nativo do MuPDF para extrair info estrutural
- Font statistics, line spacing, indentacao, margens
- **10x mais rapido** que competidores, roda em CPU pura (sem GPU)
- Zero dependencia de cloud/GPU

**Marker (RECOMENDADO para documentos escaneados):**
- OCR leve suportando 90+ idiomas
- Deteccao de layout, line-level detection, reconhecimento de tabelas
- Supera Tesseract na maioria dos benchmarks
- GitHub: `VikParuchuri/marker`

**Unstructured (RECOMENDADO para RAG):**
- Gera chunks rotulados semanticamente: Title, NarrativeText, Table, ListItem
- Ideal para downstream processing e RAG
- Suporta multiplos formatos alem de PDF

### 4.3 Documentos Office (DOCX, XLSX, PPTX)

**DOCX:**
```python
from docx import Document
doc = Document("arquivo.docx")
for para in doc.paragraphs:
    text = para.text
    style = para.style.name  # Heading 1, Normal, etc.
```

**XLSX:**
```python
from openpyxl import load_workbook
wb = load_workbook("planilha.xlsx")
for sheet in wb.sheetnames:
    ws = wb[sheet]
    for row in ws.iter_rows(values_only=True):
        # processar dados
```

**PPTX:**
```python
from pptx import Presentation
prs = Presentation("slides.pptx")
for slide in prs.slides:
    for shape in slide.shapes:
        if shape.has_text_frame:
            text = shape.text_frame.text
```

### 4.4 Markdown, HTML, Codigo

**Markdown**: Leitura direta (ja e texto). Parser para extrair headings, links, code blocks:
- `markdown-it-py` ou `mistune` para parsing estruturado

**HTML**:
- `trafilatura` — extrai conteudo principal, remove boilerplate (menus, ads, footer)
- `BeautifulSoup` — mais flexivel, menos automatico
- `readability-lxml` — extrai artigo principal (tipo Reader Mode do Firefox)

**Codigo fonte:**
- Tree-sitter para parsing AST (funcoes, classes, imports)
- Linguagem-aware chunking (split por funcao, nao por tamanho)
- Embeddings de codigo: `voyage-code-2` ou `nomic-embed-text` (bom em codigo tambem)

### 4.5 Email Parsing (.eml, .mbox)

**Python stdlib (recomendado para .eml):**
```python
import email
from email import policy

with open("mensagem.eml", "rb") as f:
    msg = email.message_from_binary_file(f, policy=policy.default)

subject = msg["subject"]
sender = msg["from"]
date = msg["date"]
body = msg.get_body(preferencelist=('plain', 'html')).get_content()
```

**MBOX (colecoes de emails):**
```python
import mailbox

mbox = mailbox.mbox("arquivo.mbox")
for message in mbox:
    subject = message["subject"]
    body = message.get_payload(decode=True)
```

**Bibliotecas especializadas:**
- `eml-parser`: extrai info estruturada de .eml
- `fast_mail_parser` (Namecheap): muito mais rapido que implementacoes Python puras
- `emlmailreader`: sender, recipient, subject, body, headers

**Pipeline de email para o Segundo Cerebro:**
```
Email (.eml/.mbox)
    |
    ├─> Extrair: from, to, cc, date, subject
    ├─> Extrair body (plain text preferencialmente)
    ├─> Extrair attachments → processar por tipo (PDF, imagem, etc.)
    ├─> Threading: agrupar replies na mesma conversa
    └─> LLM: resumo, entidades, action items, sentimento
```

### 4.6 Chat Exports (WhatsApp, Telegram, Discord)

**Chatistics (MULTI-PLATAFORMA):**
- Parse Messenger, Hangouts, WhatsApp e Telegram em DataFrames
- Output: CSV, JSON, ou DataFrame pickle
- GitHub: `MasterScrat/Chatistics`

**WhatsApp:**
- `WhatsApp-Chat-Exporter`: parse databases Android/iOS (.crypt12/.crypt14/.crypt15)
- Output: HTML ou JSON estruturado
- Compativel com formato de export do Telegram
- `whatsapp-chat-parser`: parse de exports .txt (built-in do WhatsApp)

**Telegram:**
- Export nativo: Desktop/Web → JSON
- `telegram-chat-parser`: converte JSON do Telegram para CSV
- Telethon para export programatico (ja em `03-ingestion-pipeline.md`)

**Discord:**
- `DiscordChatExporter` (Tyrrrz): export em HTML, CSV, JSON, TXT
- `DiscordChatExporterPy`: variante Python
- `DiscordChatExporter-frontend`: visualizar JSONs exportados em UI tipo Discord
- **Cuidado**: user token viola ToS (risco de ban). Bot token e seguro

**Formato unificado para chats:**
```json
{
  "platform": "whatsapp",
  "conversation_id": "grupo_trabalho",
  "participants": ["Cris", "Joao", "Maria"],
  "messages": [
    {
      "timestamp": "2026-04-10T14:30:00",
      "sender": "Cris",
      "content": "Vamos reunir amanha?",
      "type": "text",
      "attachments": []
    }
  ]
}
```

---

## 5. Busca Unificada Across All Media

### 5.1 O Problema

Cada tipo de midia gera dados diferentes:
- Video → transcricao + descricoes visuais
- Audio → transcricao + speaker labels
- Imagem → OCR text + descricao + CLIP embedding
- Texto → conteudo textual + metadata

**O objetivo**: uma unica interface de busca que pesquisa TUDO.

### 5.2 Embeddings Multimodais

**Estrategia de embedding dual:**

| Tipo de Midia | Embedding de Texto | Embedding Multimodal |
|---------------|-------------------|---------------------|
| Video | nomic-embed-text (transcricao + resumo) | CLIP (keyframes) |
| Audio | nomic-embed-text (transcricao + resumo) | CLAP (audio embedding) |
| Imagem | nomic-embed-text (OCR + descricao) | CLIP (imagem inteira) |
| Texto | nomic-embed-text (conteudo) | - |

**Busca por texto**: query → nomic-embed-text → KNN em pgvector → resultados de todos os tipos
**Busca por imagem**: query texto → CLIP text encoder → KNN nos CLIP embeddings → imagens relevantes
**Busca cross-modal**: "foto da reuniao onde falamos de arquitetura" → combina text + CLIP search

### 5.3 Cross-Modal Search

**Exemplos de queries cross-modal:**
```
"Achar a foto daquela reuniao sobre microsservicos"
  → CLIP search: "meeting room whiteboard microservices"
  → Text search: "microsservicos" nos transcripts de meeting
  → Combinar resultados por timestamp/data

"O que eu disse no audio de voz sobre o projeto OnSite?"
  → Text search: "OnSite" nos transcripts de voice notes
  → Retornar segmentos com timestamps

"Mostrar documentos e emails sobre o contrato XYZ"
  → Text search: "contrato XYZ" em PDFs + emails
  → Retornar blocos rankeados por relevancia
```

### 5.4 Projetos de Referencia

**Screenpipe:**
- Grava tela e microfone 24/7, 100% local
- SQLite local com OCR + transcricoes
- Busca natural language across all captured data
- "Pipes" = plugins AI sobre seus dados
- $400 lifetime license
- GitHub: `screenpipe/screenpipe`

**Immich (fotos e videos):**
- Self-hosted Google Photos alternative
- CLIP semantic search integrado
- Face recognition via InsightFace
- Smart albums automaticos
- Busca natural language: "sunset", "birthday cake", "cat"
- pgvector para embeddings
- Mobile apps (iOS/Android) com backup automatico
- GitHub: `immich-app/immich`

**PhotoPrism (fotos):**
- Self-hosted, AI-powered photo management
- Advanced search capabilities
- Face recognition
- Auto-classification
- GitHub: `photoprism/photoprism`

**Paperless-ngx (documentos):**
- OCR automatico (Tesseract, 100+ idiomas)
- Auto-tagging com neural network
- Matching algorithms: exact, fuzzy, Auto (aprende com uso)
- REST API + webhooks
- Extensoes AI (2025): paperless-gpt, paperless-ai
  - Integracoes com Ollama, OpenAI, Deepseek para classificacao avancada
- GitHub: `paperless-ngx/paperless-ngx`

**Audiobookshelf (audio):**
- Self-hosted audiobook + podcast server
- Streaming de todos os formatos de audio
- Podcast auto-download via RSS
- Metadata scraping (Google Books, Open Library, Audible)
- REST API + Socket.io
- Mobile apps (iOS/Android)
- GitHub: `advplyr/audiobookshelf`

### 5.5 Projetos "Second Brain" Completos

**Khoj AI:**
- Self-hostable AI second brain
- Suporta: PDFs, Markdown, Notion, Word, org-mode, GitHub repos
- Busca semantica avancada
- Agentes customizaveis
- Qualquer LLM: GPT, Claude, Gemini, Llama, Qwen, Mistral (incluindo local via Ollama)
- Deep research capabilities
- GitHub: `khoj-ai/khoj`

**Second Brain (raold):**
- 100% local, zero cloud
- LLaVA + CLIP para processamento multimodal
- PostgreSQL + pgvector para busca vetorial
- Knowledge graphs
- Google Drive streaming
- GitHub: `raold/second-brain`

**RAG-Anything + LightRAG:**
- All-in-One Multimodal RAG
- Processa: texto, imagens, tabelas, equacoes, charts, multimedia
- Arquitetura "1 + 3 + N": knowledge graph engine central
- Suporta: PDFs, Office docs (DOC/DOCX/PPT/PPTX/XLS/XLSX), imagens
- Pipeline: document parsing → content analysis → knowledge graph → intelligent retrieval
- Cross-modal entity extraction e relationship mapping
- GitHub: `HKUDS/RAG-Anything`

**Quivr:**
- RAG generico, qualquer LLM, qualquer arquivo
- Parsers customizaveis
- GitHub: `QuivrHQ/quivr`

---

## 6. Organizacao de Midia

### 6.1 Dimensoes de Organizacao

Cada bloco de conhecimento (independente do tipo de midia) pode ser organizado por multiplas dimensoes simultaneamente:

| Dimensao | Exemplo | Source |
|----------|---------|--------|
| **Data** | 2026-04-10 | EXIF, timestamp, metadata |
| **Fonte** | email, whatsapp, camera, screenshot | Pipeline origin |
| **Projeto/Universo** | OnSite, Eon, Personal, College | LLM classification |
| **Topico** | arquitetura, Python, carpintaria | LLM tagging |
| **Tipo de midia** | video, audio, imagem, documento | File type |
| **Pessoas** | Cris, Joao, Maria | Face recognition, speaker diarization, from/to |
| **Localizacao** | Ottawa, escritorio, obra | GPS, LLM inference |
| **Sentimento/urgencia** | urgente, reflexivo, rotina | LLM classification |

### 6.2 Database-Driven vs Folder Structure

**Folder structure (filesystem):**
```
/media/
  /raw/
    /2026/04/10/
      /video/
      /audio/
      /images/
      /documents/
  /processed/
    /keyframes/
    /transcripts/
    /thumbnails/
```
- Pros: Simple, backupable, browsable sem software
- Cons: Um arquivo so pode estar em 1 pasta

**Database-driven (PostgreSQL):**
```sql
-- Bloco de conhecimento (unidade atomica)
CREATE TABLE knowledge_blocks (
    id UUID PRIMARY KEY,
    media_type VARCHAR(20),      -- video, audio, image, text
    source VARCHAR(50),          -- email, whatsapp, youtube, camera
    created_at TIMESTAMPTZ,
    raw_path TEXT,               -- path para arquivo original
    content_text TEXT,           -- texto extraido/transcricao
    summary TEXT,                -- resumo por LLM
    embedding vector(768),       -- nomic-embed-text
    clip_embedding vector(512),  -- CLIP (para imagens/keyframes)
    metadata JSONB               -- dados especificos por tipo
);

-- Tags (multiplas por bloco)
CREATE TABLE block_tags (
    block_id UUID REFERENCES knowledge_blocks(id),
    tag VARCHAR(100),
    confidence FLOAT,
    source VARCHAR(20)  -- 'ai', 'manual', 'exif'
);

-- Conexoes entre blocos
CREATE TABLE block_connections (
    from_block UUID REFERENCES knowledge_blocks(id),
    to_block UUID REFERENCES knowledge_blocks(id),
    relation_type VARCHAR(50),  -- 'same_meeting', 'references', 'reply_to'
    confidence FLOAT
);
```
- Pros: Multi-dimensional, um bloco pode ter N tags, N projetos, N pessoas
- Cons: Requer software para navegar

**Recomendacao: AMBOS**
- Filesystem para raw files (organizado por data/tipo)
- PostgreSQL para metadados, embeddings, tags, conexoes
- O banco APONTA para os arquivos no filesystem
- Best of both worlds: backupable + multi-dimensional

### 6.3 AI-Assigned Categories

**Pipeline de categorizacao automatica:**
```
Bloco novo chega
    |
    ├─> Classificador de projeto: "Isso e sobre OnSite, Eon, College, ou Personal?"
    |   (fine-tuned ou few-shot com exemplos do Cris)
    |
    ├─> Topic extractor: extrair topicos/tags semanticos
    |   (LLM com prompt: "Extraia 3-5 tags relevantes deste conteudo")
    |
    ├─> Entity extractor: pessoas, organizacoes, locais mencionados
    |
    └─> Connector: encontrar blocos existentes que se relacionam
        (embedding similarity > threshold → criar conexao)
```

### 6.4 Knowledge Graph Approach

**Graph vs Folder:**
- Folders: estrutura rigida, hierarquica
- Knowledge graph: rede organica de conexoes, cada nodo pode se conectar a qualquer outro
- Para o Segundo Cerebro: o graph EMERGE dos dados, nao e imposto

**Ferramentas de graph:**
- **Graphiti** (ja mencionado em `06-similar-projects.md`): knowledge graph temporal
- **Neo4j**: banco de dados de graph dedicado
- **pgvector + JSONB**: graph simples em PostgreSQL (relacoes como rows)

**Recomendacao**: comecar com PostgreSQL relacional (block_connections table).
Migrar para Graphiti/Neo4j quando houver massa critica de dados e a complexidade das relacoes justificar.

---

## 7. Vector Search Local: sqlite-vec vs pgvector

### 7.1 sqlite-vec

**O que e:**
- Extensao SQLite para busca vetorial, escrita em C, zero dependencias
- MIT/Apache-2.0 dual license
- KNN search, multiplas metricas de distancia, SIMD-accelerated
- GitHub: `asg017/sqlite-vec`

**Quando usar:**
- Aplicacoes embarcadas, edge, mobile
- Small-medium scale (dezenas de milhares de embeddings)
- Quando nao quer rodar PostgreSQL
- Brute-force search (nao ANN) — muito rapido para datasets pequenos/medios
- Com quantizacao, escala bem

**Quando NAO usar:**
- Milhoes de vetores high-dimensional
- Quando precisa de joins complexos com dados relacionais densos

### 7.2 pgvector (DECISAO JA TOMADA — ver CLAUDE.md)

**Ja decidido para o Segundo Cerebro** (ver `05-server-architecture.md`):
- PostgreSQL + pgvector: relacional + vetorial na mesma transacao
- Compativel com Supabase para sync cloud futuro
- HNSW indexes para busca aproximada rapida

**sqlite-vec como alternativa para:**
- Mobile companion app (SQLite no celular)
- Edge processing antes de sync com servidor
- Prototipagem rapida

---

## 8. Pipeline Unificado: Tudo Junto

### 8.1 Fluxo Completo

```
1. CAPTURA (03-ingestion-pipeline.md)
   Syncthing, mbsync, Telethon, yt-dlp, file watchers, Screenpipe
                    |
                    v
2. CLASSIFICACAO
   Detectar tipo de midia (video/audio/imagem/texto/chat)
   Roteador de sensibilidade (07-privacy-guardrails.md)
                    |
                    v
3. PROCESSAMENTO (ESTE DOCUMENTO)
   ├─ Video:  FFmpeg → faster-whisper → PySceneDetect → Vision LLM → LLM summary
   ├─ Audio:  YAMNet → WhisperX (transcricao+diarizacao) → LLM summary
   ├─ Imagem: EXIF → PaddleOCR → Vision LLM → CLIP → DeepFace
   └─ Texto:  Parser especifico → chunking → embedding → LLM summary
                    |
                    v
4. REPRESENTACAO
   Bloco de conhecimento unificado:
   - content_text (texto extraido/transcricao)
   - summary (resumo por LLM)
   - embedding (nomic-embed-text, 768d)
   - clip_embedding (CLIP, 512d — para conteudo visual)
   - metadata (JSONB — dados especificos por tipo)
   - tags (AI-generated + manual)
   - connections (links para outros blocos)
                    |
                    v
5. ARMAZENAMENTO
   - PostgreSQL + pgvector (metadados + embeddings)
   - Filesystem (raw files organizados por data/tipo)
                    |
                    v
6. BUSCA UNIFICADA
   - Text search: query → nomic-embed-text → KNN pgvector
   - Image search: query → CLIP text encoder → KNN clip_embeddings
   - Cross-modal: combinar ambos + metadata filtering
   - Full-text search: PostgreSQL tsvector para busca exata
```

### 8.2 Stack Tecnico Recomendado por Camada

| Camada | Ferramenta | Referencia |
|--------|-----------|-----------|
| **Video: Audio** | FFmpeg + faster-whisper/WhisperX | Este doc, sec 1.2 |
| **Video: Cenas** | PySceneDetect | Este doc, sec 1.3 |
| **Video: Visual** | Qwen2.5-VL-7B via Ollama | Este doc, sec 1.4 |
| **Video: Download** | yt-dlp | Este doc, sec 1.6 |
| **Audio: Transcricao** | WhisperX (faster-whisper + pyannote) | Este doc, sec 2.2 |
| **Audio: Classificacao** | YAMNet | Este doc, sec 2.3 |
| **Imagem: OCR** | PaddleOCR (geral) / Qwen2.5-VL (complexo) | Este doc, sec 3.2 |
| **Imagem: Descricao** | Qwen2.5-VL-3B (batch) / 7B (quality) | Este doc, sec 3.3 |
| **Imagem: Faces** | DeepFace (RetinaFace + ArcFace) | Este doc, sec 3.5 |
| **Imagem: Embedding** | CLIP ViT-B/32 | Este doc, sec 3.7 |
| **PDF** | PyMuPDF4LLM (digital) / Marker (scanned) | Este doc, sec 4.2 |
| **Office docs** | python-docx, openpyxl, python-pptx | Este doc, sec 4.3 |
| **Email** | email.parser (stdlib) + fast_mail_parser | Este doc, sec 4.5 |
| **Chat exports** | Chatistics + parsers especificos | Este doc, sec 4.6 |
| **Text embedding** | nomic-embed-text v1.5 | 04-local-models.md |
| **Vector DB** | PostgreSQL + pgvector | 05-server-architecture.md |
| **Orquestracao** | n8n + file watchers | 03-ingestion-pipeline.md |

### 8.3 Ferramentas Self-Hosted Complementares

Para funcoes que ja existem como ferramentas maduras, considerar integrar em vez de reinventar:

| Ferramenta | Funcao | Integrar Via |
|-----------|--------|-------------|
| **Immich** | Gerenciamento de fotos/videos | REST API + ML pipeline |
| **Paperless-ngx** | Gerenciamento de documentos | REST API + webhooks |
| **Audiobookshelf** | Audiobooks e podcasts | REST API |
| **ArchiveBox** | Web archiving | CLI + API |

**Estrategia de integracao:**
- Estas ferramentas gerenciam e servem os arquivos originais
- O Segundo Cerebro sincroniza METADADOS: puxa transcricoes, tags, embeddings via APIs
- Busca unificada no Segundo Cerebro aponta para itens nestas ferramentas
- Evita duplicar storage de arquivos pesados

---

## 9. Decisoes e Recomendacoes

### 9.1 Prioridades para Fase 1

1. **Texto/Documentos primeiro**: mais facil de processar, maior volume existente
   - PDF (PyMuPDF4LLM), DOCX, Markdown
   - Chat exports (WhatsApp txt, Telegram JSON)
   - Email (.eml)

2. **Audio segundo**: voice notes do celular ja chegam via Syncthing
   - faster-whisper para transcricao
   - LLM para resumo e tagging

3. **Imagens terceiro**: screenshots e fotos
   - PaddleOCR para screenshots
   - Qwen2.5-VL-3B para descricoes
   - CLIP para embeddings (busca visual)

4. **Video por ultimo**: mais complexo, mais recursos
   - Comecar com so transcricao (audio track)
   - Adicionar keyframes e visual analysis depois

### 9.2 O Que NAO Fazer na Fase 1

- Face recognition (complexo, privacy-sensitive, pode esperar)
- Audio classification avancada (YAMNet - nice to have)
- Full video processing pipeline (pesado demais para inicio)
- Knowledge graph completo (comecar com tags simples + connections table)

### 9.3 Storage Budget Estimado

| Tipo | Raw | Processado | Por Item |
|------|-----|-----------|----------|
| PDF (10 paginas) | 2 MB | 50 KB (texto + embedding) | ~2 MB |
| Email | 50 KB | 10 KB | ~60 KB |
| Voice note (5 min) | 5 MB | 20 KB (transcript + embedding) | ~5 MB |
| Foto | 5 MB | 5 KB (metadata + embedding + descricao) | ~5 MB |
| Screenshot | 500 KB | 10 KB (OCR + embedding) | ~500 KB |
| Video (10 min, so metadata) | 0 MB* | 100 KB (transcript + keyframes) | ~100 KB |
| Video (10 min, com proxy) | 200 MB | 100 KB | ~200 MB |

*Se nao guardar o original (video de terceiros)

---

## Fontes da Pesquisa

### Video Processing
- [WhisperFrame - Python toolkit for Whisper + frame extraction](https://github.com/cocodedk/whisperframe)
- [PySceneDetect - Scene detection library](https://github.com/Breakthrough/PySceneDetect)
- [yt-dlp - Video downloader](https://github.com/yt-dlp/yt-dlp)
- [yt-dlp Information Extraction Pipeline](https://deepwiki.com/yt-dlp/yt-dlp/2.2-information-extraction-pipeline)
- [yt-dlp Post-Processing Pipeline](https://deepwiki.com/yt-dlp/yt-dlp/2.5-post-processing-pipeline)
- [Video summarization tools on GitHub](https://github.com/martinopiaggi/summarize)
- [Video Summarization with LLMs - CVPR 2025](https://openaccess.thecvf.com/content/CVPR2025/papers/Lee_Video_Summarization_with_Large_Language_Models_CVPR_2025_paper.pdf)
- [Best Open Source Models for Video Summarization 2026](https://www.siliconflow.com/articles/en/best-open-source-models-for-video-summarization)

### Audio Processing
- [WhisperX - ASR with word-level timestamps and diarization](https://github.com/m-bain/whisperX)
- [pyannote speaker diarization community-1](https://huggingface.co/pyannote/speaker-diarization-community-1)
- [pyannote.ai - Speaker Intelligence](https://www.pyannote.ai/blog/community-1)
- [Whisper + Pyannote pipeline guide](https://scalastic.io/en/whisper-pyannote-ultimate-speech-transcription/)
- [Building transcription + diarization pipeline](https://medium.com/@rafaelgalle1/building-a-custom-scalable-audio-transcription-pipeline-whisper-pyannote-ffmpeg-d0f03f884330)
- [Whisper Speaker Diarization Python Tutorial 2026](https://brasstranscripts.com/blog/whisper-speaker-diarization-guide)
- [YAMNet Audio Segmentation - speech, music, silence](https://dev.to/vast-cow/audio-segmentation-with-yamnet-detecting-speech-music-and-silence-312h)
- [PANNs audio model identification](https://medium.com/@martin.hodges/identifying-sounds-using-python-application-and-a-pann-based-audio-model-e2a7dad60508)
- [pyAudioAnalysis - Python Audio Analysis Library](https://github.com/tyiannak/pyAudioAnalysis)

### Image Processing
- [PaddleOCR - OCR toolkit from Baidu](https://github.com/PADDLEPADDLE/PADDLEOCR)
- [8 Top Open-Source OCR Models Compared](https://modal.com/blog/8-top-open-source-ocr-models-compared)
- [7 Best Open-Source OCR Models 2025](https://www.e2enetworks.com/blog/complete-guide-open-source-ocr-models-2025)
- [Qwen-VL image captioning benchmark](https://blog.salad.com/qwen-benchmark/)
- [Qwen2.5-VL-7B on Hugging Face](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct)
- [Moondream - tiny vision language model](https://github.com/vikhyat/moondream)
- [CLIP for multimodal image search - Pinecone](https://www.pinecone.io/learn/series/image-search/clip/)
- [Cross-modal embeddings evolution 2025](https://thedataguy.pro/blog/2025/12/multimodal-embeddings-evolution/)
- [CLIP + FAISS for image retrieval](https://www.cureusjournals.com/articles/13576)
- [DeepFace - face recognition framework](https://github.com/serengil/deepface)
- [InsightFace - 2D & 3D face analysis](https://github.com/deepinsight/insightface)
- [Face clustering with Python](https://medium.com/pythons-gurus/clustering-faces-with-python-aef799514cd8)
- [EXIF metadata extraction in Python](https://thepythoncode.com/article/extracting-image-metadata-in-python)

### Text/Document Processing
- [7 Python PDF Extractors Compared (2025)](https://dev.to/onlyoneaman/i-tested-7-python-pdf-extractors-so-you-dont-have-to-2025-edition-akm)
- [PyMuPDF-Layout: 10x Faster PDF Parsing Without GPUs](https://pymupdf.io/blog/pymupdf-layout-10-faster-pdf-parsing-without-gpus)
- [PyMuPDF4LLM for PDF extraction](https://medium.com/@shravankoninti/pymupdf4llm-is-all-you-need-for-extracting-data-from-pdfs-8cfad33bdfaf)
- [Python email.parser documentation](https://docs.python.org/3/library/email.parser.html)
- [fast_mail_parser](https://github.com/namecheap/fast_mail_parser)
- [Chatistics - multi-platform chat parser](https://github.com/MasterScrat/Chatistics)
- [WhatsApp Chat Exporter](https://github.com/KnugiHK/WhatsApp-Chat-Exporter)
- [DiscordChatExporter](https://github.com/slatinsky/DiscordChatExporter-frontend)

### Unified Search & Self-Hosted Tools
- [Screenpipe - screen + audio capture](https://github.com/mediar-ai/screenpipe)
- [Immich - self-hosted photo management](https://github.com/immich-app/immich)
- [Immich ML architecture](https://deepwiki.com/immich-app/ml-models)
- [PhotoPrism - AI-powered photo management](https://www.emanuele-fabrizio.com/blog/photoprism/)
- [Paperless-ngx documentation](https://docs.paperless-ngx.com/)
- [Paperless-AI - automated document analyzer](https://github.com/clusterzx/paperless-ai)
- [Audiobookshelf - audiobook and podcast server](https://github.com/advplyr/audiobookshelf)

### Second Brain / RAG Systems
- [Khoj AI - self-hosted AI second brain](https://github.com/khoj-ai/khoj)
- [RAG-Anything - all-in-one multimodal RAG](https://github.com/HKUDS/RAG-Anything)
- [LightRAG - simple and fast RAG](https://github.com/HKUDS/LightRAG)
- [Second Brain - local knowledge base with RAG](https://github.com/raold/second-brain)
- [Quivr - RAG for any file type](https://github.com/QuivrHQ/quivr)

### Vector Search & Storage
- [sqlite-vec - vector search SQLite extension](https://github.com/asg017/sqlite-vec)
- [RAG Pipeline: Ingestion, Chunking, Embedding](https://dev.to/derrickryangiggs/rag-pipeline-deep-dive-ingestion-chunking-embedding-and-vector-search-2877)
- [Video Metadata Strategy](https://vidizmo.ai/blog/video-metadata-indexing-strategy)
- [Digital Video Archives: Managing Through Metadata](https://www.clir.org/pubs/reports/pub106/video/)

### Knowledge Management Patterns
- [Personal Knowledge Management 2025](https://www.glukhov.org/post/2025/07/personal-knowledge-management/)
- [Knowledge Management Systems and Graph-Based Models](https://medium.com/@theo-james/why-knowledge-management-systems-are-adopting-graph-based-models-30b410b5c17a)
- [Voice note knowledge capture workflow](https://ambientcontextcapture.com/articles/plaud-note-workflow-integration-claude-notion-system-2)
- [Voicenotes AI Review 2025](https://skywork.ai/skypage/en/Voicenotes-In-Depth-Review-(2025)-The-Future-of-AI-Voice-Notes-Your-Productivity/1972924102313308160)
