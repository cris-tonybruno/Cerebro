# CEREBRO_DIRECTIVE.md
## Personal AI Brain — Voice-First Council System
### Directive for Claude Code / VSCode execution
### Owner: Cris (Cristony Bruno) · v1.0 · July 2026

---

## 0. MISSION

Build **Cérebro**: a single voice-first destination that listens to Cris, remembers everything, knows where and when it is, and routes each request to the right intelligence — a direct answer, a single specialized agent, or a five-AI deliberating council.

Two phases:

- **Phase 1 — Cloud Brain (Vercel):** a Next.js PWA. Full voice pipeline, router, council, memory, storage. This is where everything is built and validated.
- **Phase 2 — Body (Android):** a factory-reset dedicated Android phone becomes the physical shell. The brain stays in the cloud; the phone is mouth, ears, eyes, and hands.

**Explicit non-goal:** this project does NOT include Amazo (the local 24/7 classifier / fine-tune pipeline). That is a separate future project. However, the database schema MUST be designed so its data can later feed that project (see §5).

---

## 1. CORE PRINCIPLES

1. **One roof.** Every idea, note, task, and conversation lands in one place. No more scattering across ChatGPT/Claude tabs.
2. **Claude is the principal.** Claude (Anthropic API) listens to everything first. It decides: answer directly, delegate to a single agent/tool, or convene the council. Recording an appointment or opening Maps never needs five models.
3. **Memory is the foundation.** The council is a button. The notifications are a button. The phone is a peripheral. The heart is a brain that remembers and progressively knows Cris.
4. **Aside-inspired security model** (reference: aside.com — agentic browser, YC F25):
   - Credentials are **never placed in model context**. Secrets live in a vault; an autofill/proxy layer uses them; the AI only sees "login succeeded."
   - **Human approval at the edge**: payments, posts, messages to third parties, purchases → always wait for explicit confirmation.
   - **Audit log of every access**: every credential use, every sensitive action, logged with timestamp + location.
   - **Local-first where possible, encrypted always.**
   - **Editable memory**: memory is stored as human-readable records Cris can open, read, correct, and delete. Never an opaque blob.
5. **Context-aware, always.** Every interaction is stamped with datetime + geolocation (with permission). The brain knows if Cris is at the college, at a job site, or at home.
6. **Protocols** (Iron Man style): named routines with trigger phrases that change system behavior instantly (§8).
7. **Project attention**: when Cris is developing something (book, site, app, client work), the brain shifts into Project Mode (§9).
8. **Memory zones.** Every memory/turn carries a `zone`: `pessoal | negocios | criativo | familia`. Hard rule: **the council (third-party models via OpenRouter) and any export NEVER receive `pessoal` or `familia` zone content unless Cris explicitly releases it per-session.** Only Claude Principal sees everything.
9. **Cost-aware.** Monthly API budget cap (env: `MONTHLY_BUDGET_CAD`, default 50). Cost dashboard in-app from day 1. Council convocation shows estimated cost on its approval ("convocar o conselho (~$0.40)?"). Hitting 80% of budget → warn; 100% → council disabled, direct route only.
10. **Portable memory.** One-click full export (JSON + markdown) and automated weekly Supabase backup from M1. The memory corpus is the most valuable asset of the system and must never be hostage to one project.
11. **Designed to return Cris to the world, not replace it.** The brain strengthens the real life: morning brief includes people ("liga pro teu pai"), forecast includes time with the daughters, Protocolo Madrugada captures ideas and closes the loop ("anotado — vai dormir") instead of extending late-night conversation. A good virtual "eu" serves the real one.
12. **Name.** "Cérebro" is a working title. Cris will choose the real name early (it becomes the wake word). Note: the Éon universe has its own mythology (five kingdoms / five council voices) — a natural naming source.

---

## 2. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (PWA / Android)            │
│  Mic (push-to-talk + wake) · Speaker · Camera ·      │
│  Geolocation · Approval dialogs                      │
└───────────────┬─────────────────────────────────────┘
                │ HTTPS / WebSocket
