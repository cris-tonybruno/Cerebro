import { sb } from "./supabase";

// M8 — estado do sistema: lockdown global + época de autenticação.

export type SystemState = { lockdown: boolean; auth_epoch: number };

export async function getSystemState(): Promise<SystemState> {
  const { data } = await sb()
    .from("system_state")
    .select("lockdown, auth_epoch")
    .eq("id", 1)
    .maybeSingle();
  return (data as SystemState) ?? { lockdown: false, auth_epoch: 1 };
}

// kill/restore: muda o lockdown e SEMPRE bumpa a época (mata todos os cookies vivos)
export async function setLockdown(lockdown: boolean): Promise<SystemState> {
  const current = await getSystemState();
  const next = { lockdown, auth_epoch: current.auth_epoch + 1 };
  await sb()
    .from("system_state")
    .upsert({ id: 1, ...next, updated_at: new Date().toISOString() });
  return next;
}

export async function auditEvent(
  actor: string,
  action: string,
  detail: Record<string, unknown>,
  approved: boolean | null = null
) {
  const { error } = await sb().from("audit_log").insert({ actor, action, detail, approved });
  if (error) console.error("auditEvent:", error.message);
}
