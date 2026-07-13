# 08 — Interface Design & UX Patterns

> Status: PESQUISA COMPLETA · Abril 2026
> Foco: Interfaces intuitivas para vibe coder. 6 views. Frameworks open-source. Adaptabilidade.

---

## Conclusao Principal

**A stack recomendada para o Segundo Cerebro**:
- **Base**: Next.js (App Router) + shadcn/ui + Tailwind CSS + TypeScript
- **Chat**: Adaptar Zola ou prompt-kit (ja sao shadcn-native) + Vercel AI SDK para streaming
- **Knowledge Explorer**: react-force-graph-3d para grafo visual + shadcn data tables para lista
- **Timeline**: Gravity UI Timeline (canvas, alta performance) ou vis-timeline (maduro, interativo)
- **3D Brain**: React Three Fiber + modelo GLTF customizado (projeto 3D-BrainMap como referencia)
- **Dashboard**: shadcn-admin template como base + Langfuse patterns para metricas de LLM
- **Arquitetura multi-view**: Layout com sidebar fixa (estilo LobeChat/Obsidian), rotas por view

Nenhum projeto pronto faz tudo. O caminho e **compor building blocks de UI** dentro de um shell Next.js unificado.

---

## VIEW 1: Chat Interface

### O que precisa ter
- Input de texto + voz (Web Speech API ou Whisper local)
- Indicador de qual modelo esta respondendo (cloud vs local / "Amazo" vs "Claude")
- Sidebar de contexto mostrando blocos do vault relevantes usados na resposta
- Streaming de resposta com markdown rendering
- Historico de conversas com busca

### Projetos de Referencia

---

### LobeChat ★69,700+
- **GitHub**: https://github.com/lobehub/lobe-chat
- **Licenca**: MIT
- **Tech Stack**: Next.js, TypeScript, Ant Design, Zustand, i18n, PWA
- **Demo**: https://chat-preview.lobehub.com
- **Destaque**: UI mais polida do ecossistema open-source. Knowledge base com RAG built-in. Plugin system com 100+ extensoes. Voice chat (STT/TTS). Agent marketplace. Multi-provider (OpenAI, Claude, Gemini, Ollama). Suporte a temas custom
- **Adaptabilidade para o Segundo Cerebro**:
  - EXCELENTE como referencia visual de como deve parecer um chat AI premium
  - O sistema de knowledge base com file upload e relevante para o vault
  - Plugin system pode inspirar extensibilidade
  - POREM: Stack usa Ant Design (nao shadcn). Migrar o estilo visual e mais facil que migrar componentes
  - Multi-provider support e exatamente o que o Segundo Cerebro precisa (cloud + local)

---

### Open WebUI ★130,000+
- **GitHub**: https://github.com/open-webui/open-webui
- **Licenca**: BSD-3-Clause
- **Tech Stack**: Python (FastAPI backend), Svelte (frontend), SQLite/PostgreSQL
- **Demo**: https://openwebui.com
- **Destaque**: Projeto mais popular. RAG com 9 vector databases. Knowledge base com chunking inteligente. Hybrid search (BM25 + vector + reranking). OCR com Tika/Docling/Mistral OCR. Multi-user auth
- **Adaptabilidade para o Segundo Cerebro**:
  - Backend Python/FastAPI alinha com o stack do Amazo (CrewAI, agentes Python)
  - RAG pipeline e extremamente maduro — pode ser estudado como referencia
  - POREM: Frontend em Svelte (nao React). Nao pode reaproveitar componentes diretamente
  - A arquitetura de Knowledge (RAG vs full-context injection) e referencia critica
  - O conceito de "function calling + knowledge browsing" e exatamente o subconsciente

---

### LibreChat ★33,900+
- **GitHub**: https://github.com/danny-avila/LibreChat
- **Licenca**: MIT
- **Tech Stack**: TypeScript, React, Node.js, MongoDB, Express
- **Demo**: https://demo.librechat.cfd
- **Destaque**: Drop-in ChatGPT replacement. Agents, MCP, Artifacts, Code Interpreter. Custom actions. Enterprise auth (OAuth, SAML, LDAP). Message search. Model switching mid-conversation. RAG pipeline
- **Adaptabilidade para o Segundo Cerebro**:
  - React frontend — componentes PODEM ser reutilizados com adaptacao
  - Model switching mid-conversation e critico (cloud vs Amazo)
  - Artifacts pattern (gerar codigo/visualizacoes inline) pode ser util
  - POREM: MongoDB (nao PostgreSQL). Express (nao Next.js). Precisaria de refactor significativo
  - A feature de "message search" e relevante para buscar no historico de conversas

---

