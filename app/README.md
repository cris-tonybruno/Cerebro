# Cérebro — M1 (Fundação)

Chat de texto com o Claude Principal + memória com zonas + Memory Browser + export + contador de custo.
Deliberadamente feio. Sem voz, sem conselho, sem polimento — isso vem nos próximos milestones
(ver `../CEREBRO_DIRECTIVE.md`).

**Gate de sucesso do M1:** usar todo dia por uma semana e sentir falta quando não usar.

## Setup (uma vez)

### 1. Supabase
1. Criar um projeto **novo** chamado `cerebro` em [supabase.com](https://supabase.com)
   (NÃO reutilizar o onsite-core — este projeto é pessoal, do lab).
2. Abrir **SQL Editor** no dashboard e colar o conteúdo de
   `../supabase/migrations/0001_init.sql`. Rodar.
3. Copiar de **Settings → API**: a URL do projeto e a chave `service_role`.

### 2. Chaves de API
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) → API Keys
- **OpenAI**: [platform.openai.com](https://platform.openai.com) → API Keys (usada só para embeddings, centavos/mês)

### 3. Ambiente local
```bash
cd app
cp .env.example .env.local
# preencher .env.local com as chaves + inventar uma APP_PASSWORD
npm install
npm run dev
```
Abrir http://localhost:3000 → tela de senha → chat.

### 4. Deploy na Vercel
```bash
npx vercel
```
Adicionar as mesmas variáveis do `.env.local` em **Settings → Environment Variables**
no dashboard da Vercel. Depois `npx vercel --prod`.

No celular: abrir a URL no Chrome → menu → "Adicionar à tela inicial" (PWA).

## O que tem dentro

| Rota | O que faz |
|---|---|
| `/` | Chat com o Claude Principal (streaming). Cada turno vira memória episódica + training pair; um classificador barato (Haiku) extrai memórias semânticas e classifica a zona. |
| `/memory` | Memory Browser — toda memória é legível, editável, reclassificável e apagável. Nada escondido. |
| `/api/export?format=json` | Export completo (turnos, memórias, training pairs). |
| `/api/export?format=md` | Memórias em markdown legível, por zona. |
| `/api/costs` | Gasto do mês vs budget (aparece no topo do chat; amarelo a partir de 80%). |

## Custos
- Chat: Claude Opus 4.8 ($5/$25 por MTok) — trocável via `CLAUDE_MODEL`
- Extração de memória: Claude Haiku 4.5 ($1/$5 por MTok)
- Embeddings: OpenAI text-embedding-3-small ($0.02 por MTok)
- Budget mensal: `MONTHLY_BUDGET_CAD` (default 50). O contador soma tudo.
