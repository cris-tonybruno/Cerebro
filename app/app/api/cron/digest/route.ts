import { buildWeeklyDigest } from "@/lib/digest";

// Cron semanal (segunda de manhã, vercel.json) — também aceita disparo manual autenticado.
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }
  const result = await buildWeeklyDigest();
  return Response.json({ ok: true, result });
}
