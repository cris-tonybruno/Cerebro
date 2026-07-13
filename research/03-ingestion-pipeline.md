# 03 — Pipeline de Ingestao

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: quais fontes priorizar? n8n vs custom?

---

## Visao Geral

O servidor recebe TUDO raw. Cada fonte tem uma estrategia de ingestao diferente.

```
FONTES DE DADOS
===============
Email (mbsync)     Chat (Telethon/bridges)    Arquivos (Syncthing)
Browser (ArchiveBox)   Notas (Notion API/Obsidian)
Voz (Syncthing do celular)    Screenshots (filesystem watcher)
AI Chats (browser extension)   Tela/Audio (Screenpipe)
                    |
                    v
         CAMADA DE INGESTAO (n8n / custom Python)
                    |
                    v
         CAMADA DE PROCESSAMENTO
         - faster-whisper (audio → texto)
         - Tesseract + OpenCV (imagem → texto)
         - Vision LLM (entendimento visual)
         - Parsers (PDF, DOCX, HTML → texto)
         - LLM (resumo, tagging, entidades)
                    |
                    v
         CAMADA DE ARMAZENAMENTO
         - PostgreSQL + pgvector (metadados + vetores)
         - Filesystem (arquivos raw, organizados por data/fonte)
```

---

## 1. Email

### Melhor ferramenta: mbsync (isync)

- Escrito em C, ativamente mantido
- Baixa emails IMAP para formato Maildir (cada email = 1 arquivo)
- Sync bidirecional
- Gmail requer App Password (limite diario: 2500 MB)
- Alternativas: offlineimap (mais lento), imapsync (para migracoes)

### API-based (alternativa)
- **Gmail API**: OAuth 2.0, `google-api-python-client`, `simplegmail` (wrapper simples), `gwbackupy` (backup incremental)
- **Microsoft Graph API**: Outlook/Exchange, requer Azure app registration

### Pattern de automacao
```
systemd timer (cada 5 min) → mbsync → Maildir no disco → indexer (notmuch/mu) → pipeline AI
```

---

## 2. Chat / Conversas

### WhatsApp
- **wa-automate-python**: Selenium + WhatsApp Web. Licenca $5/mes
- **Whapi.Cloud**: SDK Python completo. Webhooks
- **Meta WhatsApp Cloud API**: Oficial. 1000 conversas/mes gratis
- **Export manual**: Built-in "Export Chat" (.txt). Automatizavel com Tasker no Android
- **CUIDADO**: Em 2025, pacote npm "lotusbail" malicioso imitou API do WhatsApp

### Telegram
- **Telethon**: Melhor opcao. MTProto API completo. `iter_messages(limit=None)` para export total
- **telegram-export**: Usa Telethon. Baixa mensagens, midia, dados de usuarios
- **tg-archive**: Sync periodico para SQLite. Gera sites estaticos

### Discord
- **DiscordChatExporter**: HTML, TXT, CSV, JSON. User token viola ToS (risco de ban). Bot token e seguro
- **DiscordChatExporterPy**: Variante Python para uso programatico

### Slack
- **Slack Export Tools**: Workspace Owners podem exportar canais publicos
- **slack-exporter**: Bot para canais publicos e privados
- **Slack API + slack_sdk**: Retrieval programatico

### Bridges multi-plataforma
- **Matrix bridges**: Synapse/Dendrite como homeserver. Bridges para WhatsApp, Telegram, Discord, Slack, Signal, IRC
- **Matterbridge**: Bridges entre muitos protocolos

---

## 3. Sync de Arquivos

### Recomendado: combinacao de ferramentas

```
Celular (Syncthing) ──real-time P2P──> Servidor (Syncthing)
                                            |
Laptop (Nextcloud client) <──WebDAV──> Servidor (Nextcloud)
                                            |
                                rsync ──nightly──> Backup NAS
```

