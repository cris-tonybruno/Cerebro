#!/usr/bin/env node
/**
 * O VIGIA — despachante da oficina (M8.5, diretiva §21).
 *
 * Mora no PC do Cris. A cada ciclo: busca chamados 'dispatched' no dev_backlog,
 * roda o Claude Code (headless) com a diretiva, SEMPRE em branch novo, empurra,
 * reporta no chamado e avisa o Cris no Telegram.
 *
 * Regras duras (§21.3): nunca main · só workdirs autorizados · um chamado por vez
 * · timeout por execução · tudo registrado.
 *
 * Rodar:  node oficina/vigia.mjs        (loop; Ctrl+C para parar)
 *         node oficina/vigia.mjs --once (um ciclo só)
 */

import { execFileSync, execSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POLL_MS = 60_000;
const CLAUDE_TIMEOUT_MS = 25 * 60_000; // 25 min por chamado
const WORKDIR_WHITELIST = ["c:\\dev\\", "c:/dev/"]; // só dentro de C:\Dev

// ── env (do app/.env.local) ──────────────────────────────────
const env = readFileSync(resolve(ROOT, "app/.env.local"), "utf8");
const grab = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
const SUPABASE_URL = grab("SUPABASE_URL");
const SERVICE = grab("SUPABASE_SERVICE_ROLE");
const TG_TOKEN = grab("TELEGRAM_BOT_TOKEN");
const TG_CHAT = grab("TELEGRAM_CHAT_ID");

const rest = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE,
      authorization: `Bearer ${SERVICE}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const telegram = async (text) => {
  if (!TG_TOKEN || !TG_CHAT) return;
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text }),
  }).catch(() => {});
};

const setStatus = (id, fields) =>
  rest(`dev_backlog?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(fields) });

const audit = (action, detail) =>
  rest("audit_log", {
    method: "POST",
    body: JSON.stringify({ actor: "system", action, detail, approved: true }),
  }).catch(() => {});