### Zola ★4,000+ (estimativa — projeto recente)
- **GitHub**: https://github.com/ibelick/zola
- **Licenca**: MIT
- **Tech Stack**: Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase, Vercel AI SDK, prompt-kit
- **Demo**: https://zola.chat
- **Destaque**: Chat unificado multi-modelo. BYOK (bring your own key). Ollama support com auto-detection. Clean UI. MCP support (em progresso). Temas light/dark. Responsive
- **Adaptabilidade para o Segundo Cerebro**:
  - **MELHOR CANDIDATO como ponto de partida para o chat view**
  - Stack IDENTICO ao recomendado (Next.js + shadcn + Tailwind + Vercel AI SDK)
  - Supabase built-in (alinha com futuro sync cloud do Segundo Cerebro)
  - Ollama support ja funciona (para Amazo local)
  - Prompt-kit components sao drop-in
  - POREM: Nao tem sidebar de contexto/vault. Nao tem indicador cloud vs local sofisticado. Precisaria adicionar essas features
  - Beta — pode ter instabilidades

---

### prompt-kit ★RecenTe (pelo criador do Zola)
- **GitHub**: https://github.com/ibelick/prompt-kit
- **Licenca**: MIT
- **Tech Stack**: React, shadcn/ui, Tailwind CSS
- **Site**: https://www.prompt-kit.com
- **Destaque**: Biblioteca de componentes AI-specific. Prompt Input, Message List, Markdown rendering, Code Blocks, Streaming UI, Chain of Thought, Reasoning display, Source attribution, File Upload, Feedback, Steps, Thinking Bar
- **Adaptabilidade para o Segundo Cerebro**:
  - **COMPONENTES ESSENCIAIS para qualquer chat AI em shadcn**
  - Source attribution = mostrar quais blocos do vault foram usados
  - Chain of Thought = mostrar raciocinio do Amazo
  - Steps = mostrar pipeline de processamento
  - Thinking Bar = indicador visual de processamento
  - Instala individual: `npx shadcn@latest add "https://prompt-kit.com/c/[COMPONENT].json"`

---

### Vercel AI Chatbot Template
- **GitHub**: https://github.com/vercel/chatbot
- **Licenca**: MIT (presumida, Vercel template)
- **Tech Stack**: Next.js App Router, AI SDK, PostgreSQL (Drizzle ORM)
- **Demo**: https://chatbot.ai-sdk.dev
- **Destaque**: Template oficial da Vercel. Production-ready. Auth, message persistence, multimodal, shareable chats, generative UI, artifacts, in-browser code execution
- **Adaptabilidade para o Segundo Cerebro**:
  - Referencia de COMO estruturar um chat Next.js com persistence
  - Drizzle ORM + PostgreSQL alinha com stack do Segundo Cerebro
  - Generative UI concept (gerar componentes React como resposta) e poderoso
  - POREM: Template generico. Precisaria de customizacao significativa para vault integration

---

### LLMChat ★133
- **GitHub**: https://github.com/trendy-design/llmchat
- **Tech Stack**: Next.js, TypeScript, PGlite, LangChain, Zustand, React Query, Supabase, Tailwind, Framer Motion, shadcn, Tiptap
- **Destaque**: Chat AI com PGlite (PostgreSQL no browser). Editor rico com Tiptap. Animacoes Framer Motion
- **Adaptabilidade**: PGlite e interessante para modo offline. Tiptap para input rico. Projeto pequeno mas stack alinhado

---

### Recomendacao para Chat View

**Abordagem**: Comecar com Zola como fork/referencia + componentes prompt-kit adicionais.

Adicionar:
1. **Model indicator badge**: tag visual "Amazo (local)" vs "Claude (cloud)" vs "Amazo + Claude (hybrid)"
2. **Context sidebar**: painel lateral mostrando blocos do vault usados, com score de relevancia
3. **Voice input**: Web Speech API para MVP, Whisper local para producao
4. **Sensitivity indicator**: cor/icone mostrando nivel de privacidade da conversa (publico/privado/restrito)

---

## VIEW 2: Vault / Knowledge Explorer

### O que precisa ter
- Browse todos os blocos de conhecimento ingeridos
- Filtros: fonte (email, chat, files, voice), universo (OnSite, Eon, Shabba, Personal), data, tags
- Busca semantica + keyword (hybrid search)
- Visualizacao em grafo (conexoes entre blocos)
- Visualizacao em lista/grid com preview

### Projetos de Referencia

---

