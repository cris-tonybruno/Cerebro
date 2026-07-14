import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken } from "./lib/auth";

// Portão de entrada (M8): 1) BLACKOUT tranca tudo; 2) cookie amarrado à época.
// Estado vem do Supabase via REST (roda no edge; single-user, custo ok).

async function fetchSystemState(): Promise<{ lockdown: boolean; auth_epoch: number }> {
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/system_state?id=eq.1&select=lockdown,auth_epoch`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE!,
          authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE}`,
        },
        cache: "no-store",
      }
    );
    const rows = await res.json();
    return rows?.[0] ?? { lockdown: false, auth_epoch: 1 };
  } catch {
    // banco fora do ar: prefere trancar a abrir
    return { lockdown: true, auth_epoch: 0 };
  }
}

export async function proxy(request: NextRequest) {
  const state = await fetchSystemState();

  // BLACKOUT: nada passa, exceto o próprio kill switch
  if (state.lockdown) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "blackout ativo" }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/kill", request.url));
  }

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken(state.auth_epoch))) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Fora do portão: login, kill switch (o ponto é funcionar de QUALQUER browser),
  // webhook do Telegram (secret próprio), cron (secret próprio), assets
  matcher: [
    "/((?!login|kill|api/login|api/kill|api/telegram|api/cron|_next|favicon.ico|manifest.json|icon.*).*)",
  ],
};
