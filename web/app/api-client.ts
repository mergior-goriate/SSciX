export async function api<T>(path: string, method = "GET", data?: object): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method,
    cache: "no-store",
    ...(data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const labels: Record<string, string> = {
      name: "nome", slug: "endereço público", email: "email", password: "palavra-passe",
      accept_terms: "termos", orcid: "ORCID", token: "link de acesso",
    };
    const fields: string[] = Array.isArray(body.fields) ? body.fields : [];
    const fieldList = fields.map((field) => labels[field] ?? field).join(", ");
    throw Object.assign(new Error(
      (body.detail ?? "Não foi possível concluir o pedido.") + (fieldList ? " Campos: " + fieldList + "." : "")
    ), { status: response.status });
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function message(error: unknown) {
  return error instanceof Error ? error.message : "Ocorreu um erro inesperado.";
}