### react-force-graph ★2,200+ (principal) / 3d-force-graph ★5,000+
- **GitHub**: https://github.com/vasturiano/react-force-graph
- **GitHub (3D)**: https://github.com/vasturiano/3d-force-graph
- **Licenca**: MIT
- **Tech Stack**: React, D3-force, Three.js (para 3D), WebGL/Canvas
- **Demo**: https://vasturiano.github.io/react-force-graph/
- **Destaque**: 4 modulos — 2D (Canvas), 3D (WebGL/Three.js), VR (A-Frame), AR (AR.js). Force-directed layout. Drag, zoom, pan. Customizacao de nodes e links. ~94K weekly npm downloads para 3D
- **Adaptabilidade para o Segundo Cerebro**:
  - **MELHOR OPCAO para knowledge graph visualization**
  - 3D mode = visao imersiva das conexoes do vault (como Obsidian graph view, mas 3D)
  - 2D mode = versao leve para dispositivos menos potentes
  - Nodes = blocos de conhecimento. Links = relacoes (citacao, mesmo topico, mesma fonte)
  - Cores dos nodes por universo: OnSite=azul, Eon=verde, Shabba=roxo, Personal=dourado
  - Tamanho do node por relevancia/frequencia de acesso
  - POREM: Performance pode degradar com 10K+ nodes. Precisa de agrupamento/clustering

---

### Reagraph ★1,000+
- **GitHub**: https://github.com/reaviz/reagraph
- **Licenca**: MIT
- **Tech Stack**: React, WebGL, Three.js
- **Demo**: https://reagraph.dev
- **Destaque**: WebGL graph para React. 2D e 3D layouts built-in. Node sizing (por atributo, centrality, page rank). Path finding. Lasso selection. Context menu radial. Clustering. Light/dark mode. Expand/collapse
- **Adaptabilidade para o Segundo Cerebro**:
  - Alternativa mais moderna ao react-force-graph, especificamente para React
  - Clustering built-in = agrupar por universo automaticamente
  - Path finding = "como esse email se conecta com aquele projeto?"
  - Node sizing by centrality = encontrar os blocos mais conectados do vault
  - Context menu radial = acoes rapidas (abrir, editar, conectar, deletar)
  - POREM: Menos popular, comunidade menor. Pode ter edge cases

---

### Cytoscape.js ★10,300+ / react-cytoscapejs
- **GitHub**: https://github.com/cytoscape/cytoscape.js
- **React wrapper**: https://github.com/plotly/react-cytoscapejs
- **Licenca**: MIT
- **Tech Stack**: JavaScript, Canvas, SVG
- **Demo**: https://js.cytoscape.org
- **Destaque**: Biblioteca de teoria de grafos MAIS completa. 30+ layouts (hierarchical, circular, cose-bilkent, dagre, elk). Graph analysis built-in (PageRank, betweenness centrality, Dijkstra). Compound nodes (grupos). Estilos avancados. Eventos
- **Adaptabilidade para o Segundo Cerebro**:
  - MAIS PODER ANALITICO que react-force-graph
  - 30+ layouts permitem alternar visualizacoes (force, hierarchical, circular por universo)
  - Graph analysis built-in para encontrar "hub nodes" no vault
  - Compound nodes para agrupar blocos por universo ou fonte
  - POREM: Performance cai com 10K+ elements. Canvas-based (sem WebGL). Visual menos moderno que react-force-graph-3d

---

### Recomendacao para Vault Explorer

**Abordagem dual**:
1. **Modo Lista/Grid** (default): shadcn DataTable com filtros, busca, paginacao. Cards com preview do bloco. Filter bar: fonte | universo | data range | tags
2. **Modo Grafo**: react-force-graph-3d para visualizacao imersiva de conexoes. Toggle entre 2D/3D
3. **Search**: Input unificado com toggle "semantic" vs "keyword" vs "hybrid"

Componentes shadcn necessarios:
- `DataTable` com sorting, filtering, pagination
- `Command` (cmdk) para busca rapida estilo Spotlight
- `Sheet` (painel lateral) para preview de bloco sem sair da view
- `Badge` para tags e categorias
- `Tabs` para alternar Lista / Grid / Grafo

---

## VIEW 3: Timeline View

### O que precisa ter
- Cronologia de todo conhecimento capturado
- Zoom: dia, semana, mes, ano
- Camadas contextuais: clima, localizacao, eventos de vida, eventos do mundo
- Filtro por fonte e universo
- Click para expandir e ver detalhes do bloco

### Projetos de Referencia

---

### Gravity UI Timeline ★ (parte do ecossistema Gravity UI by Yandex)
- **GitHub**: https://github.com/gravity-ui/timeline
- **Licenca**: Apache-2.0
- **Tech Stack**: TypeScript, React, Canvas
- **Demo**: https://gravity-ui.com/libraries/timeline
- **Destaque**: Canvas-based (alta performance). Zoom e pan interativos. Eventos, markers, sections, axes, grid. Background sections para organizacao visual. Smart marker grouping com zoom automatico. Virtualized rendering. TypeScript completo. Custom hooks React
- **Adaptabilidade para o Segundo Cerebro**:
  - **MELHOR OPCAO para timeline de alta performance**
  - Canvas rendering = suporta milhares de eventos sem lag
  - Virtualized rendering = so renderiza o que esta visivel
  - Background sections = camadas contextuais (estacoes, viagens, projetos)
  - Markers = eventos pontuais. Sections = periodos
  - Zoom levels = navegar de ano para dia fluidamente
  - Smart grouping = quando muito zoom out, agrupa eventos automaticamente
  - Pode ser usado diretamente com TypeScript sem React tambem

