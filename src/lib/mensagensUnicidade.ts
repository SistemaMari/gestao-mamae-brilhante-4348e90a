export const MENSAGENS_UNICIDADE: Record<string, string> = {
  email_em_uso_admin: "Este e-mail já está cadastrado como administrador.",
  email_em_uso_gestor_unidade:
    "Este e-mail já está cadastrado como gestor de outra unidade.",
  email_em_uso_profissional:
    "Este e-mail já está cadastrado como profissional.",
  email_em_uso_gestor_geral:
    "Este e-mail já está cadastrado como gestor geral.",
  email_em_uso_outro: "Este e-mail já está em uso no sistema.",
};

export const FALLBACK_GENERICO =
  "Algo deu errado. Tente novamente ou contate o suporte.";

export async function extrairErroEdge(
  error: unknown,
): Promise<{ codigo?: string; mensagem?: string }> {
  let payload: any = null;
  try {
    payload = await (error as any)?.context?.json?.();
  } catch {
    /* ignore */
  }
  console.error("[gerenciar-institucional]", { error, payload });
  return { codigo: payload?.codigo, mensagem: payload?.mensagem };
}
