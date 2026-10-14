// Papel ("role") de um JWT do Supabase, lido do payload SEM conferir assinatura.
// Só é seguro em função com verify_jwt = true no supabase/config.toml: aí o
// gateway já recusou qualquer token com assinatura inválida antes de chegar aqui.
// Mesmo padrão do process-email-queue. Usado pelos jobs do pg_cron, que mandam a
// chave de serviço guardada no cofre (não é o mesmo texto de
// SUPABASE_SERVICE_ROLE_KEY, então comparar o texto falhava).
export function papelDoToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    const claims = JSON.parse(atob(payload)) as Record<string, unknown>;
    return typeof claims.role === "string" ? claims.role : null;
  } catch {
    return null;
  }
}
