import { NextResponse, type NextRequest } from "next/server";

const headers = { "Cache-Control": "private, no-store" };

function signIn(request: NextRequest) {
  return NextResponse.redirect(new URL("/entrar", request.url), { headers });
}

export async function proxy(request: NextRequest) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return signIn(request);

  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  try {
    const response = await fetch(new URL("/api/v1/session", base), {
      headers: { cookie }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (response.status === 204) {
      const page = NextResponse.next();
      page.headers.set("Cache-Control", headers["Cache-Control"]);
      return page;
    }
    if (response.status === 401) return signIn(request);
  } catch {
    // Leave the network inaccessible while the session service is unavailable.
  }
  return new NextResponse("Não foi possível verificar a sessão. Tente novamente.", {
    status: 503, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: [
    "/rede/:path*", "/pessoas/:path*", "/u/:path*", "/comunidades/:path*",
    "/mensagens/:path*", "/notificacoes/:path*", "/perfil/:path*", "/guardados/:path*",
    "/definicoes/:path*", "/onboarding/:path*",
  ],
};
