import { headers } from "next/headers";

export async function fetchMemberApi(path: string) {
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
  return fetch(new URL(path, base), {
    headers: { cookie: (await headers()).get("cookie") ?? "" },
    cache: "no-store",
  });
}
