import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken } from "./lib/auth";

// Portão de entrada: sem o cookie certo, nada passa (páginas → /login, APIs → 401).
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && token === (await expectedToken())) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Tudo, exceto login, assets do Next e arquivos estáticos
  matcher: ["/((?!login|api/login|_next|favicon.ico|manifest.json|icon.*).*)"],
};