---

### vis-timeline ★1,500+
- **GitHub**: https://github.com/visjs/vis-timeline
- **React wrapper**: https://github.com/razbensimon/react-vis-timeline
- **Licenca**: MIT / Apache-2.0
- **Tech Stack**: JavaScript, DOM-based
- **Demo**: https://visjs.github.io/vis-timeline/examples/timeline/
- **Destaque**: Biblioteca madura (desde 2014). Items com data unica ou range. Drag and drop. Zoom e pan. Grupos (stacked). Nested groups. Editable. Templates customizaveis. Cluster
- **Adaptabilidade para o Segundo Cerebro**:
  - MAIS MADURA e testada em producao
  - Grupos = fontes (email, chat, files, voice) empilhados verticalmente
  - Nested groups = universo > fonte > tipo
  - Drag and drop = reorganizar eventos manualmente se necessario
  - Clustering = agrupar eventos proximos quando zoom out
  - POREM: DOM-based (nao Canvas). Performance pode ser problema com 10K+ items. Visual datado comparado com opcoes modernas

---

### React Chrono ★4,000+
- **GitHub**: https://github.com/prabhuignoto/react-chrono
- **Licenca**: MIT
- **Tech Stack**: React, TypeScript
- **Demo**: https://react-chrono.prabhumurthy.com
- **Destaque**: 4 modos (horizontal, vertical, vertical-alternating, slideshow). Dark mode com 15+ propriedades. Nested timelines. Media support (imagens, video). Keyboard navigation. Search. Custom rendering
- **Adaptabilidade para o Segundo Cerebro**:
  - BOM para timeline narrativa (storytelling do conhecimento)
  - Slideshow mode = apresentar evolucao de um projeto/topico ao longo do tempo
  - Nested timelines = drill-down de periodos
  - POREM: Nao e feito para dados massivos. Mais para timelines curadas (10-100 items, nao 10K+)
  - Melhor para: "timeline de marcos" no dashboard, nao para "toda a timeline do vault"

---

### KronoGraph (comercial, para referencia)
- **Site**: https://cambridge-intelligence.com/kronograph/
- **Destaque**: Timeline SDK comercial. Escala de punhado a centenas de milhares de eventos. Zoom semantico. Clustering inteligente. Swimlanes. Heatmaps temporais
- **Adaptabilidade**: NAO open-source, mas referencia de UX. O conceito de swimlanes (fontes como lanes horizontais) e heatmaps (densidade de captura ao longo do tempo) sao ideias a implementar

---

### Recomendacao para Timeline View

**Abordagem**: Gravity UI Timeline como engine principal.

Layout:
1. **Eixo horizontal**: tempo (zoomavel: hora → dia → semana → mes → ano)
2. **Swimlanes verticais**: por fonte (email, chat, files, voice) OU por universo
3. **Background sections**: periodos contextuais (viagem, projeto, estacao)
4. **Markers**: eventos de vida (mudanca, aniversario) e eventos do mundo (noticias relevantes)
5. **Heatmap mode**: toggle para ver "densidade de captura" — quando o Cris estava mais ativo
6. **Click to expand**: abre Sheet/Modal com detalhes do bloco

Camadas contextuais (toggle on/off):
- Clima: API weather historico (OpenWeather) — background color sutil
- Localizacao: GPS markers se disponivel
- Eventos de vida: manual tagging pelo Cris
- Eventos do mundo: feed de noticias relevantes (futuramente automatizado)

---

## VIEW 4: 3D Brain Visualization

### O que precisa ter (long-term vision)
- Modelo 3D de cerebro com regioes cognitivas
- Regioes "acendem" baseado em atividade cognitiva recente
- Metafora visual: areas do cerebro do Segundo Cerebro
- Click em regiao = ver blocos de conhecimento associados
- Animacoes de atividade (particulas, glow, pulso)

### Projetos de Referencia

---

### 3D-BrainMap
- **GitHub**: https://github.com/EmreML/3D-BrainMap
- **Licenca**: Nao especificada
- **Tech Stack**: React, Three.js, React Three Fiber, Styled Components
- **Demo**: https://3dbrainmap.com
- **Destaque**: 12 regioes cerebrais interativas. Rotate, zoom, pan. Click em regiao = informacao detalhada. Hover highlight. Modelo 3D real
- **Adaptabilidade para o Segundo Cerebro**:
  - **MELHOR PONTO DE PARTIDA para o brain view**
  - Ja tem o modelo 3D de cerebro com regioes clicaveis
  - Componentes React Three Fiber = mesma stack
  - Adaptar: trocar info anatomica por info cognitiva do Segundo Cerebro
  - Mapear regioes: Frontal = planejamento/projetos, Temporal = memorias/timeline, Occipital = dados visuais/imagens, Parietal = espacial/localizacao, Limbico = emocional/pessoal, Cerebelo = habits/automatismos
  - Adicionar: glow/particulas baseado em atividade recente (Three.js shaders)

