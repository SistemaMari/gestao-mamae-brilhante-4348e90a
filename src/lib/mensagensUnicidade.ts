export const MENSAGENS_UNICIDADE: Record<string, string> = {
  email_em_uso_admin: "Este e-mail já está cadastrado como administrador.",
  email_em_uso_gestor_unidade:
    "Este e-mail já está cadastrado como gestor de outra unidade.",
  email_em_uso_profissional:
    "Este e-mail já está cadastrado como profissional.",
  email_em_uso_profissional_outra_unidade:
    "Este e-mail já está cadastrado como profissional de outra unidade.",
  email_em_uso_gestor_geral:
    "Este e-mail já está cadastrado como gestor geral.",
  email_em_uso_consultorio:
    "Esse profissional já tem conta de consultório. Por questão de auditoria, ele precisa aceitar o vínculo institucional via convite tradicional. Peça que o gestor da unidade envie pelo painel /gestao/equipe.",
  email_em_uso_outro: "Este e-mail já está em uso no sistema.",
  gestor_ainda_vinculado:
    "Este gestor ainda está vinculado a uma unidade. Antes de revogar o acesso, use a aba Unidades e troque o gestor desta unidade.",
  gestor_ja_vinculado:
    "Este gestor já está vinculado a uma unidade.",
  gestor_revogado:
    "Este gestor está com acesso revogado. Reative-o antes de vinculá-lo a uma unidade.",
};

export const PERFIL_CLINICO_LABEL: Record<string, string> = {
  medico: "Médico(a)",
  enfermeiro: "Enfermeiro(a)",
  tecnico_enfermagem: "Técnico(a) de Enfermagem",
  outro: "Outro",
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