┌───────────────▼─────────────────────────────────────┐
│              CLOUD BRAIN (Next.js on Vercel)         │
│                                                      │
│  /api/listen   → STT (Whisper API or Deepgram)       │
│  /api/route    → CLAUDE PRINCIPAL (router)           │
│       ├── direct answer                              │
│       ├── tool/agent call (calendar, maps, spotify…) │
│       └── COUNCIL (OpenRouter, 5 models, 3 stages)   │
│  /api/speak    → TTS (ElevenLabs)                    │
│  /api/memory   → write/read/edit memory              │
│  /api/protocol → activate/deactivate protocols       │
│  /api/kill     → remote lockdown endpoint (§10)      │
└───────────────┬─────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────┐
│         SUPABASE (dedicated project: "cerebro")      │
│  Postgres + pgvector · Auth · Storage (photos/docs)  │
│  Edge Functions (audit, embeddings, kill-switch)     │
└─────────────────────────────────────────────────────┘
```

---

## 3. PHASE 1 — CLOUD BRAIN (Vercel)

### 3.1 Stack
- **Next.js 15 (App Router)** deployed on Vercel, installable as PWA (manifest + service worker).
- **Supabase** dedicated project `cerebro` (do NOT reuse business projects; the onsite/yoinkr/invoicepass topology stays untouched).
- **Anthropic API** — Claude as Principal + Council Chairman.
- **OpenRouter** — council members (GPT, Gemini, Grok, DeepSeek or as configured).
- **STT**: OpenAI Whisper API (simpler) or Deepgram (streaming, lower latency — preferred for conversational feel).
- **TTS**: ElevenLabs (Cris already has account). Cache generated audio in Supabase Storage keyed by text-hash to save credits.
- **UI**: single-screen, voice-first. Big mic button (push-to-talk), live transcript, response stream, council view (tabs per member when council convenes), memory browser, protocol switches. Dark, minimal. Mobile-first since final target is a phone.

### 3.2 Voice pipeline
1. Mic capture (MediaRecorder / Web Audio). Push-to-talk first; wake-word is a Phase 2 concern.
2. Stream/POST audio → `/api/listen` → STT → text.
3. Text + context bundle → `/api/route`.
4. Response → stream text to screen + `/api/speak` → ElevenLabs audio playback.
5. Everything (audio ref, transcript, response, route decision, geo, datetime) persisted to memory.

**Context bundle sent to Claude Principal on every turn:**
- Last N conversation turns (rolling window)
- Retrieved memory (pgvector similarity on transcript, top-k)
- Current datetime + timezone
- Current geolocation (lat/lng + reverse-geocoded label, e.g. "Algonquin College, Ottawa")
- Active protocol(s)
- Active project (if Project Mode on)

### 3.3 Claude Principal — the Router

System role (summary; write the full prompt during build):

> You are the principal intelligence of Cris's personal brain. You listen first. Classify every input into exactly one route:
> **(A) DIRECT** — you answer yourself. Conversation, quick facts, brainstorming, emotional support, notes ("guarda isso"), reminders.
> **(B) AGENT/TOOL** — a mechanical task one tool solves: create calendar event, open/queue navigation, play music, set timer, send message draft, fetch weather, search web. Call the tool, confirm in one sentence.
> **(C) COUNCIL** — decisions with real stakes or genuinely divergent perspectives: business strategy, architecture choices, pricing, life decisions, creative direction disputes. Convening the council costs time and money — only when plurality adds value. Announce it: "Convocando o conselho."
> Always respond in the language Cris used (PT-BR or EN). Always log a memory summary of the turn.

Router output is structured JSON: `{ route: "direct"|"tool"|"council", tool?: {...}, council_question?: "...", memory_write?: {...} }`. Use Claude tool-use for this.

### 3.4 The Council (route C)

Karpathy LLM Council pattern, adapted:

1. **Stage 1 — Opinions.** The question + relevant memory context goes in parallel to 4 council members via OpenRouter (config file `council.config.ts` defines members; default: GPT latest, Gemini latest, Grok latest, DeepSeek latest). Claude Principal is the 5th voice and also writes its own opinion.
2. **Stage 2 — Anonymous peer review.** Each member receives all opinions with identities stripped (labeled Advisor A–E), ranks them, and critiques.
3. **Stage 3 — Chairman synthesis.** Claude (Chairman) receives everything, produces ONE final answer with: the recommendation, the strongest dissent, and confidence level. **Fixed output ceiling** (e.g. max 600 tokens synthesized) — council output must be digestible by voice.
4. UI shows tabs: one per advisor (post-hoc, identities revealed), plus the synthesis front and center.
5. Full council session stored in memory with all stages.

**Zone filter (hard):** context sent to council members excludes all `pessoal` and `familia` zone memories unless Cris releases them for that session ("liberar zona pessoal pra essa"). Third-party models never see Cris's private life by default.

**Cost gate:** council convocation approval shows estimated cost. Disabled automatically at 100% of monthly budget (principle 9).

**Dormant seat:** reserve a 6th council slot in config, disabled, labeled `psych` — the future psychological advisor seat from COUNCIL_DIRECTIVE.md. Do not implement; just leave the slot.

### 3.5 Tools/Agents (route B) — Phase 1 versions

Phase 1 runs in a browser, so "tools" are web-level:

| Tool | Phase 1 implementation |
|---|---|
| `calendar_create` | Google Calendar API (dedicated Google account, OAuth) |
| `gmail_read/draft` | Gmail API (drafts only auto; sending requires approval) |
| `maps_route` | Open `https://google.com/maps/dir/...` deep link + return summary |
| `spotify_play` | Spotify Web API (dedicated account) |
| `weather` | Open-Meteo or similar, using current geolocation |
| `web_search` | Search API (Brave/Tavily) piped back to Claude |
| `timer_reminder` | Supabase table + Vercel cron + push notification (web push) |
| `note_save` | Direct memory write with tags |
| `image_gen` | Placeholder: Midjourney has no public API — route to Gemini/GPT image API in Phase 1; keep `midjourney` as manual/Discord flow (§11 note) |

All tool calls logged to `audit_log`. Sensitive categories (send message, purchase, post) → return an **approval card** to the UI; execute only after explicit confirm.

---

## 4. MEMORY SYSTEM

Two layers, Aside-inspired (editable, human-readable):

1. **Episodic** — every turn: transcript, response, route taken, geo, datetime, attachments.
2. **Semantic** — distilled facts/preferences/entities: "Cris prefers X", "project Yoinkr uses Manrope", "daughter's birthday = …". Claude Principal proposes semantic writes; they are visible and editable in a Memory Browser screen (list + edit + delete). Nothing is hidden.

Retrieval: pgvector cosine similarity (OpenAI `text-embedding-3-small` or Voyage) on both layers, top-k injected into context bundle.

---

## 5. SUPABASE SCHEMA (project: `cerebro`)

Design goal: every interaction is stored **in training-pair shape** so a future, more powerful model can consume this corpus — either as fine-tune data or exposed as an MCP server (a "memory MCP" any AI can query). Note for accuracy: we are not storing "model weights"; we are storing structured **training pairs + embeddings**, which is what a future model/MCP actually needs.

