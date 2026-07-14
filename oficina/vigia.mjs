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
import { readFileSync, existsSync } from "node:fs";
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

  await setStatus(job.id, { status: "building" });
  await telegram(`🔨 Vigia: iniciando chamado "${job.request}" (${short}) em ${workdir}`);
  await audit("vigia:building", { id: job.id, request: job.request, workdir });

  // branch novo a partir do estado atual — NUNCA main
  const branch = `chamado/${short}`;
  const baseBranch = git(workdir, ["rev-parse", "--abbrev-ref", "HEAD"]);
  git(workdir, ["checkout", "-B", branch]);

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

  const commits = git(workdir, ["log", `${baseBranch}..${branch}`, "--oneline"]);
  const summary = output.trim().slice(-1500);

  if (ok && commits) {
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
      `✅ Chamado "${job.request}" construído no branch ${branch}.\n\nCommits:\n${commits}\n\n${summary.slice(-600)}\n\n⚠️ Nada foi para produção — revisar e aprovar o merge.`
    );
    console.log(`✅ built: ${branch}\n${commits}`);
  } else {
    git(workdir, ["checkout", baseBranch]);
    await setStatus(job.id, {
      status: "failed",
      branch,
      resolved_at: new Date().toISOString(),
      resolution: summary || "sem mudanças produzidas",
    });
    await audit("vigia:failed", { id: job.id, branch });
    await telegram(
      `❌ Chamado "${job.request}" falhou ou não produziu mudanças.\n\n${summary.slice(-600)}`
    );
    console.log(`❌ failed/sem commits`);
  }
}

// ── loop ─────────────────────────────────────────────────────
const once = process.argv.includes("--once");
console.log(`👁️  Vigia de plantão (poll ${POLL_MS / 1000}s${once ? ", ciclo único" : ""})...`);

do {
  try {
    const jobs = await rest("dev_backlog?status=eq.dispatched&order=created_at&limit=1");
    if (jobs.length > 0) await runJob(jobs[0]);
    else if (once) console.log("nada despachado.");
  } catch (err) {
    console.error("vigia:", err.message);
  }
  if (!once) await new Promise((r) => setTimeout(r, POLL_MS));
} while (!once);