---

### threejs-brain-animation
- **GitHub**: https://github.com/bytezpro/threejs-brain-animation
- **Licenca**: Nao especificada
- **Tech Stack**: React, Three.js
- **Destaque**: Componente React para animacao 3D de cerebro. Efeito visual artistico (nao anatomico)
- **Adaptabilidade**: Bom para efeito visual decorativo na landing/dashboard. Menos util como interface funcional

---

### three-brain-js (neuroscience)
- **GitHub**: https://github.com/dipterix/three-brain-js
- **Licenca**: MPL-2.0
- **Tech Stack**: JavaScript, Three.js, WebGL2
- **Destaque**: Engine de visualizacao 3D de cerebro para neuroscience real. Superficies FreeSurfer, overlays de MRI, dados volumetricos. Usado pelo projeto RAVE (neuroscience research)
- **Adaptabilidade**:
  - PODER MAXIMO em termos de fidelidade anatomica
  - POREM: Muito complexo, feito para dados medicos reais (nao metaforicos)
  - Pode ser overkill. Melhor para inspiracao do que para fork direto
  - O conceito de overlays (dados sobre superficie) e aplicavel: overlay de atividade sobre modelo de cerebro

---

### BrainBrowser (McGill University)
- **GitHub**: https://github.com/aces/brainbrowser
- **Licenca**: AGPL-3.0
- **Tech Stack**: JavaScript, Three.js, WebGL, HTML5 Canvas
- **Demo**: https://brainbrowser.cbrain.mcgill.ca
- **Destaque**: Surface Viewer (WebGL 3D) + Volume Viewer (Canvas slices). Visualizacao de dados neuroscience reais. Mapear dados sobre superficies cerebrais
- **Adaptabilidade**: Mesmo caso que three-brain-js. Referencia academica. O conceito de "mapear dados sobre superficie" e o principio chave

---

### React Three Fiber (framework base)
- **GitHub**: https://github.com/pmndrs/react-three-fiber
- **Stars**: 28,000+
- **Licenca**: MIT
- **Tech Stack**: React, Three.js
- **Demo**: https://r3f.docs.pmnd.rs
- **Ecossistema**: @react-three/drei (helpers), @react-three/postprocessing (efeitos visuais), @react-three/rapier (fisica)
- **Destaque**: Renderer React para Three.js. Escreve cenas 3D como componentes React. Declarativo. Performance nativa Three.js. Enorme ecossistema
- **Adaptabilidade**:
  - **FRAMEWORK BASE para qualquer 3D no Segundo Cerebro**
  - Nao e um projeto de brain — e a fundacao sobre a qual construir
  - Usar R3F + drei para o modelo 3D de cerebro
  - Postprocessing para glow, bloom, depth of field
  - Combinar com modelo GLTF de cerebro (exportar do Blender ou usar modelo existente)

---

### Recomendacao para 3D Brain View

**Abordagem phaseada**:

**Fase 1 (agora — POC)**:
- Fork/adaptar 3D-BrainMap
- Trocar dados anatomicos por dados do Segundo Cerebro
- 6-8 regioes metaforicas mapeadas a categorias de conhecimento
- Static glow baseado em volume de dados por regiao

**Fase 2 (quando houver dados)**:
- React Three Fiber custom com modelo GLTF de alta qualidade
- Animacoes de particulas fluindo entre regioes (conexoes ativas)
- Intensidade de glow baseada em atividade recente (ultimo dia/semana)
- Click drill-down: regiao → subcategorias → blocos individuais

**Fase 3 (long-term)**:
- Overlay temporal (ver evolucao do cerebro ao longo do tempo)
- "Thought paths" animados (como um pensamento viaja entre regioes)
- VR mode com react-force-graph-vr (explorar o cerebro em VR)

**Modelo GLTF**: Procurar no Sketchfab modelos 3D de cerebro com licenca CC. Modelos anatomicos low-poly com regioes separadas como meshes individuais sao ideais para interatividade.

---

## VIEW 5: Dashboard

### O que precisa ter
- System health (CPU, RAM, GPU, disk do servidor)
- Agent activity (quais agentes estao rodando, fila de processamento)
- Processing queue (blocos pendentes de ingestao, status)
- Storage stats (total de blocos, por fonte, por universo)
- Model performance (latencia, tokens/s, accuracy comparativa cloud vs local)
- Uptime e alerts

