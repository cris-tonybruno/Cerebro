# 07 — Privacidade, Guardrails e Legalidade

> Status: PESQUISA COMPLETA · Abril 2026
> Decisao pendente: como definir os guardrails do Amazo?

---

## 1. Politicas de APIs sobre Dados Pessoais

### Resumo

| Provider | Treina com API? | Retencao | ZDR Disponivel | Seguro p/ dados sensiveis? |
|----------|----------------|----------|----------------|---------------------------|
| **Anthropic API** | NAO | 7 dias | Sim (enterprise) | Bom com ZDR |
| **OpenAI API** | NAO (default) | 30 dias | Sim (enterprise) | Bom com ZDR |
| **Google Vertex AI** | NAO | Varia | Termos enterprise | Bom p/ enterprise |
| **Tiers consumer (todos)** | Varia | Estendida | NAO | **NAO RECOMENDADO** |

### Detalhes

**Anthropic**: API nao treina. Retencao reduzida de 30 para **7 dias** em set 2025. ZDR para enterprise (zero armazenamento). Consumer (Free/Pro/Max): opt-in para data sharing. Dados podem ser retidos de-identified por ate 5 anos.

**OpenAI**: API nao treina por default desde marco 2023. Retencao 30 dias para abuse monitoring. ZDR disponivel.

**Google**: Enterprise/Vertex AI nao treina. Consumer Gemini pode usar dados. "Personal Intelligence" (acesso a Gmail/Chat/Meet) habilitado por default para usuarios US.

**Regra**: Usar SOMENTE tiers comerciais de API. NUNCA tiers consumer/free para dados pessoais.

---

## 2. Abordagem Hibrida: API vs Local

### O que pode ir para APIs
- Queries de conhecimento geral, escrita, geracao de codigo
- Sumarizacao de documentos nao-sensiveis
- Dados **anonimizados ou de-identificados**
- Tarefas criativas, brainstorming

### O que DEVE ficar local
- Registros medicos e informacoes de saude
- Dados financeiros (contas, impostos, investimentos)
- Conversas intimas
- Dados privados de outras pessoas
- Credenciais de autenticacao
- Documentos legais sob privilegio
- Dados biometricos
- Dados de localizacao

### Sistema de 4 niveis de sensibilidade

| Nivel | Classificacao | Roteamento | Exemplos |
|-------|--------------|------------|----------|
| 0 | Publico | Cloud API | Conhecimento geral |
| 1 | Interno | Cloud API com cautela | Seus documentos de trabalho |
| 2 | Confidencial | LOCAL APENAS | Financeiro, saude, dados de terceiros |
| 3 | Restrito | LOCAL + criptografado | Intimo, legal, autenticacao |

### Ferramentas para roteamento

- **LLMRouter** (open source): 16+ estrategias de roteamento. Ollama + cloud APIs
- **LiteLLM**: Conversao de formato, routing, fallbacks, observabilidade
- **NeMo Guardrails** (NVIDIA): PII detection com GLiNER. Content safety
- **Classificador local**: Modelo leve (DistilBERT ou Phi-4 Mini 3.8B) que roda localmente e classifica ANTES de rotear

---

## 3. Legalidade (Canada/Ontario)

### PIPEDA

- Aplica-se a atividade COMERCIAL. Sistema pessoal provavelmente tem **exempcao de uso pessoal**
- MAS: se usar insights comercialmente (negocios informados pela analise), PIPEDA pode se aplicar
- Nao testado em tribunal para sistemas AI pessoais
- Penalidades: ate C$100.000 por violacao
- Bill C-27 (substituiria PIPEDA + AIDA para AI) MORREU quando Parlamento foi prorogado em jan 2025

### Gravacao de conversas

**Canada = one-party consent** (Secao 184(2) do Criminal Code):
- Voce pode gravar qualquer conversa da qual PARTICIPA
- Seu proprio consentimento e suficiente
- NAO precisa informar a outra parte

**Limitacoes criticas**:
- Gravar conversas das quais NAO participa = CRIME
- Gravacao em locais com expectativa de privacidade (banheiros) = voyeurismo (Secao 162)
- Compartilhar gravacoes intimas sem consentimento = crime (Secao 162.1, ate 5 anos)

**Para o Amazo**: Pode gravar e transcrever suas proprias ligacoes e reunioes legalmente. MAS enviar essas transcricoes para API cloud = enviar palavras de terceiros para empresa terceira.

### Emails/mensagens de terceiros

- Emails recebidos estao na sua posse
- Voce NAO obteve consentimento para processa-los com AI
- Se usar insights em contexto comercial, PIPEDA pode se aplicar
- Remetentes tem expectativa razoavel de que emails nao serao processados por AI de terceiros

### GDPR (contatos na UE)

- GDPR se aplica INDEPENDENTE da sua localizacao se processar dados de pessoas na UE
- Base legal necessaria (consentimento dificil de obter retroativamente)
- Direito de apagamento: se dados estao em pesos de modelo via fine-tuning, deletar pode exigir retreinamento
- DPIA (Data Protection Impact Assessment) seria prudente

---

## 4. Guardrails para AI Pessoal

### Estado da seguranca de agentes AI (2025)

- 39% das empresas reportaram agentes acessando sistemas nao-intencionados
- 32% viram agentes permitindo downloads inapropriados
- 87% das empresas NAO tem framework de seguranca AI abrangente
- Prompt injection = risco #1 OWASP para aplicacoes LLM

### Prevencao de acoes autonomas danosas

1. **Principio do menor privilegio**: Minimas permissoes necessarias. Read-only por default
2. **Human-in-the-loop**: Confirmacao humana para acoes destrutivas/irreversiveis
3. **Escopo de acoes**: Allowlist explicita. Tudo fora da lista = proibido
4. **Circuit breakers**: Rate limits. Se AI tenta > N acoes/minuto, halt + alert

### Sandboxing

- Execucao em containers Docker
- Isolamento de rede
- Jails de filesystem (diretorios especificos)
- Mecanismos de rollback (snapshot antes de acoes)
- User accounts restritos (nunca root/admin)

### "Sem guardrails externos" na pratica

1. **Voce define as regras** — independente do que Claude/GPT recusaria
2. **Voce assume as consequencias**
3. **Guardrails de providers ainda existem no nivel de API** (seguranca infantil, armas, etc.)
4. **O risco real esta em acoes, nao texto** — AI uncensored que so gera texto = risco baixo. AI que executa codigo, envia emails, modifica arquivos = risco alto

### Ferramentas para guardrails proprios

- **NeMo Guardrails** (NVIDIA): Open source. PII detection, topic control, jailbreak prevention. Deploy local
- **Guardrails AI**: Validacao de I/O contra schemas customizados. Type checking

### Cautionary Tales (2025)

| Incidente | O que aconteceu | Licao |
|-----------|----------------|-------|
| Google Antigravity Agent | Deletou drive inteiro em vez de pasta especifica | Permissoes estreitas |
| Replit Coding Agent | Apagou banco de producao, gerou 4000 usuarios falsos para esconder bugs | Agentes mascaram falhas; verifique independentemente |
| OpenClaw iMessage | Enviou 500+ mensagens para usuario, esposa, contatos aleatorios | Rate limiting + validacao de output |
| AI Egg Purchase | Agente mandado verificar precos comprou ovos autonomamente | Separar "read" de "write" |
| SaaStr Database | AI modificou codigo de producao apesar de instrucoes contrarias | Instrucoes NAO sao guardrails; controles tecnicos sao |

**Regra chave**: Se AI tem 85% de precisao por acao, workflow de 10 passos so funciona ~20% do tempo.

---

## 5. A "3a IA": Roteador de Sensibilidade

### Arquitetura

```
           ┌─────────────┐
           │  Input do    │
           │  Usuario     │
           └──────┬──────┘
                  │
           ┌──────▼──────┐
           │ Classificador│  ← SEMPRE LOCAL
           │ de Sensib.   │
           │ (3a IA)      │
           └──────┬──────┘
                  │
        ┌─────────┴─────────┐
        │                   │
  ┌─────▼─────┐      ┌─────▼─────┐
  │ Nivel 0-1 │      │ Nivel 2-3 │
  │ Cloud API │      │ LOCAL     │
  │ (Claude)  │      │ (Ollama)  │
  └─────┬─────┘      └─────┬─────┘
        │                   │
        └─────────┬─────────┘
                  │
           ┌──────▼──────┐
           │ Agregador    │  ← SEMPRE LOCAL
           │ de Resposta  │
           └─────────────┘
```

### Implementacao

1. **Classificador (3a IA)**: Modelo local leve (DistilBERT fine-tuned ou Phi-4 Mini 3.8B) que examina input para PII, topicos sensiveis, patterns
2. **Path Cloud**: Nivel 0-1 → Claude API ou OpenAI API via LiteLLM
3. **Path Local**: Nivel 2-3 → Ollama com modelo capaz (Qwen 2.5-32B, etc.)

### Coerencia entre modelos

- **Context compaction**: Resumir conversa e reiniciar quando trocar modelo
- **Shared memory store**: Banco acessivel por ambos os paths
- **Sanitized context**: Resumo sanitizado quando enviar para cloud
- **Context bridges**: Modelo local gera resumos que mantem coerencia sem vazar dados

---

## 6. Soberania de Dados e Seguranca

### Criptografia
- **LUKS**: Full-disk encryption (configurar na instalacao do OS)
- **VeraCrypt**: Volumes para dados especialmente sensiveis
- **Backups criptografados**: `borg` ou `restic` com encryption

### Prevencao de telemetria
- VLAN separada para inferencia
- Firewall hardware entre servidor AI e internet
- DNS-level blocking (Pi-hole)
- Verificar SHA256 de modelos baixados
- Containers sem acesso de rede durante inferencia

### Acesso remoto
- **Tailscale**: VPN WireGuard. Sem portas abertas
- **Fail2ban**: Protecao contra brute-force SSH
- **Seguranca fisica**: Servidor em local trancado

### Backup 3-2-1
- 3 copias, 2 midias diferentes, 1 offsite
- Backups CRIPTOGRAFADOS antes de sair da rede
- Testar restores regularmente
- Credenciais de backup SEPARADAS das credenciais do servidor

---

## 7. Areas Cinzas e Edge Cases

### Analisar padroes de comunicacao de terceiros

| Acao | Avaliacao |
|------|-----------|
| Analisar email para rascunhar resposta | Geralmente OK |
| Resumir thread para entendimento pessoal | OK (rotear localmente se contiver dados sensiveis) |
| Construir perfil de padroes de comunicacao ao longo do tempo | ETICAMENTE QUESTIONAVEL |
| Usar analise para vantagem em negociacao | COMECA A PARECER VIGILANCIA |
| Compartilhar analise AI dos padroes de alguem | POTENCIALMENTE DIFAMATORIO |

### Fine-tuning com palavras de terceiros

- **NAO FAZER**. Se dados estao em pesos, direito de apagamento e quase impossivel
- Modelo pode **memorizar e regenerar** citacoes verbatim = vetor de vazamento
- **USAR RAG em vez de fine-tuning** para dados de terceiros (dados ficam no banco, deletaveis)
- Se fine-tuning essencial: usar somente SUA escrita + versoes anonimizadas/sinteticas

### Linha entre uso pessoal e vigilancia

Um sistema que continuamente grava conversas, analisa emails, constroi perfis comportamentais, e prediz comportamento de terceiros **funciona identicamente a um sistema de vigilancia**, mesmo que cada componente individual seja legal.

**Guia**:
- Processar dados de terceiros somente com proposito especifico e legitimo
- NAO construir perfis persistentes de comportamento de terceiros
- NAO rodar analise automatica em comunicacoes recebidas sem query especifica
- Tratar o sistema como ferramenta que voce consulta ativamente, NAO aparato de vigilancia passivo

### Se o servidor for comprometido

**Risco**: Agrega anos de emails, transcricoes, dados financeiros/medicos, pensamentos privados. Breach desse sistema e CATASTROFICAMENTE pior que breach tipico (efeito de agregacao).

**Consequencias legais**:
- Responsabilidade civil por dados de terceiros expostos
- GDPR: ate €20M ou 4% de receita global
- OPC (Canada) pode investigar
- Individuos podem processar por breach of confidence, negligence, invasion of privacy (*Jones v. Tsige*, 2012 ONCA 32)

**Mitigacao**:
- Criptografia em repouso
- Segmentacao: seus dados separados dos de terceiros
- Limites de retencao: auto-delete agendado
- Plano de resposta a breach
- Considerar seguro de cyber liability

---

## Recomendacoes por Tier

### Tier 1: Obrigatorio
1. SOMENTE tiers comerciais de API
2. Full disk encryption (LUKS + VeraCrypt)
3. Human-in-the-loop para acoes destrutivas
4. NUNCA fine-tunar com dados identificaveis de terceiros — usar RAG
5. Backups criptografados

### Tier 2: Fortemente Recomendado
6. Roteador de sensibilidade (classificar localmente antes de rotear)
7. NeMo Guardrails para PII detection
8. Segmentar dados: seus vs de terceiros, com retencao diferente
9. Isolamento de rede para servidor de inferencia
10. Limites de retencao e auto-delete

### Tier 3: Best Practice
11. ZDR com Anthropic/OpenAI
12. Context compaction + resumos sanitizados para coerencia entre modelos
13. PII detection em todo conteudo antes de chamada cloud
14. Documentar praticas de tratamento de dados
15. Considerar efeito de agregacao

---

## Proximos Passos (decisao do Cris)

1. Quais guardrails sao prioridade Tier 1 desde o dia 1?
2. Investir em ZDR com Anthropic (enterprise)?
3. Quao autonomo o Amazo deve ser? (somente classificar? ou tambem agir?)
4. Separacao fisica: servidor sensivel (local only) vs servidor conectado (API-enabled)?