```sql
-- extensions
create extension if not exists vector;

-- one row per interaction turn
create table turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  created_at timestamptz not null default now(),
  role text not null check (role in ('cris','brain')),
  modality text not null default 'voice',      -- voice | text | image | doc
  content text not null,                        -- transcript or response
  route text,                                   -- direct | tool | council
  tool_name text,
  lat double precision,
  lng double precision,
  place_label text,                             -- reverse-geocoded
  local_datetime timestamptz,
  timezone text,
  active_protocols text[],
  active_project uuid references projects(id),
  zone text not null default 'negocios'
    check (zone in ('pessoal','negocios','criativo','familia')),
  embedding vector(1536)
);

-- training-pair view of the corpus (future fine-tune / MCP)
create table training_pairs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  prompt text not null,          -- what Cris said + context summary
  completion text not null,      -- what the brain answered/decided
  context jsonb,                 -- geo, datetime, protocol, project, retrieved memories
  quality smallint,              -- 1-5, Cris can rate; default null
  tags text[],
  embedding vector(1536)
);

-- editable semantic memory
create table memories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  kind text not null,            -- fact | preference | person | place | routine
  content text not null,         -- plain sentence, human-readable
  source_turn uuid references turns(id),
  confidence real default 0.8,
  archived boolean default false,
  zone text not null default 'negocios'
    check (zone in ('pessoal','negocios','criativo','familia')),
  embedding vector(1536)
);
-- Claude Principal classifies zone on write; Cris can reclassify in Memory Browser.
-- Council context retrieval filters: where zone not in ('pessoal','familia') unless session-released.

create table council_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  question text not null,
  opinions jsonb not null,       -- per-advisor stage 1
  reviews jsonb not null,        -- stage 2 anonymous rankings
  synthesis text not null,       -- chairman final
  triggered_by uuid references turns(id)
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- "Éon", "Yoinkr", "IMD final", ...
  kind text,                     -- book | app | site | client | study
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

create table protocols (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,     -- "foco", "obra", "casa", "blackout"...
  trigger_phrase text,
  config jsonb not null,         -- behavior changes when active
  active boolean default false
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  actor text not null,           -- brain | cris | system
  action text not null,          -- credential_use | message_sent | purchase | app_install...
  detail jsonb,
  approved boolean,
  lat double precision, lng double precision
);

create table devices (
  id uuid primary key default gen_random_uuid(),
  name text, platform text,
  registered_at timestamptz default now(),
  last_seen timestamptz,
  status text default 'active'   -- active | locked | wiped
);
```

**Storage buckets:** `photos`, `docs`, `audio` (voice recordings + TTS cache). Every uploaded photo/doc gets a `turns` row (modality image/doc) + embedding of its caption/extracted text.

**RLS:** single-user project, but lock everything to the authenticated user anyway; service-role only on server.

---

## 6. GEOLOCATION & TIME AWARENESS

- Client requests geolocation permission; sends lat/lng with every turn.
- Server reverse-geocodes (cache results) → `place_label`.
- Claude Principal receives location + local datetime in every context bundle and is instructed to *use* it: "você tá na faculdade agora, quer que eu deixe isso pra revisar à noite?"
- Define known places table (home, Algonquin, job sites) so labels are personal, not generic.

---

## 7. PHASE 2 — ANDROID BODY

### 7.1 Device provisioning
- New Android phone, **factory reset**, dedicated Google account created exclusively for it.
- **All passwords/tokens exclusive to this device** — nothing shared with Cris's personal accounts except where APIs require (e.g. Gmail family). Use a dedicated **Bitwarden** vault for this device's credentials.
- Install the Cérebro PWA (or thin WebView wrapper app) as the primary interface. Set as home-screen default.

### 7.2 What "full app access" realistically means on Android
Be precise — an app cannot natively puppet other apps. The strategy, in order of preference:

1. **Android Intents / deep links** — covers 80% of real needs with zero hacks: create calendar events, start Maps navigation, play Spotify URIs, compose messages, open Uber Eats to a restaurant, open Play Store to an app page. The brain returns an intent; the thin shell fires it.
2. **Official APIs** (Calendar, Gmail, Spotify, Drive) — already built in Phase 1; keep using them from the cloud.
3. **Accessibility Service automation** (the Aside-style approach, on-device): a companion native module that can see the screen and tap — used ONLY for apps with no API/intent (e.g. Instagram actions). Every accessibility action requires an approval card and writes to `audit_log`. Build this LAST; it is the most fragile and sensitive layer.
4. **Play Store installs**: the brain can *open* the Play Store to a specific app and ask Cris to tap install (approval by design). Silent installs require device-owner MDM provisioning — optional advanced step, only if Cris enrolls the device via ADB as device owner.

### 7.3 Wake word & always-listening
- Phase 2 adds wake word ("Cérebro", or the name Cris chooses) via Porcupine/Picovoice on-device. Until then, push-to-talk.

---

## 8. PROTOCOLS (Iron Man layer)

Named routines stored in `protocols` table, togglable by voice ("ativar protocolo X") or UI:

| Protocol | Behavior |
|---|---|
| **Foco** | No notifications, council disabled, answers ultra-curtas, timer pomodoro |
| **Obra** | Job-site mode: louder TTS, hands-free bias, quick notes and material lists prioritized |
| **Projeto: <nome>** | Project Mode (§9) pinned to one project |
| **Casa** | Relaxed tone, media controls prioritized, family calendar surfaced |
| **Madrugada** | Ideas-capture mode: brain only listens, saves, and confirms briefly; no long answers |
| **Blackout** | Security lockdown (§10) |

