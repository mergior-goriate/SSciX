import type { NextRequest } from "next/server";

const MAX_BODY = 16384;

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (path.some((segment) => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === "." || segment === "..")) {
    return new Response(null, { status: 404 });
  }
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  const url = new URL("/api/v1/" + path.join("/"), base);
  url.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ["cookie", "origin", "content-type"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.body) {
    const reader = request.body.getReader();
    const route = path.join("/");
    const communityPhoto = (request.method === "POST" && route === "communities")
      || (request.method === "PUT" && /^communities\/[a-f0-9-]{36}\/photo$/i.test(route));
    const limit = communityPhoto || (request.method === "PUT" && route === "profiles/me") ? 425000
      : (request.method === "POST" && route === "feed") ||
        (request.method === "PUT" && route === "profiles/me/cover") ? 750000 : MAX_BODY;
    const bytes = new Uint8Array(limit);
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (size + chunk.value.length > limit) {
        await reader.cancel();
        return Response.json({ detail: "O pedido é demasiado grande." }, { status: 413 });
      }
      bytes.set(chunk.value, size);
      size += chunk.value.length;
    }
    if (size > 0) {
      if (!headers.get("content-type")?.match(/^application\/json(?:\s*;|$)/i)) {
        return Response.json({ detail: "Envie os dados em JSON." }, { status: 415 });
      }
      body = bytes.subarray(0, size);
    }
  }

  try {
    const upstream = await fetch(url, { method: request.method, headers, body, cache: "no-store", redirect: "manual" });
    const result = new Headers();
    for (const name of ["content-type", "cache-control", "retry-after", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value) result.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) result.append("set-cookie", cookie);
    return new Response(upstream.body, { status: upstream.status, headers: result });
  } catch {
    return Response.json({ detail: "Serviço indisponível. Tente novamente." }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE };
