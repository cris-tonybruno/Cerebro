/**
 * CÉREBRO — Job de Custódia de Éon (F4.3-4.4 da DIRETIVA de Éon)
 *
 * Atravessa a Ponte seguindo o PROTOCOLO-PONTE.md do repo de Éon:
 *   ENTRADA (§5): Constituição → relatório → histórico (últimas 10 +
 *     precedentes das mesmas variáveis) → leis
 *   SEMÁFORO (§4): 🟢 arquiva · 🟡 observa · 🟠 delibera · 🔴 notifica
 *     Cris · ⚫ silêncio ≥2 = laranja técnico, ≥7 dias = vermelho
 *   SAÍDA (§6): grava em custodia_log (append-only)
 *
 * FASE DE TESTE (Constituição §10): ações SIMULADAS. Vozes heurísticas
 * até o milestone do conselho LLM do Cérebro.
 *
 * Identidade: usuário de máquina cerebro@eon.internal (GoTrue) — as
 * policies do banco só deixam essa identidade ler/escrever custódia;
 * o canon e os eventos do mundo são fisicamente inalcançáveis.
 *
 * Usage: node ponte-eon.js [--simular verde|amarelo|laranja|vermelho]
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const URL_ = process.env.EON_URL;
const ANON = process.env.EON_ANON_KEY;
const EON_REPO = process.env.EON_REPO;
const CONSTITUICAO_VERSAO = '0.1.1';

function log(m) { console.log(`[ponte-eon] ${m}`); }

async function api(pathname, opts = {}, token = null, profile = null) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${token || ANON}`,
    'Content-Type': 'application/json',
    ...(profile ? { [opts.method === 'POST' ? 'Content-Profile' : 'Accept-Profile']: profile } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${URL_}${pathname}`, { ...opts, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname}: ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

function lerGoverno() {
  for (const d of ['CONSTITUICAO.md', 'PROTOCOLO-PONTE.md', 'lore/regras/alertas.json']) {
    if (!fs.existsSync(path.join(EON_REPO, d))) throw new Error(`Ritual de entrada violado: ${d} ausente`);
  }
  log('Ritual de entrada: Constituição + Protocolo + leis carregados');
}

function gerarVozes(cor, alertas) {
  const vars = alertas.map(a => a.variavel).join(', ') || 'nenhuma';
  return {
    C: `Curvatura (longo prazo): [${vars}] contra a tendência. ${cor === 'laranja' ? 'Ciclos se corrigem sozinhos mais vezes do que intervimos bem.' : 'Sem urgência temporal.'}`,
    D: `Densidade (estrutura): ${alertas.some(a => a.variavel === 'ledger_violado') ? 'FÍSICA QUEBRADA — bug, não evento. Escalar.' : 'Ledger fechado, estrutura íntegra.'}`,
    F: `Frequência (informação): ${alertas.some(a => a.variavel === 'silencio') ? 'SILÊNCIO — o próprio canal é o alerta.' : 'Canal saudável, hash íntegro.'}`,
    E: `Entropia (defesa do caos): ${cor === 'laranja' ? 'Ainda pode ser a natureza das coisas. Voto: não agir salvo invariante ameaçado.' : 'Caos presente = caos esperado.'}`,
    R: `Ressonância (vínculos): ${alertas.some(a => ['nascimentos_zero', 'mulvhar_global'].includes(a.variavel)) ? 'Vida em risco — favorece ação mínima via clima.' : 'Tecido social sem ruptura.'}`,
  };
}

function decidir(cor, alertas) {
  if (cor === 'vermelho') return { decisao: 'escalar_vermelho', justificativa: 'Além da alçada do conselho (Constituição §7). Criador notificado.' };
  if (cor === 'laranja') {
    if (alertas.some(a => ['ledger_violado', 'silencio'].includes(a.variavel)))
      return { decisao: 'custodia_tecnica', justificativa: 'Falha técnica, não evento do mundo: diagnosticar/rerodar (Constituição §2.3).' };
    return { decisao: 'nao_agir', justificativa: 'Ainda é a natureza das coisas? Sim. Observar mais N ciclos antes de tocar o clima.' };
  }
  return { decisao: null, justificativa: null };
}

async function main() {
  const simular = process.argv.includes('--simular')
    ? process.argv[process.argv.indexOf('--simular') + 1] : null;

  lerGoverno();

  // Login da identidade de máquina
  const sess = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: process.env.EON_CEREBRO_EMAIL, password: process.env.EON_CEREBRO_PASSWORD }),
  });
  const jwt = sess.access_token;
  log(`Identidade: ${process.env.EON_CEREBRO_EMAIL} autenticada`);

  // §5.3: o relatório atual
  let tele;
  if (simular) {
    tele = { data: new Date().toISOString().split('T')[0], cor_global: simular, dias_desde_ciclo: 0, relatorio: { alertas: simular === 'verde' ? [] : [{ variavel: 'simulacao', cor: simular, valor: 1, lei: 'teste' }] } };
    log(`SIMULAÇÃO: telemetria injetada (${simular})`);
  } else {
    const rows = await api('/rest/v1/telemetria_atual?select=*', {}, jwt, 'velmora_ledger');
    tele = rows[0] || null;
  }

  // ⚫ CINZA: silêncio nunca é verde
  let cor = tele ? tele.cor_global : 'cinza';
  let alertas = tele ? (tele.relatorio.alertas || []) : [];
  if (tele && tele.dias_desde_ciclo >= 7) {
    cor = 'vermelho';
    alertas = [...alertas, { variavel: 'silencio', cor: 'vermelho', valor: tele.dias_desde_ciclo, lei: '>=7 dias sem ciclo (CINZA §4)' }];
    log(`⚫ CINZA→🔴: ${tele.dias_desde_ciclo} dias sem ciclo novo`);
  } else if (tele && tele.dias_desde_ciclo >= 2) {
    cor = 'laranja';
    alertas = [...alertas, { variavel: 'silencio', cor: 'laranja', valor: tele.dias_desde_ciclo, lei: '>=2 ciclos sem relatório (CINZA §4)' }];
    log(`⚫ CINZA→🟠 técnico: ${tele.dias_desde_ciclo} dias`);
  }

  // §5.4: histórico + precedentes das MESMAS variáveis
  const ult = await api('/rest/v1/custodia_log?select=id,tipo,cor,decisao&order=ts.desc&limit=10', {}, jwt, 'mundo_externo');
  const vars = alertas.map(a => a.variavel);
  const prec = vars.length > 0
    ? await api(`/rest/v1/custodia_log?select=id,cor,decisao,justificativa&variaveis=ov.{${vars.join(',')}}&order=ts.desc&limit=5`, {}, jwt, 'mundo_externo')
    : [];
  log(`Histórico: ${ult.length} recentes; ${prec.length} precedentes sobre [${vars.join(', ')}]`);
  for (const p of prec) log(`  precedente ${p.id}: ${p.cor} → ${p.decisao || 'registro'}`);

  // Semáforo §4 + decisão §6
  const tipo = { verde: 'arquivamento', amarelo: 'observacao', laranja: 'deliberacao', vermelho: 'deliberacao', cinza: 'deliberacao' }[cor] || 'observacao';
  const { decisao, justificativa } = decidir(cor, alertas);
  const vozes = tipo === 'deliberacao' ? gerarVozes(cor, alertas) : null;

  if (cor === 'vermelho') {
    log('🔴 NOTIFICAR CRIS (fase de teste: simulada; push real vem com o app do Cérebro)');
    fs.writeFileSync(path.join(__dirname, 'VERMELHO-PENDENTE.md'),
      `# 🔴 VERMELHO — ${new Date().toISOString()}\n\n${JSON.stringify(alertas, null, 2)}\n\nCris decide (Constituição §7/§9).\n`);
  }

  // Ritual de Saída §6
  const dia = new Date().toISOString().split('T')[0];
  const doDia = await api(`/rest/v1/custodia_log?select=id&id=like.delib-${dia}-*`, {}, jwt, 'mundo_externo');
  const id = `delib-${dia}-${String(doDia.length + 1).padStart(3, '0')}${simular ? '-sim' : ''}`;
  await api('/rest/v1/custodia_log', {
    method: 'POST',
    body: JSON.stringify({
      id, tipo, relatorio_ref: tele ? tele.data : null, cor,
      variaveis: vars, precedentes: prec.map(p => p.id),
      vozes, decisao, justificativa,
      acao: { canal: decisao === 'escalar_vermelho' ? 'notificacao_cris' : (decisao || 'nenhum'), ref: null, simulada: true },
      followup: cor === 'verde' ? null : `Observar [${vars.join(', ')}] nos próximos ciclos`,
      constituicao_versao: CONSTITUICAO_VERSAO,
    }),
  }, jwt, 'mundo_externo');
  log(`Ritual de saída: ${id} gravado (tipo=${tipo}, cor=${cor}, decisao=${decisao || 'n/a'}, precedentes=${prec.length})`);
}

main().catch(e => { console.error(`[ponte-eon] FATAL: ${e.message}`); process.exit(1); });