- **Syncthing**: P2P, real-time, criptografado em transito. Melhor para celular
- **Nextcloud**: Self-hosted, WebDAV, UI web. Melhor para desktop
- **rsync**: Backups agendados para cold storage

---

## 4. Browser (historico/bookmarks)

- **ArchiveBox**: Self-hosted web archiving. Extension de browser. Salva HTML, JS, PDFs, screenshots, WARC
- **Karakeep** (ex-Hoarder): Self-hosted, AI auto-tagging com Ollama, browser extension, mobile apps
- **Acesso direto**: Chrome History SQLite em `~/.config/google-chrome/Default/History`

---

## 5. Notas

| App | Estrategia |
|-----|-----------|
| **Obsidian** | Markdown local. Apontar pipeline para o vault. Syncthing para sync |
| **Notion** | API + `notion-client`. `notion4ever` para export completo |
| **Apple Notes** | `apple-notes-to-sqlite` (Simon Willison). AppleScript |
| **Google Keep** | `keep-it-markdown` (KIM). Google Takeout para batch |

---

## 6. Voz / Audio

### Melhor ferramenta: faster-whisper
- Reimplementacao do Whisper com CTranslate2. **4x mais rapido** que o original
- **WhisperLive**: Real-time via WebSocket
- **whisper_streaming**: Streaming com latencia auto-adaptativa
- **remote-faster-whisper**: API HTTP para transcricao centralizada no servidor
- **pyannote-audio**: Speaker diarization (identificacao de falantes)

### Pipeline
```
Audio → file watcher no servidor → faster-whisper + pyannote → transcript com labels → LLM post-processing
```

---

## 7. Screenshots / Imagens

- **Tesseract OCR**: 100+ linguas. Preprocessamento com OpenCV (deskew, denoise)
- **Vision LLMs locais**: LLaVA, Qwen-VL, Moondream para entendimento alem de OCR
- **Screenpipe**: Captura continua de tela + audio. OCR + OS accessibility tree. SQLite local. REST API

---

## 8. Conversas com IA (export)

- **AI Chat Exporter (RevivalStack)**: Tampermonkey userscript. ChatGPT, Claude, Copilot, Gemini, Grok. Markdown + JSON
- **AI Exporter (Chrome Extension)**: 10+ plataformas. PDF, Word, Markdown, JSON
- **Echoes**: Batch export ilimitado. Search + label + summarize
- **Claude**: Export built-in (Free, Pro, Max)
- **ChatGPT**: Settings → Data Controls → Export Data

---

## Projetos de Referencia para Ingestao

| Projeto | O que faz |
|---------|-----------|
| **Screenpipe** | Captura TUDO da tela e audio. "Pipes" = agentes AI sobre seus dados |
| **Windrecorder** | Open source, grava tela, query por OCR. Windows Recall open source |
| **Project Second Brain** (Daniel Pickem) | Ingere papers, artigos, livros (foto→OCR), podcasts, GitHub repos |
| **n8n** | Automacao visual. 400+ integracoes. Self-hosted |
| **Huginn** | IFTTT self-hosted. Agentes autonomos que monitoram e agem |

---

## Orquestracao da Ingestao

### Opcao A: n8n (VISUAL)
- Drag-and-drop workflow builder
- 400+ integracoes
- Self-hosted
- Bom para nao-programadores
- Mais facil de manter

### Opcao B: Custom Python + Celery (MAXIMO CONTROLE)
- File watchers (`watchdog`)
- Scheduled sync jobs (Celery Beat)
- Webhook receivers (FastAPI)
- API pollers
- Mais flexivel, mais trabalho

### Opcao C: Huginn (MEIO-TERMO)
- Agentes autonomos que monitoram e agem
- Self-hosted
- Desenvolvimento desacelerou

---

## Proximos Passos (decisao do Cris)

1. Quais fontes sao prioridade para a Fase 1? (email? chat? arquivos?)
2. n8n ou custom Python?
3. Screenpipe como captura-tudo ou fontes individuais?
