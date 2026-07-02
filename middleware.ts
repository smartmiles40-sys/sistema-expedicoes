import { NextResponse, type NextRequest } from "next/server";
import { SITE_AUTH_COOKIE, tokenAcesso } from "@/lib/site-auth";

// Rotas que NÃO passam pelo gate de senha (têm auth própria ou são internas):
// a própria tela de acesso, health-check, logout, webhooks do Bitrix e os crons.
const LIBERADAS = [
  "/acesso",
  "/inscricao", // formulário público de inscrição (clientes não têm a senha do site)
  "/api/health",
  "/api/logout",
  "/api/bitrix",
  "/api/cambios",
  "/api/expedicoes/atualizar-status",
];

export async function middleware(req: NextRequest) {
  const esperado = await tokenAcesso();
  // Sem SITE_PASSWORD → gate desligado (deixa tudo passar).
  if (!esperado) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/_next") || LIBERADAS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (req.cookies.get(SITE_AUTH_COOKIE)?.value === esperado) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/acesso";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