### Projetos de Referencia

---

### shadcn-admin ★4,500+
- **GitHub**: https://github.com/satnaing/shadcn-admin
- **Licenca**: MIT
- **Tech Stack**: React, Vite, shadcn/ui, Tailwind CSS, TypeScript
- **Demo**: https://shadcn-admin.netlify.app
- **Destaque**: 10+ paginas pre-built. Dashboard com charts (Recharts). Data tables com sorting/filtering. Auth pages. Settings. Command palette (Ctrl+K). Light/dark mode. Responsive. RTL support
- **Adaptabilidade para o Segundo Cerebro**:
  - **MELHOR TEMPLATE BASE para o dashboard**
  - Stack alinhado (shadcn + Tailwind + TS)
  - Charts com Recharts ja incluidos — perfeito para metricas
  - Data tables para filas de processamento e logs de agentes
  - Settings pages para configuracao de modelos
  - Command palette para navegacao rapida global
  - POREM: Vite (nao Next.js). Precisaria adaptar para App Router

---

### Next.js Shadcn Dashboard Starter ★3,000+
- **GitHub**: https://github.com/Kiranism/next-shadcn-dashboard-starter
- **Licenca**: MIT
- **Tech Stack**: Next.js 16, shadcn/ui, TypeScript, Tailwind CSS
- **Destaque**: Next.js App Router nativo. Auth. Charts. Tables. Forms. Feature-based folder structure. Production-ready
- **Adaptabilidade para o Segundo Cerebro**:
  - **MELHOR FIT de tech stack** (Next.js + shadcn)
  - Feature-based folder structure = organizado para multi-view
  - App Router = rotas por view naturalmente
  - COMBINAR com shadcn-admin para ter o melhor dos dois

---

### Langfuse ★10,000+
- **GitHub**: https://github.com/langfuse/langfuse
- **Licenca**: MIT (core)
- **Tech Stack**: TypeScript, Next.js, Prisma, PostgreSQL, ClickHouse
- **Demo**: https://langfuse.com
- **Destaque**: Plataforma de observabilidade para LLMs. Tracing de chamadas. Token usage. Latencia. Cost tracking. Prompt management. Evals. Datasets. Custom dashboards
- **Adaptabilidade para o Segundo Cerebro**:
  - **REFERENCIA ARQUITETURAL para metricas de LLM** (nao fork direto)
  - Patterns de como rastrear: tokens usados, custo por query, latencia por modelo
  - Tracing de agentes (qual agente fez o que, quando, com que resultado)
  - Concept de "scores" para avaliar qualidade de respostas
  - Dashboard load otimizado com ClickHouse — referencia para quando escalar
  - POREM: Sistema completo demais. Extrair patterns de dashboard, nao o sistema inteiro

---

### Evidently AI (referencia visual)
- **GitHub**: https://github.com/evidentlyai/evidently
- **Stars**: 5,500+
- **Licenca**: Apache-2.0
- **Destaque**: ML monitoring com dashboards de data drift, model performance, data quality. Reports visuais
- **Adaptabilidade**: Referencia de como visualizar performance de ML. Graficos de drift (Amazo melhorando ao longo do tempo) sao relevantes

---

### Recomendacao para Dashboard

**Abordagem**: Next.js Shadcn Dashboard Starter como base + componentes custom.

Paineis do Dashboard:
1. **System Health** (card grid): CPU%, RAM%, GPU%, Disk usage, Uptime — updates via WebSocket
2. **Agent Activity** (live feed): tabela/lista de agentes ativos, tarefa atual, status, duracao
3. **Processing Queue** (data table): blocos pendentes, em processamento, completos, com erros
4. **Vault Stats** (charts): total de blocos (linha temporal), distribuicao por fonte (pie), por universo (bar)
5. **Model Performance** (comparativo): latencia media, tokens/s, custo acumulado — Cloud vs Amazo side-by-side
6. **Amazo Training Progress** (especial): accuracy comparativa ao longo do tempo. "Apprentice → Crew Leader" visual progress bar

Charts: Recharts (ja incluido no shadcn-admin) ou Tremor (shadcn-compatible, feito para dashboards).

---

## VIEW 6: Settings / Admin

### O que precisa ter
- Model configuration (qual modelo para qual tarefa, parametros)
- Source management (fontes de ingestao ativas, status, toggle on/off)
- Sync status (Syncthing, cloud backup, ultima sync)
- Backup controls (manual backup, restore, schedule)
- Privacy settings (niveis de sensibilidade, quarentena review)
- User preferences (tema, idioma, notificacoes)

### Referencia

O template shadcn-admin ja inclui paginas de Settings com tabs organizadas. Expandir com:

1. **Tab: Models** — Dropdown de modelo por tarefa (classificacao, raciocinio, embeddings, chat). Sliders para temperature, max_tokens. Toggle cloud/local priority
2. **Tab: Sources** — Lista de fontes com toggle on/off. Status badge (active, syncing, error). Botao "add source" com wizard
3. **Tab: Sync** — Status de Syncthing (last sync, pending files). Cloud backup status. One-click manual sync
4. **Tab: Backup** — Backup schedule (cron visual). Restore point list. Download/upload backup
5. **Tab: Privacy** — Sensitivity levels config. Quarantine queue review. PII detection rules
6. **Tab: Appearance** — Theme (light/dark/system). Language. Font size. Density (compact/comfortable)

---

## ARQUITETURA MULTI-VIEW

### Como combinar todas as views

**Pattern**: Layout shell com sidebar fixa + area de conteudo dinamica.

```
+--------+----------------------------------+
| SIDEBAR |          CONTENT AREA            |
|         |                                  |
| [Chat]  |   (rota ativa renderiza aqui)    |
| [Vault] |                                  |
| [Time]  |                                  |
| [Brain] |                                  |
| [Dash]  |                                  |
| [Admin] |                                  |
|         |                                  |
| ------- |                                  |
| Amazo   |                                  |
| Status  |                                  |
+--------+----------------------------------+
```

### Implementacao com Next.js App Router

```
app/
  layout.tsx          ← Shell com sidebar (persiste entre rotas)
  (views)/
    chat/
      page.tsx        ← Chat interface
      layout.tsx      ← Chat-specific layout (chat sidebar)
    vault/
      page.tsx        ← Knowledge explorer
    timeline/
      page.tsx        ← Timeline view
    brain/
      page.tsx        ← 3D brain visualization
    dashboard/
      page.tsx        ← System dashboard
    settings/
      page.tsx        ← Admin/settings
      models/page.tsx
      sources/page.tsx
      sync/page.tsx
      backup/page.tsx
      privacy/page.tsx
```

### Sidebar Design

Referencia principal: **LobeChat sidebar** (clean, icons + text, colapsavel) + **Obsidian sidebar** (file tree + graph toggle).

Elementos do sidebar:
- Logo/avatar do Segundo Cerebro no topo
- Navigation icons com labels (colapsaveis em tela pequena)
- Status badge do Amazo (online/offline, modelo ativo, load)
- Quick search trigger (Ctrl+K / Cmd+K)
- Notification indicator (blocos pendentes review, erros)
- Bottom: User avatar, settings shortcut

### State Management

- **Global**: Zustand (leve, sem boilerplate) — user preferences, active model, system status
- **Server**: React Query / TanStack Query — dados do vault, timeline, dashboard metrics
- **Chat**: Vercel AI SDK hooks — streaming, messages, model switching
- **3D**: React Three Fiber state (zustand interno do R3F)

### Comunicacao entre Views

- Chat pode referenciar blocos do Vault (link cruzado)
- Timeline click pode abrir bloco no Vault explorer
- Brain click pode filtrar Vault por regiao cognitiva
- Dashboard pode linkar para Settings quando algo precisa de atencao
- Command palette (Ctrl+K) funciona de qualquer view — busca global

---

## FRAMEWORK UI PRINCIPAL: shadcn/ui

### Por que shadcn/ui e a escolha certa para o Cris

1. **Copy-paste, nao dependencia**: componentes vivem no SEU codigo. Nenhum node_modules opaco
2. **Tailwind nativo**: estilizacao intuitiva, sem CSS modules ou styled-components complexos
3. **Acessibilidade built-in**: Radix UI primitives debaixo do capo
4. **Ecossistema explodindo**: 331+ templates, prompt-kit, kibo-ui, tremor compatibility
5. **Vibe-coder friendly**: AI entende shadcn muito bem. Prompt "add a shadcn card with..." funciona nativamente
6. **Customizacao**: temas via CSS variables. Light/dark mode trivial
7. **CLI**: `npx shadcn@latest add [component]` — instala so o que precisa

### Componentes shadcn criticos para o Segundo Cerebro

| Componente | View | Uso |
|------------|------|-----|
| `Sidebar` | Global | Navegacao principal |
| `Command` | Global | Busca rapida Ctrl+K |
| `Dialog/Sheet` | Global | Modais e paineis laterais |
| `Tabs` | Vault, Settings | Alternar sub-views |
| `DataTable` | Vault, Dashboard | Listas com sort/filter |
| `Card` | Dashboard, Vault | Containers de informacao |
| `Badge` | Chat, Vault | Tags, status, universos |
| `Input/Textarea` | Chat | Input de texto |
| `Select/Combobox` | Settings | Selecao de modelo/fonte |
| `Toggle` | Settings | On/off sources |
| `Charts` | Dashboard | Metricas visuais |
| `Tooltip` | Global | Info contextual |
| `Breadcrumb` | Vault | Navegacao hierarquica |
| `Calendar` | Timeline | Selecao de data |
| `Skeleton` | Global | Loading states |

