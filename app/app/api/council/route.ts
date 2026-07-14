import { sb } from "@/lib/supabase";

// Lista as sessões do conselho para a UI.
export async function GET() {
  const { data, error } = await sb()
    .from("council_sessions")
    .select("id, created_at, question, opinions, reviews, synthesis")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ sessions: data });
}
