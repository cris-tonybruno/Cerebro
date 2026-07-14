import { createHash } from "crypto";
import { answerOnce } from "@/lib/brain";
import { transcribe } from "@/lib/stt";
import { synthesize } from "@/lib/tts";

// M2.5 — Corpo provisório: bot do Telegram ligado no mesmo cérebro.
// Segurança: (1) secret token do webhook no header, (2) só responde ao chat do Cris.

export const maxDuration = 300; // conselho leva 1-2 min (3 estágios)

const TG = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// Sessão determinística por chat: mesma conversa do Telegram = mesma sessão no cérebro
function sessionIdForChat(chatId: number): string {
  const h = createHash("sha256").update(`telegram:${chatId}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

async function tg(method: string, payload: Record<string, unknown>) {
  const res = await fetch(`${TG()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error(`telegram ${method}:`, res.status, await res.text());
  return res;
}

async function downloadVoice(fileId: string): Promise<Blob | null> {
  const meta = await fetch(`${TG()}/getFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!meta.ok) return null;
  const json = await meta.json();
  const path = json.result?.file_path;
  if (!path) return null;
  const file = await fetch(
    `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`
  );
  if (!file.ok) return null;
  return await file.blob();
}

export async function POST(req: Request) {
  // Portão 1: secret token que só o Telegram conhece
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const update = await req.json();
  const msg = update?.message;
  if (!msg?.chat?.id) return Response.json({ ok: true }); // ignora updates sem mensagem

  const chatId: number = msg.chat.id;

  // Portão 2: só o Cris. Sem TELEGRAM_CHAT_ID configurado, responde o id para configurar.
  const allowed = process.env.TELEGRAM_CHAT_ID;
  if (!allowed) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `Cérebro aqui. Seu chat_id é ${chatId} — adiciona TELEGRAM_CHAT_ID=${chatId} nas variáveis de ambiente e faz redeploy para me ativar.`,
    });
    return Response.json({ ok: true });
  }
  if (String(chatId) !== allowed) {
    return Response.json({ ok: true }); // estranhos falam com o vazio
  }

  // Extrai o texto: mensagem escrita ou nota de voz transcrita
  let text: string | null = msg.text ?? null;
  let modality: "text" | "voice" = "text";

  if (!text && msg.voice?.file_id) {
    modality = "voice";
    const blob = await downloadVoice(msg.voice.file_id);
    if (blob) {
      try {
        text = await transcribe(blob, "voice.oga");
      } catch (err) {
        console.error("telegram stt:", err);
      }
    }
    if (!text) {
      await tg("sendMessage", { chat_id: chatId, text: "Não consegui entender o áudio 🤔" });
      return Response.json({ ok: true });
    }
  }

  if (!text) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Por enquanto eu entendo texto e nota de voz. Foto e documento chegam no M7. 🧠",
    });
    return Response.json({ ok: true });
  }

  if (text === "/start") {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Cérebro online. 🧠 Manda texto ou nota de voz — eu escuto, lembro e respondo.",
    });
    return Response.json({ ok: true });
  }

  await tg("sendChatAction", { chat_id: chatId, action: "typing" });

  const answer = await answerOnce(text, sessionIdForChat(chatId), modality);
  await tg("sendMessage", { chat_id: chatId, text: answer });

  // Entrou por voz → responde em áudio também (mesma regra da PWA)
  if (modality === "voice") {
    const audio = await synthesize(answer);
    if (audio) {
      const form = new FormData();
      form.append("chat_id", String(chatId));
      form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "resposta.mp3");
      form.append("title", "Cérebro");
      const res = await fetch(`${TG()}/sendAudio`, { method: "POST", body: form });
      if (!res.ok) console.error("telegram sendAudio:", res.status, await res.text());
    }
  }

  return Response.json({ ok: true });
}
