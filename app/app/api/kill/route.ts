import { createHash } from "crypto";
import { sb } from "@/lib/supabase";
import { verifyTotp } from "@/lib/totp";
import { setLockdown, getSystemState, auditEvent } from "@/lib/security";

// M8 — Protocolo Blackout (diretiva §10): senha própria + TOTP, de qualquer browser.
// kill: tranca o app, mata cookies, marca devices como wiped, emudece o Telegram.
// restore: destranca, religa o webhook (cookies continuam mortos — relogin).

export const maxDuration = 60;

export async function GET() {
  const state = await getSystemState();
  return Response.json({ lockdown: state.lockdown });
}

export async function POST(req: Request) {
  const { password, totp, action } = await req.json();

  const hash = createHash("sha256")
    .update(`kill:${String(password ?? "")}`)
    .digest("hex");
  const passOk =
    !!process.env.KILL_SWITCH_PASSWORD_HASH && hash === process.env.KILL_SWITCH_PASSWORD_HASH;
  const totpOk =
    !!process.env.KILL_TOTP_SECRET && verifyTotp(process.env.KILL_TOTP_SECRET, String(totp ?? ""));

  if (!passOk || !totpOk) {
    await auditEvent("system", "blackout_attempt_failed", {
      pass_ok: passOk,
      totp_ok: totpOk,
      ip: req.headers.get("x-forwarded-for") ?? "?",
    });
    await new Promise((r) => setTimeout(r, 2000)); // desacelera força bruta
    return Response.json({ error: "credenciais inválidas" }, { status: 401 });
  }

  const origin = new URL(req.url).origin;

  if (action === "restore") {
    await setLockdown(false);
    // religa a boca do Telegram
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET) {
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${origin}/api/telegram`,
          secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
          allowed_updates: ["message"],
        }),
      }).catch(() => {});
    }
    await auditEvent("cris", "blackout_restored", {
      ip: req.headers.get("x-forwarded-for") ?? "?",
    });
    return Response.json({ ok: true, lockdown: false });
  }

  // ── KILL ──
  await setLockdown(true);
  await sb().from("devices").update({ status: "wiped" }).neq("status", "wiped");
  // emudece o Telegram (o webhook morre; o bot não ouve nem fala)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/deleteWebhook`,
      { method: "POST" }
    ).catch(() => {});
  }
  await auditEvent("cris", "blackout_activated", {
    ip: req.headers.get("x-forwarded-for") ?? "?",
  });
  return Response.json({ ok: true, lockdown: true });
}
