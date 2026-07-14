import { sb } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await sb()
    .from("audit_log")
    .select("id, created_at, actor, action, detail, approved")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ events: data });
}