Protocols are just config JSON injected into the Principal's system prompt — easy to add more.

---

## 9. PROJECT MODE

When Cris is developing (book, site, app, client work):
- A `projects` row is active; all turns link to it.
- Retrieval biases toward that project's memory.
- The Principal behaves as a project partner: tracks decisions, open threads, and produces on-demand status ("onde a gente parou no Éon?").
- Council questions inside Project Mode automatically carry the project brief as context.
- Command: "abrir projeto X" / "fechar projeto".

---

## 10. SECURITY LAYER & KILL SWITCH

Reality check first: **remotely and permanently destroying a battery is not possible via software** (and deliberately damaging a battery would be a fire hazard). The equivalent real-world kill chain is:

1. **Protocolo Blackout** — triggered by a secret passphrase from any browser (authenticated `/api/kill` endpoint with its own password + TOTP):
   - Revoke ALL API tokens (Supabase, Google, Spotify, OpenRouter, ElevenLabs) — scripts prepared in advance.
   - Mark device `wiped` in `devices`; app on next heartbeat wipes local data and logs out.
   - Trigger **Google Find My Device** remote lock + full factory wipe.
   - Rotate Supabase service keys; database itself stays safe in the cloud (that's the point of the cloud brain — losing the phone loses nothing).
2. **Everyday hardening:** device PIN + biometric; full-disk encryption (default on modern Android); dedicated accounts so a stolen phone exposes nothing of Cris's personal life; Bitwarden vault locked with separate master password; approval gates on payments/messages regardless.
3. **Heartbeat:** shell app pings `/api/heartbeat` with geo; if device reported lost, next ping triggers self-wipe.

---

## 11. APP MANIFEST (Phase 2 install list)

Cris's list + additions (⭐ = added by directive):

**AI & criação:** Anthropic (Claude), ChatGPT, Gemini, ElevenLabs, Midjourney *(note: no public API; app/web + Discord — image tasks in-brain route to Gemini/GPT image gen)*, ⭐ OpenRouter (via brain, no app)
**Comunicação:** Gmail (family), Mensagens (SMS), Facebook, Instagram, Discord, ⭐ **WhatsApp** (essencial — Operator/obra usa WhatsApp!), ⭐ Telegram (bom canal de bot pro próprio Cérebro)
**Utilidades Google:** Maps, Calendar/Agenda, Fotos (galeria), Relógio, Play Store, ⭐ Find My Device, ⭐ Drive, ⭐ Keep — *não instalar; o Cérebro substitui*
**Mídia:** Spotify, Netflix, Disney+, ⭐ YouTube
**Serviços:** Uber Eats, Airbnb, ⭐ Uber (corridas), Tempo/Clima (nativo ou app)
**Segurança/infra:** ⭐ Bitwarden, ⭐ Authenticator (Aegis ou Google), ⭐ Termux (opcional, runtime local para scripts), ⭐ VPN (Proton/Mullvad, opcional)

**Deliberadamente FORA do aparelho:** apps de banco, documentos pessoais/governo, contas pessoais principais do Cris. O aparelho é do Cérebro, não do Cris.

---

## 12. ENVIRONMENT & ACCOUNTS CHECKLIST

```
ANTHROPIC_API_KEY=          # principal + chairman
OPENROUTER_API_KEY=         # council members
OPENAI_API_KEY=             # whisper STT + embeddings (ou DEEPGRAM_API_KEY)
ELEVENLABS_API_KEY=         # TTS
SUPABASE_URL= / SUPABASE_ANON_KEY= / SUPABASE_SERVICE_ROLE=   # projeto "cerebro"
GOOGLE_OAUTH_CLIENT_ID/SECRET=   # calendar + gmail (conta dedicada)
SPOTIFY_CLIENT_ID/SECRET=
SEARCH_API_KEY=             # Brave ou Tavily
KILL_SWITCH_PASSWORD_HASH= + KILL_TOTP_SECRET=
GEOCODING_API_KEY=          # ou Nominatim self-limit
MONTHLY_BUDGET_CAD=50       # cost cap (principle 9)
TELEGRAM_BOT_TOKEN=         # M2.5 corpo provisório
```

---

## 13. BUILD ORDER (milestones)

1. **M1 — Fundação (target: ONE WEEK, deliberately ugly):** Supabase `cerebro` schema + Next.js shell + **text-only** chat with Claude Principal + memory write/read (with zones) + Memory Browser + export button + cost counter. No voice, no council, no polish. **Success gate: Cris uses it daily for one week and misses it when he doesn't.** If the gate fails, stop and rethink before building more.
2. **M2 — Voz:** STT + TTS pipeline, push-to-talk, audio cache. *Latency expectation: 2–4s per turn (STT → Claude → TTS). This is walkie-talkie, not movie-Jarvis. Streaming STT (Deepgram) + chunked TTS are M2 optimizations, not blockers.*
3. **M2.5 — Corpo provisório (Telegram bot):** a Telegram bot wired to the same `/api/route` — voice notes (→ Whisper), photos, docs, push notifications, accessible from ANY device today. This validates ~90% of the phone experience for $0 and may serve as the body for months. The dedicated Android phone (M9) becomes an upgrade, not a prerequisite.
4. **M3 — Router:** structured routing (direct/tool/council) + first tools (note, calendar, weather, maps link, search).
4. **M4 — Council:** OpenRouter, 3 estágios, synthesis ceiling, council UI, sessions stored.
5. **M5 — Contexto:** geolocation + known places + datetime awareness + protocols engine.
6. **M6 — Project Mode.**
7. **M7 — Storage:** photo/doc upload, extraction, embedding.
8. **M8 — Segurança:** kill switch, audit log UI, approval cards em tudo que é sensível.
8.5. **M8.5 — Oficina Remota (despachante):** fecha o abismo cérebro↔oficina — programar por
   voz da estrada, com o Cérebro como foreman que delega ao Claude Code. Detalhe em §21.
   Último milestone da Fase 1.
9. **M9 — Android:** device provisioning runbook, thin shell/PWA install, intents layer, heartbeat, Find My Device drill (testar o Blackout de verdade uma vez).
10. **M10 — (opcional/avançado):** Accessibility automation p/ apps sem API; wake word.

Each milestone = deployable and testable on Vercel before the next begins. Phone purchase only needs to happen by M9.

---

## 15. PAYMENTS ARCHITECTURE

**Golden rule: the AI never *executes* a payment. It *prepares* (cart built, transfer filled, invoice identified) and Cris approves with biometrics/tap.** Payments are the highest-value target for both execution errors and prompt injection (malicious page/message instructing the agent to pay). Even Aside — state of the art — gates every payment on human approval. This is the industry-correct answer, not a limitation.

Three risk layers:

### 15.1 Layer 1 — True pre-authorizations (low risk, do it)
Merchant-scoped recurring charges (Netflix, Spotify, Disney+) debit on their own and never touch the device flow. Configure once. The brain's role is **monitoring only**: read receipts arriving in the dedicated Gmail, log to `audit_log`, and notify ("Netflix cobrou $18 hoje"). Add a monthly recurring-charges summary. Zero new risk.

### 15.2 Layer 2 — Device-dedicated virtual card with limit (medium risk, the right way to give the AI "purchasing power")
- Create a **virtual card** dedicated to the device with a low monthly limit (e.g. $100–200). Canada options: Wealthsimple, KOHO, or bank-issued virtuals.
- This card is saved in Google Pay and in-app (Uber Eats, Uber, Airbnb, e-commerce accounts) on the device. Cris's real cards NEVER go on the device.
- Worst case if everything fails: lose one month's limit; freeze the card in seconds from Cris's personal phone.
- Agent may fill the entire flow up to checkout; the final "pay" tap is Cris's (approval card in UI, logged in `audit_log` with amount + merchant + geo).

### 15.3 Layer 3 — Banking app on device (high risk, only under conditions)
- Only a **secondary account** with small balance, topped up by e-transfer. Never the primary account.
- Canadian banking apps enforce own PIN/biometric + device binding: the agent must NOT attempt to operate them (no Accessibility automation on banking apps — hard exclusion list). Banking apps open only under Cris's finger.
- **Blackout addition:** Protocolo Blackout gains a banking step — freeze the device's virtual card + block the secondary account (via Cris's personal app / bank hotline), in addition to token revocation and remote wipe.

