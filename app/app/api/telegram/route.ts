import { createHash } from "crypto";
import { runTurn } from "@/lib/brain";
import { transcribe } from "@/lib/stt";
import { synthesize } from "@/lib/tts";
import { resolvePlace, updateCurrentLocation } from "@/lib/geo";
import { describeImage, extractDoc, storeFile } from "@/lib/media";

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

async function downloadFile(fileId: string): Promise<Blob | null> {
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

function datedPath(ext: string): string {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${Date.now()}.${ext}`;
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

  // Localização compartilhada → vira a posição atual do Cris (M5)
  if (msg.location?.latitude) {
    const geo = { lat: msg.location.latitude, lng: msg.location.longitude };
    const label = await resolvePlace(geo);
    await updateCurrentLocation(geo, "telegram", label);
    await tg("sendMessage", {
      chat_id: chatId,
      text: `📍 Posição atualizada${label ? `: ${label}` : ""}. Agora clima, rotas e contexto partem daqui.`,
    });
    return Response.json({ ok: true });
  }

  // Extrai o conteúdo: texto, nota de voz, foto ou documento
  let text: string | null = msg.text ?? null;
  let modality: "text" | "voice" | "image" | "doc" = "text";
  let attachmentPath: string | null = null;

  if (!text && msg.voice?.file_id) {
    modality = "voice";
    const blob = await downloadFile(msg.voice.file_id);
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

  // Foto → guarda no cofre + o cérebro VÊ a imagem (M7)
  if (!text && Array.isArray(msg.photo) && msg.photo.length > 0) {
    modality = "image";
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    const largest = msg.photo[msg.photo.length - 1]; // maior resolução
    const blob = await downloadFile(largest.file_id);
    if (!blob) {
      await tg("sendMessage", { chat_id: chatId, text: "Não consegui baixar a foto 🤔" });
      return Response.json({ ok: true });
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    attachmentPath = await storeFile("photos", datedPath("jpg"), bytes, "image/jpeg");
    const description = await describeImage(bytes, "image/jpeg");
    const caption = (msg.caption ?? "").trim();
    text =
      (caption ? `${caption}\n\n` : "") +
      `[FOTO enviada pelo Cris — o que você vê nela]: ${description}`;
  }

  // Documento (PDF/texto) → guarda + extrai o essencial (M7)
  if (!text && msg.document?.file_id) {
    modality = "doc";
    await tg("sendChatAction", { chat_id: chatId, action: "typing" });
    const doc = msg.document;
    const blob = await downloadFile(doc.file_id);
    if (!blob) {
      await tg("sendMessage", { chat_id: chatId, text: "Não consegui baixar o documento 🤔" });
      return Response.json({ ok: true });
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    const ext = (doc.file_name ?? "arquivo").split(".").pop() ?? "bin";
    attachmentPath = await storeFile(
      "docs",
      datedPath(ext),
      bytes,
      doc.mime_type ?? "application/octet-stream"
    );
    const extraction = await extractDoc(bytes, doc.mime_type ?? "", doc.file_name ?? "arquivo");
    const caption = (msg.caption ?? "").trim();
    text = (caption ? `${caption}\n\n` : "") + `[DOCUMENTO enviado pelo Cris]: ${extraction}`;
  }

  if (!text) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: "Eu entendo texto, nota de voz, foto e documento (PDF/texto). O que chegou aí eu ainda não sei ler. 🧠",
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

  // Sem GPS próprio: usa a última posição conhecida (getContext resolve isso)
  const { text: answer } = await runTurn(
    text,
    sessionIdForChat(chatId),
    modality,
    undefined,
    null,
    "telegram",
    attachmentPath
  );
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
