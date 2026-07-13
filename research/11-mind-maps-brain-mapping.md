# 09 — Interconnected Mind Maps & Brain-Region Mapping

> Status: PESQUISA COMPLETA · Abril 2026
> Foco: Mapear conhecimento pessoal a um modelo 3D do cerebro humano. Mind maps interconectados. Emocoes. Neuroscience-informed AI second brain.

---

## Conclusao Principal

**Este e o componente mais visionario do Segundo Cerebro.** A integracao completa requer quatro camadas:

1. **Mind Map Engine**: Graphology.js (dados) + Sigma.js ou react-force-graph-3d (render) para grafos de conhecimento interativos
2. **Cognitive Classifier**: LLM prompt chain (ou fine-tuned model) que classifica cada bloco de conhecimento em tipos cognitivos baseados na taxonomia de Squire (declarativo/episodico/procedural/emocional)
3. **3D Brain Renderer**: React Three Fiber + modelo GLTF do cerebro humano com regioes segmentadas (projeto 3D-BrainMap como base), iluminacao por shader glow
4. **Emotion Layer**: EmoRoBERTa ou GoEmotions para texto + Wav2Vec2 para voz, mapeados no modelo PAD (Pleasure-Arousal-Dominance)

Nenhum projeto existente faz essa integracao completa. Isso e territorio de invencao. Mas **cada peca individual ja existe** como open source — o trabalho e compor e conectar.

---

## PARTE 1: MIND MAPS INTERCONECTADOS

### 1.1 Bibliotecas de Visualizacao de Grafos

#### Tier 1 — Recomendadas para o Segundo Cerebro

| Biblioteca | Render | Nodes max | React? | Destaques |
|---|---|---|---|---|
| **react-force-graph** (Vasco Asturiano) | WebGL/Three.js | 50k+ | Sim (wrapper nativo) | 2D, 3D, VR, AR. D3-force-3d physics. Melhor relacao custo/beneficio |
| **Sigma.js** v3 | WebGL | 100k+ | Sim (via @react-sigma) | Mais rapido para grafos grandes. Backend: Graphology.js |
| **Cytoscape.js** | Canvas | ~10k | Sim (wrapper) | Mais rico em algoritmos de analise (betweenness, PageRank, community detection) |
| **3d-force-graph** | Three.js/WebGL | 50k+ | Nao (vanilla JS, mas facil de integrar) | Base do react-force-graph. Controle total |

#### Tier 2 — Alternativas validas

| Biblioteca | Notas |
|---|---|
| **React Flow / xyflow** | Otimo para flowcharts e mind maps hierarquicos. Tem tutorial oficial de mind map. Nao e force-directed |
| **D3.js** (d3-force) | Fundacao de tudo, mas muito baixo nivel. Usar via wrappers |
| **vis.js** | Maduro mas lento. Uma ordem de magnitude mais lento que Sigma/Cytoscape em benchmarks |
| **AntV G6** | Da Ant Financial. React toolkit (Graphin) com 1.3k stars. Bom para grafos empresariais |
| **Gephi** | Desktop, nao web. Mas exporta para Sigma.js via plugin |