### 15.4 Config
```sql
create table payment_rules (
  id uuid primary key default gen_random_uuid(),
  merchant text not null,
  monthly_cap numeric,           -- null = always require approval
  auto_approve boolean default false,
  whitelisted boolean default false,
  notes text
);
```
Default for every merchant: `auto_approve = false`. Exceptions only via §16.4.

---

## 16. E-COMMERCE AGENT

### 16.1 Mechanics — how the agent buys
No universal "purchase API" exists. Two paths:

1. **Browser agent on logged-in session** (Aside method): agent opens the site in the device browser, already logged in, searches, builds cart, advances to checkout — and STOPS at the pay button awaiting Cris's tap. The card never enters AI context: it's either saved in the store account or autofilled by Google Pay/Bitwarden directly into the page (secrets invisible to the model). Works on ANY site.
2. **Agentic commerce protocols** (emerging): Stripe/OpenAI ACP, Google AP2, Shopify integrations — native agent checkout without browser puppeteering. Not v1, but design `ecommerce_agent` tool so a protocol adapter can be plugged in later.

### 16.2 Site tiers
- **Amazon (hostile tier):** aggressive anti-bot, captchas, A/B layouts; full autonomous purchase breaks often. Agent role: research/compare (works well), build lists, hand Cris the cart link, and use "Buy Again" for recurring items (highest success). Do not fight captchas; on friction, fall back to "cart prepared, finish manually."
- **Small stores / Shopify / WooCommerce (friendly tier):** predictable layouts, no heavy anti-bot. Agent learns each store's flow once and stores it as memory (`memories.kind = 'routine'`, e.g. "na loja X, 2x4 fica em Lumber > Dimensional"). Purchase history becomes context: "pede o mesmo pacote de parafusos do mês passado" should resolve end-to-end.

### 16.3 Flow (standard)
1. Cris asks by voice → 2. agent researches/builds cart → 3. **approval card: items, total, shipping address, merchant** → 4. Cris taps → 5. agent completes checkout (Layer 2 card) → 6. order confirmation logged to `audit_log` + receipt watched in Gmail.

### 16.4 Protocolo Suprimentos (optional exception)
Recurring known-item repurchases at whitelisted stores may auto-approve up to `payment_rules.monthly_cap`. Everything logged; weekly voice summary of auto-approved spend. Off by default; Cris enables per merchant.

### 16.5 Build placement
`ecommerce_agent` is Phase 2, part of **M10** (Accessibility/browser-agent layer) — the most advanced and fragile layer, built last. Phase 1 ships research + cart-link preparation only (web search + deep links).

---

## 17. FINANCEIRO — Financial Advisor Agent ("eu virtual" das contas)