---

## PROJETOS "SECOND BRAIN" EXISTENTES (referencia de UX)

### Khoj ★30,700+
- **GitHub**: https://github.com/khoj-ai/khoj
- **Relevancia UX**: Chat + document search numa interface. Custom agents. Automacoes
- **Boa UX de**: Busca semantica integrada no chat. "Talk to your docs" natural
- **Falta**: Nao tem timeline, nao tem brain viz, dashboard basico

### Obsidian Graph View (referencia conceitual)
- **O que faz bem**: Grafo de notas interativo. Zoom. Filtros. Cores por pasta/tag
- **Inspiracao**: O vault explorer DEVE ter uma versao disso em 3D
- **Referencia de UX**: A transicao suave entre "lista de notas" e "grafo de conexoes"

### LifeOS (template Obsidian)
- **Referencia**: PARA method + Periodic Notes + Calendar
- **Inspiracao UX**: A ideia de "areas de vida" mapeadas a views diferentes e relevante para os "universos" do Cris

---

## RESUMO DE RECOMENDACOES FINAIS

| View | Projeto Base | Complementos | Prioridade |
|------|-------------|--------------|------------|
| **Chat** | Zola (fork/ref) | prompt-kit, Vercel AI SDK | P0 — principal |
| **Vault Explorer** | Custom (shadcn DataTable + react-force-graph) | Reagraph como alternativa | P1 |
| **Timeline** | Gravity UI Timeline | vis-timeline como fallback | P2 |
| **Dashboard** | Next.js Shadcn Dashboard Starter | Recharts, Langfuse patterns | P1 |
| **Settings** | shadcn-admin settings pages | Custom tabs | P1 |
| **3D Brain** | 3D-BrainMap + React Three Fiber | drei, postprocessing | P3 — long-term |
| **Shell/Layout** | Custom Next.js App Router | shadcn Sidebar, Command | P0 — fundacao |

### Ordem de implementacao sugerida

1. **Shell/Layout** — Sidebar + rotas + command palette. A "fundacao da casa"
2. **Chat** — View principal. Onde o Cris interage diariamente
3. **Dashboard** — Visibilidade do sistema. "Painel do canteiro"
4. **Settings** — Configurar modelos e fontes
5. **Vault Explorer** — Browse e busca no conhecimento
6. **Timeline** — Visualizacao cronologica
7. **3D Brain** — Visualizacao imersiva (pode ser adicionada depois sem afetar o resto)

---

## LINKS RAPIDOS (todos os projetos mencionados)

### Chat
- LobeChat: https://github.com/lobehub/lobe-chat
- Open WebUI: https://github.com/open-webui/open-webui
- LibreChat: https://github.com/danny-avila/LibreChat
- Zola: https://github.com/ibelick/zola
- prompt-kit: https://github.com/ibelick/prompt-kit
- Vercel Chatbot: https://github.com/vercel/chatbot
- Vercel AI SDK: https://github.com/vercel/ai

### Knowledge Graph
- react-force-graph: https://github.com/vasturiano/react-force-graph
- 3d-force-graph: https://github.com/vasturiano/3d-force-graph
- Reagraph: https://github.com/reaviz/reagraph
- Cytoscape.js: https://github.com/cytoscape/cytoscape.js
- react-cytoscapejs: https://github.com/plotly/react-cytoscapejs

### Timeline
- Gravity UI Timeline: https://github.com/gravity-ui/timeline
- vis-timeline: https://github.com/visjs/vis-timeline
- React Chrono: https://github.com/prabhuignoto/react-chrono

### 3D Brain
- 3D-BrainMap: https://github.com/EmreML/3D-BrainMap
- threejs-brain-animation: https://github.com/bytezpro/threejs-brain-animation
- three-brain-js: https://github.com/dipterix/three-brain-js
- BrainBrowser: https://github.com/aces/brainbrowser
- React Three Fiber: https://github.com/pmndrs/react-three-fiber

### Dashboard
- shadcn-admin: https://github.com/satnaing/shadcn-admin
- Next.js Shadcn Dashboard Starter: https://github.com/Kiranism/next-shadcn-dashboard-starter
- Langfuse: https://github.com/langfuse/langfuse
- Evidently: https://github.com/evidentlyai/evidently

### Second Brain Reference
- Khoj: https://github.com/khoj-ai/khoj
- Obsidian Smart2Brain: https://github.com/your-papa/obsidian-Smart2Brain

### UI Foundation
- shadcn/ui: https://ui.shadcn.com
- Tailwind CSS: https://tailwindcss.com
- Recharts: https://recharts.org
- Zustand: https://github.com/pmndrs/zustand
- TanStack Query: https://tanstack.com/query