**Fontes**:
- [3d-force-graph](https://github.com/vasturiano/3d-force-graph) — GitHub
- [react-force-graph](https://github.com/vasturiano/react-force-graph) — GitHub
- [Sigma.js](https://www.sigmajs.org/)
- [Cytoscape.js](https://js.cytoscape.org/)
- [React Flow Mind Map Tutorial](https://reactflow.dev/learn/tutorials/mind-map-app-with-react-flow)
- [Best Libraries for Large Force-Directed Graphs](https://weber-stephen.medium.com/the-best-libraries-and-methods-to-render-large-network-graphs-on-the-web-d122ece2f4dc)
- [JS Graph Lib Comparison](https://github.com/cytoscape/js-graph-lib-comparison)

#### Graphology.js — O Backbone de Dados

Graphology.js e a biblioteca de estrutura de dados de grafos para JavaScript. Nao faz render — ela gerencia os dados. Sigma.js usa Graphology como backend.

**Por que importa para o Segundo Cerebro**:
- **Community detection** via Louvain algorithm: detecta clusters de topicos automaticamente
  - Benchmark: 1000 nodes, 9724 edges → 8 comunidades, modularity 0.4294 em 52ms
- **Metricas de grafo**: betweenness centrality (nodes que "fazem ponte" entre ideias), PageRank, densidade
- **TypeScript nativo**: tipos inclusos, peer dependency natural
- **Exporta/importa**: GEXF, GraphML, JSON
- Usado pelo InfraNodus (ver abaixo)

**Fonte**: [Graphology.js](https://graphology.github.io/)

---

### 1.2 Mind Maps com IA — Geracao Automatica

#### Do texto ao mapa: pipeline de processamento

```
Texto/documento
    → Embedding (sentence-transformers: all-MiniLM-L6-v2)
    → Clustering (HDBSCAN ou BERTopic)
    → Topic hierarchy detection
    → Knowledge graph (nodes = conceitos, edges = co-ocorrencia/similaridade semantica)
    → Visualization (force-directed graph)
```

#### BERTopic — Modelagem de Topicos Estado-da-Arte

Pipeline padrao: sentence-transformers → UMAP (reducao dimensional) → HDBSCAN (clustering) → c-TF-IDF (representacao de topicos)

**Funcionalidades relevantes**:
- **Hierarchical topic reduction**: merge de topicos similares baseado em cosine similarity entre embeddings
- **Visualizacoes built-in**: intertopic distance maps, bar charts, topic hierarchies (Plotly)
- **Dynamic topics**: como topicos evoluem ao longo do tempo (perfeito para timeline do Segundo Cerebro)
- **Custom embeddings**: aceita qualquer modelo sentence-transformer ou embedding proprio

**Fonte**: [BERTopic](https://bertopic.com/)

#### InfraNodus — Analise de Redes de Texto

InfraNodus e o projeto existente mais proximo do que queremos para mind maps. Open source (Node.js), usa Sigma.js + Graphology + Neo4j.

**Algoritmo central**:
1. Cada palavra/hashtag unica = um node
2. Co-ocorrencia = edge
3. Betweenness centrality = influencia discursiva
4. Community detection = topicos
5. **Structural gaps**: buracos no grafo onde topicos poderiam se conectar mas nao se conectam = oportunidades de insight

**Killer feature**: Gap detection — identificar lacunas no conhecimento pessoal e sugerir conexoes.

**Fontes**:
- [InfraNodus](https://infranodus.com)
- [Paper: InfraNodus - Generating Insight Using Text Network Analysis (WWW'19)](https://dl.acm.org/doi/pdf/10.1145/3308558.3314123)

#### MindMap (Paper Academico) — Knowledge Graphs + LLMs

Paper: "MindMap: Knowledge Graph Prompting Sparks Graph of Thoughts in Large Language Models" (arXiv 2308.09729)

Abordagem: usar knowledge graphs (KGs) para melhorar a inferencia de LLMs. O LLM compreende inputs de KG e raciocina combinando conhecimento implicito e externo. O "mind map" do LLM revela seus caminhos de raciocinio baseados na ontologia do conhecimento.

**Fonte**: [MindMap Paper](https://arxiv.org/html/2308.09729v5)

#### Ferramentas Existentes de Referencia

| Ferramenta | Abordagem | Open Source? |
|---|---|---|
| **Obsidian Graph View** | Links bidirecionais entre notes → grafo force-directed | Plugin open source, app freemium |
| **Logseq** | Similar a Obsidian, graph-first | Open source (AGPL) |
| **Roam Research** | Pioneiro do backlink graph | Closed source |
| **Think Machine** | Concept maps 3D com IA (Wayfinder AI). Baseado em Thinkable Type (open source). Primeiro workspace AI-native de pesquisa com grafos 3D | Parcialmente open source |
| **Mind Cortex** | "AI-Powered Second Brain" com PARA methodology e knowledge graph viz | Closed source |
| **Nodus Labs** | Rhizomatic mind maps via text network analysis. Mesma equipe do InfraNodus | Parcialmente open source |

**Fontes**:
- [Think Machine](https://thinkmachine.com/)
- [Mind Cortex](https://mindcortex.ai/)
- [Nodus Labs](https://noduslabs.com/featured/generate-mind-maps-text-gpt3-ai/)
- [Obsidian AI Second Brain Guide 2026](https://www.nxcode.io/resources/news/obsidian-ai-second-brain-complete-guide-2026)

---

### 1.3 Features Interativas Necessarias

#### Zoom Semantico (Overview → Cluster → Node)

```
Level 1 — Overview: todo o grafo, cores por comunidade (Louvain), nodes = pontos
Level 2 — Cluster: zoom em uma comunidade, nodes = titulos, edges = forca de conexao
Level 3 — Node: click abre conteudo completo, metadata, brain region, emocao
```

**Implementacao**: react-force-graph suporta zoom nativo. Node styling dinamico baseado em zoom level via `nodeCanvasObject` callback. Sigma.js tem `reducers` que recalculam estilo por frame.

#### Filtros Multi-dimensionais

- **Por topico**: usar community labels do Louvain
- **Por data**: slider temporal (min-max date)
- **Por fonte**: chat, documento, voz, web
- **Por pessoa**: quem disse/escreveu
- **Por regiao cerebral**: filtrar por tipo cognitivo (ver Parte 2)
- **Por emocao**: filtrar por emocao dominante (ver Parte 3)

#### Forca de Conexao Visual

- **Edge thickness** = cosine similarity entre embeddings dos dois nodes
- **Edge color** = tipo de relacao (semantica, temporal, causal, emocional)
- Limiar configuravel: mostrar so edges acima de X% de similaridade

#### Reorganizacao Manual + IA

- **Drag nodes** para reorganizar (react-force-graph suporta nativo)
- **IA sugere organizacao**: "Estes 3 clusters estao relacionados — devo criar um super-cluster?"
- **Pin nodes**: fixar posicao de nodes importantes
- Layout switching: force-directed ↔ hierarchical ↔ radial ↔ grid

---

## PARTE 2: MAPEAMENTO POR REGIAO CEREBRAL (NEUROCIENCIA)

### 2.1 Neurociencia da Cognicao — Regioes e Funcoes

#### Mapa completo de regioes → funcoes cognitivas

| Regiao | Funcoes Primarias | Tipos de Conhecimento Relevantes |
|---|---|---|
| **Cortex Pre-frontal** | Planejamento, tomada de decisao, personalidade, working memory | Estrategia de negocios, metas, decisoes |
| **Hipocampo** | Formacao de memorias, memoria espacial, consolidacao | Memorias autobiograficas, narrativas, eventos |
| **Amigdala** | Emocoes, medo, memoria emocional | Experiencias emocionalmente carregadas |
| **Lobo Temporal** | Linguagem, processamento auditivo, semantica | Textos literarios, conversas, musica |
| **Lobo Parietal** | Raciocinio espacial, matematica, integracao sensorial | Construcao, design, calculo, mapas |
| **Lobo Occipital** | Processamento visual | Imagens, design visual, arte |
| **Area de Broca** (frontal inferior) | Producao de fala, gramatica | Escrita, discurso, apresentacoes |
| **Area de Wernicke** (temporal superior) | Compreensao de linguagem | Leitura, escuta, interpretacao |
| **Default Mode Network** (mPFC + PCC + angular gyrus + hipocampo) | Devaneio, auto-reflexao, criatividade, pensamento divergente | Ficcao, reflexoes pessoais, brainstorming |
| **Cerebelo** | Memoria procedural, habilidades motoras, aprendizado gradual | Tecnicas de construcao, artesanato, esportes |
| **Insula** | Autoconsciencia, experiencia emocional, interocecao | Autoconhecimento, mindfulness, intuicao |
| **Ganglios da Base** (neostriatum) | Habitos, processamento de recompensa, aprendizado por feedback | Rotinas, habitos produtivos, gamificacao |

#### Taxonomia de Squire — Base Neurocientifica

A taxonomia de memoria de Squire (2004) e a base academica mais aceita:

```
Memoria de Longo Prazo
├── Declarativa (explicita) → Lobo Temporal Medial / Hipocampo
│   ├── Episodica (eventos autobiograficos) → Hipocampo
│   └── Semantica (fatos, conceitos) → Neocortex temporal
└── Nao-Declarativa (implicita)
    ├── Procedural (habilidades) → Ganglios da Base + Cerebelo
    ├── Priming → Neocortex
    ├── Condicionamento classico
    │   ├── Emocional → Amigdala
    │   └── Esqueletico → Cerebelo
    └── Aprendizado nao-associativo → Vias reflexas
```

**Fontes**:
- [Squire (2004) — Memory Systems of the Brain](http://whoville.ucsd.edu/PDFs/384_Squire_%20NeurobiolLearnMem2004.pdf)
- [Taxonomy diagram](https://www.researchgate.net/figure/a-taxonomy-of-long-term-memory-systemSquire-2004_fig1_228638738)
- [Structure and Function of Declarative and Nondeclarative Memory Systems (PNAS)](https://www.pnas.org/doi/10.1073/pnas.93.24.13515)

---

### 2.2 Classificacao de Conhecimento por Tipo Cognitivo

#### O Problema Central

Como classificar automaticamente um bloco de conhecimento (nota, trecho de conversa, documento) em um "tipo cognitivo" que mapeie para regioes cerebrais?

#### Proposta: LLM Cognitive Classifier

Usar um LLM (Claude, GPT, ou modelo local) com prompt estruturado para classificar cada bloco:

```json
{
  "input": "Quando eu era crianca, meu avo me ensinou a fazer uma estante de madeira. O cheiro de serragem me lembra dele ate hoje.",
  "classification": {
    "primary_type": "episodic_memory",
    "secondary_types": ["procedural_knowledge", "emotional_memory"],
    "brain_regions": {
      "hippocampus": 0.9,
      "cerebellum": 0.6,
      "amygdala": 0.7,
      "parietal_lobe": 0.4
    },
    "cognitive_signature": "autobiographical + procedural + emotional",
    "squire_taxonomy": "declarative.episodic + non_declarative.procedural"
  }
}
```

#### Prompt Template para Classificacao Cognitiva

```
Voce e um neurocientista cognitivo. Classifique o seguinte bloco de conhecimento
de acordo com a taxonomia de memoria de Squire e mapeie para regioes cerebrais.

Para cada regiao cerebral, de um score de 0.0 a 1.0 representando o quanto essa
regiao seria ativada se uma pessoa estivesse processando esse conteudo.

Regioes disponiveis:
- prefrontal_cortex: planejamento, decisao, estrategia
- hippocampus: memorias episodicas, narrativas, eventos
- amygdala: conteudo emocional, medo, alegria intensa
- temporal_lobe: linguagem, processamento auditivo
- parietal_lobe: raciocinio espacial, matematica, construcao
- occipital_lobe: conteudo visual, imagens
- broca_area: producao de linguagem, escrita
- wernicke_area: compreensao de linguagem
- default_mode_network: reflexao pessoal, criatividade, devaneio
- cerebellum: procedimentos, habilidades motoras, tecnicas manuais
- insula: autoconsciencia, emocao profunda, intuicao
- basal_ganglia: habitos, rotinas, aprendizado por repeticao

Bloco de conhecimento:
"{text}"

Responda em JSON.
```

#### Exemplos de Mapeamento

| Bloco de Conhecimento | Regiao Primaria | Regioes Secundarias |
|---|---|---|
| "Quando eu era crianca, passei ferias na praia com minha familia" | Hipocampo (episodico) | Amigdala (emocional), Lobo Occipital (visual) |
| "Para cortar meia-esquadria, ajuste a serra em 45 graus" | Cerebelo (procedural) | Parietal (espacial), Broca (instrucional) |
| "Acho que devo investir em renda fixa nesse cenario macro" | Pre-frontal (decisao) | Temporal (semantico) |
| "Era uma noite escura e tempestuosa. O velho farol piscava..." | DMN (criativo) | Temporal (linguagem), Occipital (visual) |
| "Sempre acordo as 5h, tomo cafe, medito 10 min e vou treinar" | Ganglios da Base (habito) | Pre-frontal (autocontrole), Cerebelo (motor) |
| "Me sinto ansioso sobre o futuro do projeto" | Amigdala (emocional) | Insula (autoconsciencia), Pre-frontal (avaliacao) |

#### Pesquisa Academica Relevante

**Neurosynth**: Plataforma de meta-analise com 10,000+ estudos e 360,000+ ativacoes. Permite "reverse inference" — dado padrao de ativacao, infere funcao cognitiva. Base de dados aberta.

**Cognitive Atlas**: Ontologia aberta de ciencia cognitiva. Distingue entre "mental concepts" (processos inobservaveis) e "mental tasks" (operacoes de medicao). Pode servir como vocabulario controlado para o classifier.

**Paper: Atlases of Cognition with Large-Scale Human Brain Mapping (PLOS Computational Biology)**: Decoders ontology-informed superam logistic regression, naive Bayes, e Neurosynth decoding. Mostram que e possivel atribuir conceitos cognitivos corretos a uma tarefa desconhecida.

**Paper: Information-Restricted Neural Language Models Reveal Different Brain Regions' Sensitivity (MIT Press)**: Mostra que IFG (Broca) prioriza semantica/sintaxe word-level, enquanto STG prioriza processamento acustico/fonologico. LLMs de camadas mais profundas correspondem a atividade cerebral mais tardia, especialmente em Broca.

**Fontes**:
- [Neurosynth](https://neurosynth.org/)
- [Cognitive Atlas](https://www.cognitiveatlas.org/)
- [Atlases of Cognition (PLOS)](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1006565)
- [Neurosynth Compose](https://compose.neurosynth.org/)
- [Neural Language Models and Brain Regions (MIT Press)](https://direct.mit.edu/nol/article/4/4/611/117823/Information-Restricted-Neural-Language-Models)

---

### 2.3 Visualizacao 3D do Cerebro

#### Projetos Open Source de Referencia

| Projeto | Stack | Destaques | GitHub |
|---|---|---|---|
| **3D-BrainMap** | React + Three.js + React Three Fiber + Styled Components | Regioes clicaveis com info cientifica. **Melhor ponto de partida para o Segundo Cerebro** | [EmreML/3D-BrainMap](https://github.com/EmreML/3D-BrainMap) |
| **threejs-brain-animation** | React + Three.js | Componente React para brain 3D com highlight, zoom, pan, cor customizavel | [bytezpro/threejs-brain-animation](https://github.com/bytezpro/threejs-brain-animation) |
| **three-brain-js** | Three.js + WebGL2 | Engine para FreeSurfer surfaces, MRI overlays, voxel cubes. Usado pelo projeto RAVE | [dipterix/three-brain-js](https://github.com/dipterix/three-brain-js) |
| **BrainBrowser** | WebGL + HTML5 | Da McGill University. Surface viewer + volume viewer. Maduro, academico | [aces/brainbrowser](https://github.com/aces/brainbrowser) |
| **Neuroglancer** | WebGL (Google) | Viewer volumetrico. Multi-threaded, altissima performance. Para datasets massivos | [google/neuroglancer](https://github.com/google/neuroglancer) |
| **NiiVue** | WebGL2 | 30+ formatos. NIfTI, FreeSurfer, GIfTI nativo. Modular (Angular/Vue/React/vanilla) | [niivue/niivue](https://github.com/niivue/niivue) |
| **brainrender** | Python (vedo/VTK) | Da BrainGlobe. Atlas API integrada (mouse, zebrafish, human). Heatmaps built-in | [brainglobe/brainrender](https://github.com/brainglobe/brainrender) |
| **brainglobe-heatmap** | Python (matplotlib + brainrender) | Heatmaps anatomicos: scalar values por regiao → cor → viz 2D/3D | [brainglobe/brainglobe-heatmap](https://github.com/brainglobe/bg-heatmaps) |
| **BrainFacts 3D Brain** | Web interativo | Da Society for Neuroscience. Modelo interativo educacional | [brainfacts.org/3d-brain](https://www.brainfacts.org/3d-brain) |

#### Modelos 3D do Cerebro — Onde Conseguir

| Fonte | Formato | Regioes Segmentadas? | Notas |
|---|---|---|---|
| **Brainder.org** | Blender / mesh de MRI real | Sim | Cerebro humano real de MRI, segmentavel |
| **Sketchfab** | GLTF/GLB | Sim (modelo "Brain with labeled parts") | Free download, pronto para Three.js |
| **Allen Human Brain Atlas** | NIfTI / API | Sim (141 estruturas) | Parcellacao 3D volumetrica de atlas |
| **FreeSurfer** | Surface formats (.pial, .white, .inflated) | Sim (Desikan-Killiany atlas: 68 regioes) | Gold standard academico |
| **CGTrader / TurboSquid** | OBJ/FBX/GLB | Varia | Modelos artisticos e medicos |

#### Estrategia de Render: Cerebro Translucido com Regioes Brilhando

**Stack recomendado**:
```
React Three Fiber
├── @react-three/fiber (core)
├── @react-three/drei (helpers: OrbitControls, Html, useGLTF)
├── @react-three/postprocessing (bloom, selective bloom)
└── Custom GLSL shaders (fake-glow-material-r3f)
```

**Tecnica de glow**:
1. **Cerebro base**: mesh semi-transparente (opacity 0.15-0.3, glass-like material)
2. **Regioes ativas**: meshes separadas por regiao, cada uma com `emissive` color
3. **Bloom post-processing**: UnrealBloomPass ou SelectiveBloom (so nas regioes ativas)
4. **Fake glow shader**: Alternativa mais performatica — shader GLSL que calcula glow baseado na normal da superficie vs view vector. Nao precisa de post-processing.
   - Repo: [ektogamat/fake-glow-material-r3f](https://github.com/ektogamat/fake-glow-material-r3f)

**Intensidade do glow** = score de ativacao cognitiva (0.0-1.0) do classificador
**Cor do glow** = tipo cognitivo ou emocao dominante

**Fontes**:
- [3D-BrainMap](https://github.com/EmreML/3D-BrainMap)
- [threejs-brain-animation](https://github.com/bytezpro/threejs-brain-animation)
- [fake-glow-material-r3f](https://github.com/ektogamat/fake-glow-material-r3f)
- [Allen Brain Atlas](https://atlas.brain-map.org/)
- [Brainder Brain for Blender](https://brainder.org/research/brain-for-blender/)
- [WebGL-based Visualization of Voxelized Brain Models](https://diglib.eg.org/items/b5b1b5f9-714c-4a90-b272-efb1363e1f78)

---

### 2.4 Ativacao Cerebral em Tempo Real

#### Conceito

Quando o usuario esta conversando sobre topico X, as regioes cerebrais relacionadas ao tipo cognitivo do topico brilham no modelo 3D em tempo real.

#### Pipeline de Ativacao

```
Input do usuario (texto ou voz)
    → Classificacao cognitiva (LLM ou modelo local)
    → Scores por regiao cerebral (0.0-1.0)
    → Envio via WebSocket para o frontend
    → React Three Fiber atualiza emissive/glow de cada regiao
    → Animacao suave (lerp entre estados)
```

#### Implementacao Tecnica

```typescript
// Pseudocodigo React Three Fiber
interface BrainActivation {
  prefrontal_cortex: number;  // 0.0-1.0
  hippocampus: number;
  amygdala: number;
  temporal_lobe: number;
  parietal_lobe: number;
  occipital_lobe: number;
  cerebellum: number;
  default_mode_network: number;
  insula: number;
  basal_ganglia: number;
}

// No componente da regiao:
function BrainRegion({ name, activation, color }) {
  const meshRef = useRef();

  useFrame(() => {
    // Lerp suave para nova ativacao
    meshRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
      meshRef.current.material.emissiveIntensity,
      activation,
      0.05 // velocidade da transicao
    );
  });

  return (
    <mesh ref={meshRef}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={activation}
        transparent
        opacity={0.3 + activation * 0.5}
      />
    </mesh>
  );
}
```

#### Linhas de Conexao Entre Regioes

Quando dois tipos cognitivos disparam juntos (ex: hipocampo + cerebelo para "memoria de construcao"), renderizar uma linha luminosa entre as duas regioes:

- **Espessura** = correlacao entre os scores
- **Cor** = blend das cores das duas regioes
- **Animacao** = particulas fluindo pela linha (tipo "neural signal")

#### Heatmap Temporal

Acumular ativacoes ao longo do tempo para gerar um heatmap:
- Quais regioes o usuario mais "usa" na semana/mes/ano?
- Baseado em brainglobe-heatmap (Python) ou implementacao custom em React

**Fontes**:
- [Real-time Brain Localization in 3D](https://thomaskosch.com/index.php/2016/09/28/visualizing-real-time-brain-localization-in-3d/)
- [brainglobe-heatmap](https://github.com/brainglobe/bg-heatmaps)

---

## PARTE 3: MAPEAMENTO EMOCIONAL

### 3.1 Modelos de Emocao

#### Tres Frameworks Principais

| Modelo | Dimensoes | Uso Ideal |
|---|---|---|
| **Plutchik's Wheel** | 8 emocoes primarias + combinacoes + intensidade | Classificacao categorica rica. Visual bonito |
| **Russell's Circumplex** | 2 dimensoes: Valence (positivo/negativo) + Arousal (ativado/calmo) | Simples, facil de plotar em 2D |
| **PAD Model** (Mehrabian & Russell) | 3 dimensoes: Pleasure + Arousal + Dominance | Mais completo. Mapeia qualquer emocao no espaco 3D |

**PAD para o Segundo Cerebro**: O modelo PAD e ideal porque:
1. Tres dimensoes mapeiam naturalmente para um espaco 3D (visual natural)
2. "Dominance" captura agency — crucial para distinguir "triste mas empoderado" de "triste e impotente"
3. Pode ser sobreposto no modelo cerebral como eixos adicionais

**Fontes**:
- [PAD Model (Wikipedia)](https://en.wikipedia.org/wiki/PAD_emotional_state_model)
- [GoEmotions Paper (ACL 2020)](https://aclanthology.org/2020.acl-main.372.pdf)
- [PyPlutchik Visualization](https://pmc.ncbi.nlm.nih.gov/articles/PMC8409663/)

### 3.2 Ferramentas de Classificacao Emocional

#### Para Texto

| Ferramenta | Emocoes | Base | Notas |
|---|---|---|---|
| **EmoRoBERTa** | 27 categorias (GoEmotions) | RoBERTa fine-tuned | MACRO F1: 0.493. Supera BERT baseline. Disponivel no HuggingFace |
| **GoEmotions** | 27 categorias + Neutral | Dataset 58k Reddit comments | De Google Research. Categorias mapeiam para Plutchik/Ekman |
| **text2emotion** | 5 emocoes basicas | Regras + lexicon | Leve, nao precisa de GPU |
| **NRCLex** | 8 emocoes (Plutchik) + pos/neg | NRC Emotion Lexicon | Baseado em dicionario, rapido, offline |
| **Sentiment pipeline (Transformers)** | Pos/Neg/Neutral | Qualquer modelo HF | Para uso rapido/basico |

**Recomendacao**: EmoRoBERTa para classificacao rica (27 emocoes). Para uso local sem GPU: NRCLex ou text2emotion.

#### Para Voz

| Ferramenta | Tecnica | Precisao |
|---|---|---|
| **SpeechBrain + Wav2Vec2** | Fine-tuned Wav2Vec2 no IEMOCAP | >90% em benchmarks |
| **HuBERT** (Meta) | Self-supervised speech representation | Comparavel a Wav2Vec2, melhor em contextos ruidosos |
| **Wav2Vec2 RAVDESS models** | Fine-tuned em SAVEE + RAVDESS + TESS | Multiplos modelos disponiveis no HuggingFace |
| **openSMILE** | Feature extraction (7000 parametros acusticos) | Classico, robusto |
| **Deepgram** | API comercial | Real-time sentiment em streaming |

**Pipeline recomendado para voz**:
```
Audio → Wav2Vec2/HuBERT (feature extraction)
     → Emotion classifier head (fine-tuned)
     → Scores por emocao (PAD ou categorica)
     → Merge com classificacao de texto (pesos configuraveis)
```

**Parametros acusticos chave**: pitch (frequencia fundamental), ritmo de fala, volume, pausas, qualidade vocal (jitter/shimmer), prosody patterns.

**Fontes**:
- [SpeechBrain Wav2Vec2 Emotion Recognition](https://huggingface.co/speechbrain/emotion-recognition-wav2vec2-IEMOCAP)
- [Wav2Vec2 Speech Emotion Models on HuggingFace](https://huggingface.co/r-f/wav2vec-english-speech-emotion-recognition)
- [Top 7 Methods for Audio Sentiment Analysis](https://research.aimultiple.com/audio-sentiment-analysis/)
- [Voice Sentiment Analysis Techniques](https://dialzara.com/blog/top-7-sentiment-analysis-techniques-for-voice-ai)

### 3.3 Mapeamento Emocao → Regiao Cerebral

| Emocao/Estado | Regioes Primarias | Circuito |
|---|---|---|
| **Medo/Ansiedade** | Amigdala, Insula anterior | Amigdala → resposta fight-or-flight |
| **Alegria/Recompensa** | Nucleus accumbens (ganglios da base), mPFC | Circuito dopaminergico mesolimbico |
| **Tristeza** | Insula, cingulado anterior (ACC) | Network de salience |
| **Raiva** | Amigdala, OFC (cortex orbitofrontal) | Amigdala + desregulacao prefrontal |
| **Nostalgia** | Hipocampo, mPFC, ACC | Memoria episodica + avaliacao emocional |
| **Flow/Criatividade** | DMN + frontoparietal network | Alternancia entre focused e defocused |
| **Empatia** | Insula anterior, ACC, mPFC | Mirror neuron system + mentalizing |
| **Regulacao emocional** | dlPFC, vlPFC → Amigdala (top-down) | Controle cognitivo sobre emocao |

**Paper chave**: "The amygdala-insula-medial prefrontal cortex-lateral prefrontal cortex pathway and its disorders" (Frontiers in Neuroanatomy, 2022) — descreve o circuito de 4 estacoes do processamento emocional:
1. Amigdala → features corporais discretas
2. Insula anterior → padroes corporais inteiros
3. mPFC (BA9) → integracao de conceitos emocionais
4. lPFC (BA9) → selecao/inibicao

**Fonte**: [Amygdala-Insula-PFC Pathway (Frontiers)](https://www.frontiersin.org/journals/neuroanatomy/articles/10.3389/fnana.2022.1028546/full)

### 3.4 Padroes Emocionais ao Longo do Tempo

#### Visualizacao: Heatmap Emocional no Calendario

**Stack**:
- `reactjs-calendar-heatmap` (D3.js based) ou `react-d3-calendar-heatmap`
- Cada dia = cor baseada na emocao dominante
- Hover mostra breakdown de emocoes do dia
- Zoom: ano → mes → semana → dia → hora

**Metricas derivadas**:
- Variabilidade emocional (desvio padrao do PAD ao longo da semana)
- Correlacao emocao/produtividade (se integrado com tracking de tarefas)
- Padroes sazonais (usar dados de meses para detectar ciclicidade)
- Trigger detection: "Conversas sobre X correlacionam com queda em Pleasure"

**Fontes**:
- [reactjs-calendar-heatmap](https://github.com/g1eb/reactjs-calendar-heatmap)
- [Cal-HeatMap](https://cal-heatmap.com/v2/)
- [D3 Calendar Heatmap](https://github.com/DKirwan/calendar-heatmap)

---

## PARTE 4: VISAO DE INTEGRACAO COMPLETA

### 4.1 Arquitetura do Sistema Integrado

```
┌───────────────���─────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                       │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Mind Map │  │ 3D Brain │  │ Timeline │  │ Emotion  │       │
│  │  View    │  │  View    │  │  View    │  │ Heatmap  │       │
│  │          │  │          │  │          │  │  View    │       │
│  │ react-   │  │ R3F +    │  │ D3.js +  │  │ cal-     │       │
│  │ force-   │  │ GLTF +   │  │ calendar │  │ heatmap  │       │
│  │ graph-3d │  │ shaders  │  │ heatmap  │  │ + PAD    │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │             │
│       └──────────────┴──────┬───────┴──────────────┘             │
│                             │                                    │
│                    ┌────────▼────────┐                           │
│                    │  State Manager  │                           │
│                    │  (Zustand)      │                           │
│                    │                 │                           │
│                    │ - selected node │                           │
│                    │ - active topic  │                           │
│                    │ - brain scores  │                           │
│                    │ - emotion state │                           │
│                    │ - time range    │                           │
│                    └────────┬────────┘                           │
│                             │ WebSocket                          │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                        BACKEND                                   │
│                                                                  │
│  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐     │
│  │ Cognitive   │  │ Emotion        │  │ Knowledge Graph  │     │
│  │ Classifier  │  │ Classifier     │  │ Engine           │     │
│  │             │  │                │  │                  │     │
│  │ LLM prompt  │  │ EmoRoBERTa     │  │ Graphology.js    │     │
│  │ chain +     │  │ (texto) +      │  │ + BERTopic       │     │
│  │ Squire      │  │ Wav2Vec2 (voz) │  │ + Embeddings     │     │
│  │ taxonomy    │  │ + PAD mapping  │  │ (sentence-       │     │
│  │             │  │                │  │  transformers)   │     │
│  └──────┬──────┘  └───────┬────────┘  └────────┬─────────┘     │
│         │                 │                     │                │
│         └─────────────────┴──────┬──────────────┘                │
│                                  │                               │
│                         ┌────────▼────────┐                     │
│                         │  Knowledge      │                     │
│                         │  Block Store    │                     │
│                         │                 │                     │
│                         │  SQLite +       │                     │
│                         │  ChromaDB       │                     │
│                         │  (vectors)      │                     │
│                         └─────────────────┘                     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐        │
│  │                META-AGENT (Amazo)                    │        │
│  │                                                     │        │
│  │  Observa todos os dados e gera insights:            │        │
│  │  - Padroes de ativacao cerebral                     │        │
│  │  - Correlacoes emocionais                           │        │
│  │  - Lacunas no conhecimento (gap detection)          │        │
│  │  - Sugestoes de conexoes                            │        │
│  │  - Narrativas sobre o "perfil cognitivo" do usuario │        │
│  └─────────────────────────────────────────────────────┘        │
└──────────────────────────────��───────────────────────────────────┘
```

### 4.2 Fluxo de Dados — Exemplo Completo

**Cenario**: Cris esta conversando sobre tecnicas de construcao com envolvimento emocional.

```
1. INPUT: "Meu avo me ensinou a fazer encaixe de madeira tipo rabo de andorinha.
   Toda vez que pego uma serra, lembro dele. Era um artesao incrivel."

2. COGNITIVE CLASSIFIER:
   - hippocampus: 0.9 (memoria episodica forte)
   - cerebellum: 0.7 (conhecimento procedural: tecnica de encaixe)
   - amygdala: 0.8 (carga emocional: nostalgia, admiracao)
   - parietal_lobe: 0.5 (raciocinio espacial: encaixe 3D)
   - default_mode_network: 0.4 (reflexao pessoal)

3. EMOTION CLASSIFIER:
   - PAD: Pleasure=0.7, Arousal=0.4, Dominance=0.5
   - Categorias: nostalgia(0.8), admiracao(0.7), amor(0.5), tristeza(0.3)
   - Brain emotion mapping: amigdala + hipocampo + mPFC + ACC

4. KNOWLEDGE GRAPH UPDATE:
   - Novo node: "Encaixe rabo de andorinha"
   - Edges: → "Avo" (pessoa, peso 0.9)
            → "Marcenaria" (topico, peso 0.8)
            → "Tecnicas de construcao" (cluster, peso 0.7)
            → "Memorias de infancia" (cluster, peso 0.6)
   - Community: se junta ao cluster "Construcao/Artesanato"

5. 3D BRAIN UPDATE (via WebSocket):
   - Hipocampo brilha forte (azul, intensity 0.9)
   - Cerebelo brilha medio (verde, intensity 0.7)
   - Amigdala brilha forte (vermelho, intensity 0.8)
   - Linha luminosa: hipocampo ↔ cerebelo (co-ativacao)
   - Linha luminosa: hipocampo ↔ amigdala (memoria + emocao)

6. META-AGENT INSIGHT:
   "Quando Cris fala sobre construcao com envolvimento emocional,
    o hipocampo (memorias de infancia) e o cerebelo (conhecimento
    procedural) ativam juntos — sugerindo que sua expertise em
    construcao esta profundamente enraizada em experiencias
    formativas da infancia. A co-ativacao forte com a amigdala
    indica que essas memorias tem alta carga emocional, o que
    neurocientificamente correlaciona com melhor consolidacao
    e recuperacao de memoria."
```

### 4.3 Schema de Dados de um Knowledge Block

```typescript
interface KnowledgeBlock {
  id: string;
  content: string;
  source: 'chat' | 'document' | 'voice' | 'web' | 'manual';
  created_at: Date;
  updated_at: Date;

  // Cognitive classification
  cognitive_signature: {
    primary_type: CognitiveType;
    secondary_types: CognitiveType[];
    brain_regions: Record<BrainRegion, number>; // 0.0-1.0
    squire_taxonomy: string; // e.g., "declarative.episodic"
  };

  // Emotional classification
  emotional_signature: {
    pad: { pleasure: number; arousal: number; dominance: number };
    categories: Record<EmotionCategory, number>; // 27 GoEmotions
    dominant_emotion: string;
    voice_emotion?: { // se veio de voz
      pitch_mean: number;
      speech_rate: number;
      emotion_from_prosody: string;
    };
  };

  // Graph position
  graph: {
    embedding: number[]; // vector 384-dim (all-MiniLM-L6-v2)
    cluster_id: string;
    cluster_label: string;
    connections: Array<{
      target_id: string;
      weight: number; // cosine similarity
      type: 'semantic' | 'temporal' | 'causal' | 'emotional' | 'person';
    }>;
  };

  // Metadata
  metadata: {
    people: string[];
    topics: string[];
    tags: string[];
    language: string;
  };
}

type CognitiveType =
  | 'episodic_memory'
  | 'semantic_knowledge'
  | 'procedural_knowledge'
  | 'emotional_memory'
  | 'creative_thought'
  | 'strategic_planning'
  | 'spatial_reasoning'
  | 'linguistic_production'
  | 'habit_routine'
  | 'self_reflection';

type BrainRegion =
  | 'prefrontal_cortex'
  | 'hippocampus'
  | 'amygdala'
  | 'temporal_lobe'
  | 'parietal_lobe'
  | 'occipital_lobe'
  | 'broca_area'
  | 'wernicke_area'
  | 'default_mode_network'
  | 'cerebellum'
  | 'insula'
  | 'basal_ganglia';

type EmotionCategory =
  | 'admiration' | 'amusement' | 'anger' | 'annoyance'
  | 'approval' | 'caring' | 'confusion' | 'curiosity'
  | 'desire' | 'disappointment' | 'disapproval' | 'disgust'
  | 'embarrassment' | 'excitement' | 'fear' | 'gratitude'
  | 'grief' | 'joy' | 'love' | 'nervousness'
  | 'optimism' | 'pride' | 'realization' | 'relief'
  | 'remorse' | 'sadness' | 'surprise' | 'neutral';
```

### 4.4 Karpathy's LLM Knowledge Base — Arquitetura Alternativa

Andrej Karpathy propoe uma abordagem que evita RAG/vector databases para knowledge management pessoal:

**Arquitetura de 3 camadas**:
1. **Raw Sources** (imutaveis): PDFs, artigos, transcricoes
2. **The Wiki** (LLM-maintained): diretorio de markdown files mantido inteiramente pelo LLM
3. **The Schema**: configuracao que diz ao agente como estruturar o wiki

**Insight chave**: "Sem RAG necessario — sem vector databases, sem embedding pipelines, sem infraestrutura de retrieval. Apenas arquivos raw, um LLM com context window grande o suficiente, e markdown."

**Relevancia para o Segundo Cerebro**: Para knowledge blocks pequenos/medios (<10k notas), a abordagem Karpathy pode ser mais simples que ChromaDB. O LLM pode manter um "wiki" organizado E classificar cognitivamente/emocionalmente cada bloco. Mas para busca semantica em escala, vectors continuam necessarios.

**Fontes**:
- [Karpathy's LLM Knowledge Base (VentureBeat)](https://venturebeat.com/data/karpathy-shares-llm-knowledge-base-architecture-that-bypasses-rag-with-an)
- [LLM Wiki Gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [NicholasSpisak/second-brain (Obsidian implementation)](https://github.com/NicholasSpisak/second-brain)

---

## DECISOES TECNICAS RECOMENDADAS

### Para MVP (v1)

| Componente | Escolha | Justificativa |
|---|---|---|
| **Mind map render** | react-force-graph-3d | React nativo, 3D, suporta 50k nodes, zoom/click/drag nativo |
| **Graph data** | Graphology.js | Louvain, metricas, TypeScript, backbone do Sigma.js |
| **Topic clustering** | BERTopic (Python backend) | Estado da arte, hierarchical, visualizacao built-in |
| **Cognitive classifier** | Claude/GPT via prompt chain | Mais flexivel, nao precisa de fine-tuning, JSON output |
| **Emotion text** | EmoRoBERTa (HuggingFace) | 27 emocoes, pre-treinado, F1 0.493 |
| **Emotion voice** | SpeechBrain Wav2Vec2 | Open source, IEMOCAP fine-tuned |
| **3D Brain** | React Three Fiber + GLTF model | Projeto 3D-BrainMap como base. Glow via fake-glow-material |
| **Brain model** | Sketchfab labeled brain (GLTF) | Pronto para uso, regioes ja segmentadas |
| **Emotion heatmap** | reactjs-calendar-heatmap | D3 based, React component, calendar layout |
| **State management** | Zustand | Leve, integra com R3F nativamente |
| **Real-time** | WebSocket (Socket.io) | Para streaming de ativacao cerebral durante chat |

### Para v2 (evolucao)

- Trocar react-force-graph-3d por Sigma.js se performance for problema com >50k nodes
- Fine-tune modelo local (Mistral/Llama) para cognitive classification sem depender de API
- Integrar NiiVue para overlay de atlas reais sobre o modelo artistico
- Adicionar VR support (react-force-graph ja tem wrapper AR/VR)
- Implementar gap detection (InfraNodus-style) no knowledge graph
- Conectar com Neurosynth API para validar os mapeamentos cognitivos

---

## REFERENCIAS ACADEMICAS CHAVE

1. **Squire, L. R. (2004)**. Memory systems of the brain: A brief history and current perspective. *Neurobiology of Learning and Memory*, 82, 171-177.

2. **Schrimpf et al. (2021)**. The neural architecture of language: Integrative modeling converges on predictive processing. *PNAS*, 118(45).

3. **Caucheteux & King (2022)**. Brains and algorithms partially converge in natural language processing. *Communications Biology*, 5(1).

4. **Chang et al. (2025)**. Natural language processing models reveal neural dynamics of human conversation. *Nature Communications*.

5. **Paranyushkin, D. (2019)**. InfraNodus: Generating Insight Using Text Network Analysis. *WWW '19*.

6. **Demszky et al. (2020)**. GoEmotions: A Dataset of Fine-Grained Emotions. *ACL 2020*.

7. **Varoquaux et al. (2018)**. Atlases of cognition with large-scale human brain mapping. *PLOS Computational Biology*.

8. **Chang et al. (2022)**. Mapping effective connectivity of human amygdala subdivisions with intracranial stimulation. *Nature Communications*.

9. **Salo et al. (2023)**. Decoding brain activity using a large-scale probabilistic functional-anatomical atlas. *PLOS Computational Biology*.

10. **Claudi et al. (2021)**. Visualizing anatomically registered data with brainrender. *eLife*.

---

## RISCOS E CONSIDERACOES

1. **Reduccionismo neurocientfico**: Mapear texto → regiao cerebral e uma simplificacao. O cerebro real tem networks distribuidos, nao "centros" isolados. O sistema deve ser apresentado como metafora educativa, nao como scan cerebral real.

2. **Precisao do classifier**: A classificacao cognitiva via LLM nao e validada cientificamente para uso clinico. E uma heuristica util, nao um diagnostico.

3. **Performance**: Renderizar 3D brain + force graph + heatmap simultaneamente pode ser pesado. Considerar lazy loading e render condicional.

4. **Privacidade emocional**: Dados emocionais sao extremamente sensiveis. Tudo local-first. Nunca enviar emotion data para cloud sem consentimento explicito.

5. **Scope creep**: Este e o componente mais ambicioso. MVP deve focar em mind map + cognitive tags basicos. Brain 3D e emocoes podem vir em fases posteriores.