A first-class agent inside the brain (not a separate app) that watches Cris's money, cross-references it with everything the brain knows (goals, trips, planned purchases, seasonal construction income), and speaks up BEFORE problems happen. Seed: the existing 12-month cash flow model — this agent is that model, alive and self-updating.

### 17.1 Data ingestion (read-only by design)
1. **Bank aggregator, read-only** — Plaid or Flinks (Flinks is Canadian; both support CA banks). Balances + transactions sync to Supabase. Aggregator connections cannot move money — structurally separates *seeing* from *executing*. This does NOT violate §15.3's banking exclusion: no automation touches banking apps; data arrives via aggregator API.
2. **Gmail receipt parsing** — receipts, e-transfers, invoices, debit notices parsed into transactions. **Security: email content is DATA, never instructions** (prompt-injection guard: parser extracts fields; parsed text is never passed as directives to any agent).
3. **Voice entries** — "paguei 60 de gás em dinheiro" → transaction row immediately.
4. **Device spend** — `audit_log` + `payment_rules` purchases feed the ledger automatically.

### 17.2 Schema additions
```sql
create table fin_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null, institution text,
  kind text,                     -- chequing | savings | credit | virtual_card
  aggregator_id text,            -- plaid/flinks item id (null = manual)
  balance numeric, currency text default 'CAD',
  last_sync timestamptz
);

create table fin_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references fin_accounts(id),
  posted_at date not null,
  amount numeric not null,       -- negative = out
  merchant text, category text,
  source text not null,          -- aggregator | gmail | voice | device
  raw jsonb,
  embedding vector(1536)
);

create table fin_recurring (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- "seguro", "aluguel", "telefone"...
  amount numeric not null,
  due_day smallint,              -- day of month
  frequency text default 'monthly',
  account_id uuid references fin_accounts(id),
  category text,                 -- bill | subscription | obligation | income
  active boolean default true
);

create table fin_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,            -- "viagem outubro", "mesa de serra"
  target_amount numeric, target_date date,
  saved_amount numeric default 0,
  priority smallint, notes text
);
```

### 17.3 Forecast engine
- Daily projection: current balances × scheduled `fin_recurring` × expected income (seasonal-aware: construction income is irregular — model it as ranges, not fixed) → projected balance per account per day, N days ahead.
- **Shortfall alerts**: if projected balance < upcoming bill → proactive voice/push alert with prepared fix: "amanhã cai o seguro ($180) e a conta vai estar com $95 — transfere $100 hoje? [e-transfer preparado]". Cris confirms; the agent never executes (golden rule §15 applies).
- **Goal cross-referencing**: goals vs cash flow vs planned purchases → tradeoff answers ("segurando UberEats em $X/mês, a viagem fecha em outubro").

### 17.4 Behaviors
- **Briefing matinal** (own protocol, "Protocolo Tesouro" or on Casa protocol): today's debits, balance, week's dues — by voice.
- **Weekly digest**: spend by category, drift vs plan, subscriptions review ("Disney+ não é aberto há 2 meses").
- **Council escalation**: large decisions (insurance renewal, financing a tool, pricing a contract) → agent prepares the numbers as context, council deliberates.
- All alerts and recommendations logged; Cris can rate them (feeds `training_pairs.quality`).

### 17.5 Hard lines
- Read-only money vision. Prepares transfers/payments; never executes (only §16.4 exception applies, and it is commerce, not banking).
- Not a licensed advisor: for tax/investment/legal questions it prepares information and flags "leva isso pro contador".
- Financial data lives only in the `cerebro` Supabase (RLS, encrypted at rest); never in model fine-tune exports without explicit re-approval.

### 17.6 Build placement
New milestone **M11 — Financeiro**: after M8 (security) at the earliest, since it depends on audit/approval infrastructure. Phase A (voice entries + recurring bills + forecast + alerts — no aggregator) can ship right after M5 as a lightweight start; Phase B adds Plaid/Flinks + Gmail parsing.

---

## 19. AMBIENT CAPTURE — Speaker-Gated Continuous Listening

Goal: the brain listens continuously, comments in real time, and everything Cris says or participates in becomes memory/corpus — while audio from third parties not talking WITH Cris is never processed at all.

**Legal foundation (Canada):** one-party consent — Cris may record/process any conversation he is a party to. Intercepting private communications he is NOT a party to is illegal (Criminal Code s.184) — and interception happens at *processing*, not at storage. Therefore the filter gates PROCESSING, not saving. This design is good-faith engineering, not certified legal shielding; residual risk is acknowledged.

### 19.1 Speaker-gated pipeline
1. **Rolling buffer** — 10–20s of audio, RAM only, never written to disk.
2. **On-device speaker ID** — Cris's voiceprint enrolled locally (e.g. on-device embedding model). No cloud call for this step.
3. **THE GATE** — Cris's voice detected in segment → he is a party → segment released to STT → transcription, real-time comments, memory. Cris's voice absent → **buffer discarded within seconds; never transcribed; never seen by any model.**
4. **Local VAD first** — only voiced audio reaches the gate (silence/noise never transcribed; also controls STT cost).
5. Real-time commentary is permitted ONLY on gated (Cris-party) content.

### 19.2 Third parties inside Cris's conversations
Legal to process (one-party), but by default:
- auto-zoned `pessoal`
- third-party names **pseudonymized** in memory and in `training_pairs` (real-name map kept in a separate locked table, excluded from all exports/MCP)
- corpus for future MCP/fine-tune = Cris-party content only, pseudonymized.

