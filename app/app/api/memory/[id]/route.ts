import { sb } from "@/lib/supabase";
import { embed } from "@/lib/embeddings";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.content === "string") {
    update.content = body.content;
    const [embedding] = await embed([body.content], "memory_write");
    update.embedding = embedding;
  }
  if (typeof body.zone === "string") update.zone = body.zone;
  if (typeof body.kind === "string") update.kind = body.kind;
  if (typeof body.archived === "boolean") update.archived = body.archived;

  const { data, error } = await sb()
    .from("memories")
    .update(update)
    .eq("id", id)
    .select("id, created_at, updated_at, kind, content, zone, confidence, archived")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ memory: data });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { error } = await sb().from("memories").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