const git = (workdir, args) =>
  execFileSync("git", args, { cwd: workdir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

// ── executa UM chamado ───────────────────────────────────────
async function runJob(job) {
  const workdir = resolve(job.workdir || resolve(ROOT));
  const short = job.id.slice(0, 8);
  console.log(`\n🔨 chamado ${short}: ${job.request}`);

  // guardrails
  const wd = workdir.toLowerCase().replaceAll("\\", "/") + "/";
  if (!WORKDIR_WHITELIST.some((w) => wd.startsWith(w.replaceAll("\\", "/")))) {
    throw new Error(`workdir fora da whitelist: ${workdir}`);
  }
  if (!existsSync(workdir)) throw new Error(`workdir não existe: ${workdir}`);
  if (!job.directive?.trim()) throw new Error("chamado sem diretiva");

  const direto = job.pipeline === "direto"; // projeto novo, sem produção: sem etapa de aprovação
  await setStatus(job.id, { status: "building" });
  await telegram(
    `🔨 Vigia: iniciando chamado "${job.request}" (${short}) em ${workdir}${direto ? " [pipeline direto]" : ""}`
  );
  await audit("vigia:building", { id: job.id, request: job.request, workdir, pipeline: job.pipeline });

  const baseBranch = git(workdir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const startHead = git(workdir, ["rev-parse", "HEAD"]); // marco zero do chamado
  // protegido: trabalho em separado (aprovação antes de subir) · direto: na própria main
  const branch = direto ? baseBranch : `chamado/${short}`;
  if (!direto) git(workdir, ["checkout", "-B", branch]);

  const prompt = `Você é o executor da oficina do Cérebro (Vigia, diretiva §21). Execute a DIRETIVA
abaixo neste repositório. Regras: trabalhe SÓ neste diretório; commite suas mudanças com
mensagens claras (pode fazer vários commits); NÃO faça push; NÃO troque de branch; ao final,
escreva um resumo de 3-5 linhas do que foi feito e como testar.

DIRETIVA DO CHAMADO "${job.request}":
${job.directive}`;

  let output = "";
  let ok = true;
  try {
    // diretiva via STDIN (argumentos são só flags estáticas — nada a escapar)
    output = execFileSync("claude", ["-p", "--permission-mode", "acceptEdits"], {
      cwd: workdir,
      input: prompt,
      encoding: "utf8",
      timeout: CLAUDE_TIMEOUT_MS,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32", // claude.cmd no Windows
    });
  } catch (err) {
    ok = false;
    output = `${err.stdout ?? ""}\n[ERRO] ${err.message}`;
  }

  const commits = git(workdir, ["log", `${startHead}..HEAD`, "--oneline"]); // funciona com ou sem remoto
  const summary = output.trim().slice(-1500);

  if (ok && commits) {
    if (direto) {
      // projeto novo: sobe direto, sem etapa de aprovação (sem remoto = fica local, sem drama)
      let pushNote = "";
      try {
        git(workdir, ["push", "origin", baseBranch]);
      } catch {
        pushNote = " (sem remoto GitHub ainda — trabalho salvo localmente)";
      }
      await setStatus(job.id, {
        status: "merged",
        branch: baseBranch,
        resolved_at: new Date().toISOString(),
        resolution: `pipeline direto (${baseBranch})\ncommits:\n${commits}\n\n${summary}`,
      });
      await audit("vigia:merged", { id: job.id, pipeline: "direto", commits });
      await telegram(
        `🚀 Chamado "${job.request}" construído e JÁ NO PROJETO (pipeline direto)${pushNote}.\n\nCommits:\n${commits}\n\n${summary.slice(-600)}`
      );
      console.log(`🚀 direto: ${commits}`);
    } else {
      git(workdir, ["push", "-u", "origin", branch, "--force-with-lease"]);
      git(workdir, ["checkout", baseBranch]);
      await setStatus(job.id, {
        status: "built",
        branch,
        resolved_at: new Date().toISOString(),
        resolution: `branch ${branch}\ncommits:\n${commits}\n\n${summary}`,
      });
      await audit("vigia:built", { id: job.id, branch, commits });
      await telegram(
        `✅ Chamado "${job.request}" construído — aguardando sua decisão: "aprova" (sobe pra produção) ou "rejeita".\n\nO que foi feito:\n${commits}\n\n${summary.slice(-600)}`
      );
      console.log(`✅ built: ${branch}\n${commits}`);
    }
  } else {
    if (!direto) git(workdir, ["checkout", baseBranch]);
    await setStatus(job.id, {
      status: "failed",
      branch: direto ? null : branch,
      resolved_at: new Date().toISOString(),
      resolution: summary || "sem mudanças produzidas",
    });
    await audit("vigia:failed", { id: job.id });
    await telegram(
      `❌ Chamado "${job.request}" falhou ou não produziu mudanças.\n\n${summary.slice(-600)}`
    );
    console.log(`❌ failed/sem commits`);
  }
}

// ── nasce um projeto (bootstrap): pasta + git + GitHub ───────
async function bootstrapJob(job) {
  const spec = JSON.parse(job.directive); // {name, slug, owner, description, area}
  const workdir = resolve(job.workdir);
  const short = job.id.slice(0, 8);
  console.log(`\n🐣 bootstrap ${short}: ${spec.name} em ${workdir}`);

  const wd = workdir.toLowerCase().replaceAll("\\", "/") + "/";
  if (!WORKDIR_WHITELIST.some((w) => wd.startsWith(w.replaceAll("\\", "/")))) {
    throw new Error(`workdir fora da whitelist: ${workdir}`);
  }
  if (existsSync(workdir)) throw new Error(`pasta já existe: ${workdir}`);

  await setStatus(job.id, { status: "building" });
  await telegram(`🐣 Vigia: nascendo o projeto "${spec.name}" em ${workdir}...`);

  mkdirSync(workdir, { recursive: true });
  git(workdir, ["init", "-b", "main"]);
  writeFileSync(
    resolve(workdir, "README.md"),
    `# ${spec.name}\n\n${spec.description || "(descrição a definir)"}\n\n> Projeto nascido por voz via OLIVER em ${new Date().toISOString().slice(0, 10)}.\n`
  );
  writeFileSync(
    resolve(workdir, "CLAUDE.md"),
    `# ${spec.name}\n\n> Área: ${spec.area} · Endereço: ${workdir} · GitHub: ${spec.owner}/${spec.slug}\n> Nascido por voz via OLIVER (Cérebro). Chamados chegam pelo Vigia (dev_backlog),\n> pipeline DIRETO (projeto novo, sem produção).\n\n${spec.description || ""}\n`
  );
  git(workdir, ["add", "-A"]);
  git(workdir, ["commit", "-q", "-m", `Nasce ${spec.name} (bootstrap por voz via OLIVER)`]);

  // GitHub: usa o gh CLI com a conta certa, se disponível (credencial só no PC).
  // Alterna para a conta dona do projeto e DEVOLVE a conta ativa ao final.
  let repoNote = "";
  try {
    const accounts = execSync("gh auth status 2>&1", { encoding: "utf8" });
    const activeBefore = accounts.match(/account (\S+) \(keyring\)[\s\S]*?Active account: true/)?.[1] ?? null;
    if (accounts.includes(spec.owner)) {
      try { execSync(`gh auth switch --user ${spec.owner}`, { stdio: "ignore" }); } catch {}
      try {
        execSync(`gh repo create ${spec.owner}/${spec.slug} --private --source . --push`, {
          cwd: workdir,
          stdio: "ignore",
          timeout: 120_000,
        });
        repoNote = `GitHub: https://github.com/${spec.owner}/${spec.slug} (privado)`;
      } finally {
        if (activeBefore && activeBefore !== spec.owner) {
          try { execSync(`gh auth switch --user ${activeBefore}`, { stdio: "ignore" }); } catch {}
        }
      }
    } else {
      repoNote = `O projeto está seguro na oficina. Para eu também guardá-lo no GitHub ${spec.area === "pessoal" ? "pessoal" : "da empresa"}, preciso de uma autorização única do senhor no PC — a oficina sabe o passo.`;
    }
  } catch {
    repoNote = `O projeto está seguro na oficina; a cópia no GitHub fica pendente por ora.`;
  }

  await setStatus(job.id, {
    status: "merged",
    resolved_at: new Date().toISOString(),
    resolution: `nascido em ${workdir}. ${repoNote}`,
  });
  await audit("vigia:bootstrap", { id: job.id, name: spec.name, workdir, repo: repoNote });
  await telegram(`🐣✅ Projeto "${spec.name}" nasceu!\n📁 ${workdir}\n${repoNote}\n\nPode despachar chamados pra ele (pipeline direto).`);
  console.log(`🐣✅ ${spec.name}: ${repoNote}`);
}

// ── mescla UM chamado aprovado (git invisível para o Cris) ───
async function mergeJob(job) {
  const workdir = resolve(job.workdir || resolve(ROOT));
  const short = job.id.slice(0, 8);
  console.log(`\n🔀 merge do chamado ${short}: ${job.request} (${job.branch})`);
  if (!job.branch) throw new Error("chamado aprovado sem branch");

  await setStatus(job.id, { status: "merging" });
  try {
    const baseBranch = git(workdir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (git(workdir, ["status", "--porcelain"])) {
      throw new Error("árvore de trabalho suja — oficina em uso; merge adiado");
    }
    git(workdir, ["fetch", "origin"]);
    git(workdir, ["merge", "--no-ff", job.branch, "-m", `Merge chamado: ${job.request} (aprovado pelo Cris)`]);
    git(workdir, ["push", "origin", baseBranch]);
    git(workdir, ["push", "origin", "--delete", job.branch]);
    git(workdir, ["branch", "-D", job.branch]);
    await setStatus(job.id, { status: "merged", resolved_at: new Date().toISOString() });
    await audit("vigia:merged", { id: job.id, branch: job.branch });
    await telegram(`🚀 Chamado "${job.request}" mesclado e a caminho da produção (deploy automático).`);
    console.log("🚀 merged");
  } catch (err) {
    // conflito ou árvore suja: devolve para 'built', o Cris decide com a oficina
    try { git(workdir, ["merge", "--abort"]); } catch { /* sem merge em curso */ }
    await setStatus(job.id, { status: "built", resolution: `merge falhou: ${err.message}` });
    await telegram(`⚠️ Merge do chamado "${job.request}" falhou (${err.message}). Fica para a oficina resolver.`);
    console.error("merge falhou:", err.message);
  }
}

// ── loop ─────────────────────────────────────────────────────
const once = process.argv.includes("--once");
console.log(`👁️  Vigia de plantão (poll ${POLL_MS / 1000}s${once ? ", ciclo único" : ""})...`);

do {
  try {
    // prioridade 1: merges aprovados pelo Cris; prioridade 2: construções
    const approved = await rest("dev_backlog?status=eq.approved&order=created_at&limit=1");
    if (approved.length > 0) await mergeJob(approved[0]);
    else {
      const jobs = await rest("dev_backlog?status=eq.dispatched&order=created_at&limit=1");
      if (jobs.length > 0) {
        const job = jobs[0];
        try {
          if (job.job_type === "bootstrap") await bootstrapJob(job);
          else await runJob(job);
        } catch (err) {
          await setStatus(job.id, { status: "failed", resolution: err.message });
          await telegram(`❌ Chamado "${job.request}" falhou: ${err.message}`);
          console.error("job falhou:", err.message);
        }
      } else if (once) console.log("nada despachado.");
    }
  } catch (err) {
    console.error("vigia:", err.message);
  }
  if (!once) await new Promise((r) => setTimeout(r, POLL_MS));
} while (!once);