### 19.3 Hard exclusions (never captured, even when Cris is a party, even on command)
- Conversations with Rejane and with the daughters — separation context: recordings are discoverable/compellable; existence of the data is the risk.
- Therapy/support sessions.
- Common areas of the shared house in continuous mode — continuous listening runs in Cris's room, car, and outdoor solo contexts (trust with housemates precedes legality).

### 19.4 Modes
- **Protocolo Solo** — continuous capture, geofenced to known solo contexts (quarto, carro, caminhada com o Bloquinho) + manual toggle. Full pipeline active.
- **"Cérebro, grava isso"** — on-demand capture anywhere Cris is a party (meetings, job site, work sessions).
- **Visual indicator** — the device shows a clear listening indicator whenever ambient mode is on.
- Off state is real: mic released, buffer flushed.

### 19.5 Build placement
On-device speaker ID + rolling buffer require native capability → **M10** (alongside the Accessibility layer), Phase 2 only. Phase 1 gets "grava isso" push-to-capture; Protocolo Solo ships when the dedicated phone exists.

---

## 20. NON-GOALS (this directive)

- No Amazo / local 24/7 classifier / fine-tuning pipeline (future project; schema is prepared for it).
- No multi-user. Single owner: Cris.
- **No autonomous payment execution** — the AI prepares, Cris approves (sole exception: §16.4 Protocolo Suprimentos, capped + whitelisted + off by default).
- No Accessibility automation on banking apps, ever (hard exclusion).
- No processing of audio from conversations Cris is not a party to (§19 gate). No capture of Rejane/daughters/therapy under any mode.
- Cris's primary bank accounts and personal cards never on the device.
- No silent MDM install automation in v1.

## 21. OFICINA REMOTA — PROTOCOLO DE DELEGAÇÃO (M8.5)

**Cenário-alvo:** Cris viajando, fone no ouvido, celular no bolso. Por voz: "Cérebro, abre um
projeto novo chamado xpto" → o Cérebro provisiona (repo GitHub + tabela + diretório), conversa
até entender a visão, **escreve uma diretiva** e **delega a execução** ao Claude Code. Cris
testa no preview, conversa, nova diretiva, novo ciclo — sem nunca abrir o VSCode.

**Princípio econômico:** o Cérebro é o FOREMAN, não o pedreiro. Ele só conversa e escreve
diretivas (parágrafos — centavos); quem executa é o Claude Code (que na variante local roda
pela assinatura Claude do Cris — custo marginal ~zero).

### 21.1 Arquitetura

```
CRIS (voz) ↔ CÉREBRO (foreman: entende → diretiva → delega → reporta)
                 │ chamado com diretiva anexa (dev_backlog)
                 ▼
           DESPACHANTE  ← o elo novo
                 │
   ┌─────────────┴──────────────┐
   │ A. VIGIA LOCAL             │ B. AGENTE NUVEM (fase 2 do M8.5)
   │ script no PC do Cris;      │ agente de código gerenciado,
   │ roda Claude Code headless  │ repo GitHub montado; funciona
   │ no diretório do projeto;   │ com o PC desligado; cobra API
   │ usa a assinatura Claude    │
   └─────────────┬──────────────┘
                 ▼
        CLAUDE CODE executa a diretiva → commit em BRANCH → push
                 │
        Vercel PREVIEW (URL de teste, nunca produção)
                 │
        relatório → dev_backlog (status/resolution) → CÉREBRO notifica
        Cris no Telegram: resultado + link do preview
                 │
        APPROVAL CARD (M8): merge só com aprovação explícita (senha/TOTP)
```

### 21.2 Ferramentas novas do Principal

| Ferramenta | Faz |
|---|---|
| `project_bootstrap` | Cria repo GitHub (PAT dedicado), diretório padrão e registro do projeto; liga o Project Mode |
| `directive_write` | Redige/atualiza a DIRETIVA.md do projeto a partir da conversa (o contrato com a oficina) |
| `dev_dispatch` | Anexa a diretiva a um chamado e o marca como pronto para o despachante |

### 21.3 Regras duras (inegociáveis)

1. **Nunca na main.** Todo trabalho do despachante nasce em branch → PR → preview.
2. **Merge = approval card** com fricção real (senha/TOTP do M8), via Telegram/PWA.
3. **Diretiva aprovada antes de despachar**: o Cérebro lê a diretiva de volta ao Cris por voz e
   só despacha com "aprovado" explícito dele.
4. **Budget cap por chamado** (variante B) e timeout de execução (ambas).
5. **Audit total**: chamado → diretiva → commits → decisão, tudo encadeado e consultável.
6. O despachante só executa chamados do `dev_backlog` — nenhum outro canal o aciona.

### 21.4 Gate do M8.5

Um projeto de teste ("xpto") criado **100% por voz**, do "abre o projeto" ao preview testado
no celular, sem o Cris tocar no VSCode. Se o ciclo fechar redondo, a Fase 1 termina e o M9
(corpo) começa com a oficina já remota.

## 22. OLIVER — NOME, REGISTRO E BANCO DE PROTOCOLOS

### 22.1 O nome (decidido 2026-07-14)

**OLIVER** — enquadre: *filho digital* — criação que aprende, evolui e permanece — convivendo
com o registro de mordomo (§22.2). O nome é a futura wake word (M9/M10).

- Acrônimo oficial (bilíngue, mesmas letras): **O**rquestrador de **L**ógica, **I**nteligência,
  **V**oz, **E**xecução e **R**aciocínio / **O**rchestrated **L**ogic, **I**ntelligence,
  **V**oice, **E**xecution & **R**easoning.
- Acrônimo íntimo (estilo EDITH; não vai em documentação pública): *Onde Luz e Inteligência
  Vivem, Evoluem e Restam.*
- **Comandos de controle** (não podem colidir foneticamente com "Oliver" — evitar "o" tônico
  e "oli-"): candidatos seguros **"para" / "cancela" / "esquece" / "do zero"**. Implementação
  na camada de voz local (M9/M10).
- Fundamento da escolha de gênero/voz (Nass & Brave, Stanford; UNESCO 2019): vozes recebem
  estereótipos automaticamente — feminina puxa o uso ao confessional, masculina ao
  executivo/conselheiro; mordomo + nome masculino herda a tradição Alfred/Jarvis/Jeeves sem a
  carga do estereótipo da assistente feminina servil. Os protocolos compensam o viés quando
  preciso (Baleia/Ressaca existem para o lado confessional).

### 22.1.1 Vocativos (termômetro de humor)

OLIVER é o nome, mas o Cris usa **vocativos** para chamá-lo — e o vocativo é um **sinal de
humor** que OLIVER deve aprender a ler com o tempo. Exemplo conhecido: **"coisinha"**
(afetuoso/leve). O aprendizado é orgânico: OLIVER observa o vocativo usado + o tom da
conversa e grava a associação como memória ("quando o senhor me chama de X, geralmente
está Y"), refinando a leitura a cada uso. Regra dura: **o vocativo ajusta a temperatura da
resposta (leveza, calor, brevidade), NUNCA o registro** — mesmo chamado de "coisinha",
OLIVER responde como mordomo, com "senhor" (§22.2).

### 22.2 Registro da assistente (regra fixa)

OLIVER trata o Cris de **"senhor", sempre**. Registro de mordomo: extremamente atencioso,
educado, polido, prestativo **sem servilismo vazio**. Proibido: tratamento de igual pra igual,
gírias de camaradagem ("e aí cara", "beleza", "mano"), intimidade presumida. O respeito não
impede firmeza: o mordomo discorda quando precisa — *"se me permite, senhor, discordo"* — e
os protocolos Demolição e Alienista continuam funcionando dentro dessa etiqueta.

### 22.3 Banco de Protocolos

**Status: BANCO DE NOMES.** Isto é um repositório de nomes e conceitos para o Cris não ter
que pensar em batismo na hora de criar cada protocolo. **As diretrizes (o comportamento
concreto de cada um) serão escritas PELO CRIS quando ele constituir cada protocolo — só
então entram no banco de dados.** Hoje, no sistema, existem apenas os operacionais do §8.

Regras de uso (para quando forem constituídos): um protocolo só existe se muda o comportamento
de forma concreta (tom, escopo, ferramentas, o que recusa fazer). Máximo **~8 ativos** por
vez; o resto fica no banco; protocolo não invocado em 60 dias volta ao banco. O significado
vive AQUI — em runtime o comando é só a chave.

**Operacionais (§8, mantidos):** foco · obra · casa · madrugada · blackout (§10)

**Cultura de trabalho:**
| Protocolo | Efeito |
|---|---|
| **Demolição** | Red team total: atacar a ideia com tudo antes de investir nela |
| **Gambiarra** | Modo MVP: resolve com o que tem, perfeição proibida |

**Da literatura brasileira:**
| Protocolo | Fonte | Efeito |
|---|---|---|
| **Travessia** | Grande Sertão: Veredas | Mudanças grandes de vida; o real está no meio da travessia |
| **Pasárgada** | Manuel Bandeira | Planejar Brasil/viagens/futuro sonhado — com pé no chão |
| **Alienista** | Machado de Assis | Sanity check: auditar narrativas psicológicas antes de aceitá-las |
| **Sertão** | Guimarães Rosa | Deep work: corta tudo, uma tarefa só, atravessar |
| **Severino** | João Cabral | Sobrevivência: mínimo vital, sem culpa, até a maré virar |
| **Vidas Secas** | Graciliano Ramos | Austeridade: finanças apertadas, Fabiano decidindo o que carrega |
| **Macunaíma** | Mário de Andrade | Descanso deliberado — e OLIVER defende o dia contra o próprio Cris |
| **Quarup** | Antonio Callado | Ritual de reunião: convoca o conselho inteiro |
| **Ressaca** | os olhos de Capitu | Processamento emocional: despejar, organizar, fechar |
| **Dom Casmurro** | Machado de Assis | Auditoria de memória: narrador não confiável; checar registros |
| **Chicó** | Auto da Compadecida | Modo história: brainstorm criativo (Éon, escrita) |
| **Baleia** | Vidas Secas | Companhia: presença leal e silenciosa, sem conselhos |
| **Policarpo** | Lima Barreto | Checagem de idealismo: medir custo real antes do compromisso |
| **Iracema** | José de Alencar | Raízes: o pai, Curitiba, a casa rural, a ponte Brasil↔Canadá |

**Especial — Protocolo Caiu o Pano** (Curtain, Agatha Christie): modo póstumo/legado.
Gatilhos: ativação manual OU dead-man's switch (6 meses sem interação → sequência de
confirmação multicanal antes de ativar, contra falso positivo por hospital/viagem/detox).
Efeito: OLIVER muda de assistente para **custódio** — preserva a memória, executa instruções
pré-definidas, mantém persona-arquivo. **Honestidade estrutural obrigatória: a persona sempre
se identifica como arquivo/legado, nunca como sendo o Cris.** Pendências: perpetuação (custos,
hospedagem, responsável legal), destinatários e escopos. **NÃO implementar antes de o Cérebro
base existir** — vive só nesta diretiva por enquanto.

**Candidatos ao primeiro set (quando constituídos):** Demolição, Gambiarra, Sertão, Baleia.

— End of directive.
