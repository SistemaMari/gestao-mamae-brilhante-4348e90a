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
    "Este e-mail já tem conta de consultório particular (assinatura Asaas individual). Cada e-mail pertence a um único modelo no MARI. Peça à pessoa que use outro e-mail para vincular à sua unidade.",
  email_em_uso_outro: "Este e-mail já está em uso no sistema.",
  gestor_ainda_vinculado:
    "Este gestor ainda está vinculado a uma unidade. Antes de revogar o acesso, use a aba Unidades e troque o gestor desta unidade.",
  gestor_ja_vinculado:
    "Este gestor já está vinculado a uma unidade.",
  gestor_revogado:
    "Este gestor está com acesso revogado. Reative-o antes de vinculá-lo a uma unidade.",
  unidade_ja_tem_gestor:
    "Esta unidade já tem um gestor ativo. Troque pelo painel de Unidades antes de vincular outro.",
  gestor_nao_vinculado:
    "Este gestor não está vinculado a nenhuma unidade.",
  gestor_revogado_para_vincular:
    "Este gestor está com acesso revogado. Reative-o antes de vinculá-lo a uma unidade.",

  // [28.3a] Camada Contratante
  cnpj_duplicado: "Já existe um contratante cadastrado com este CNPJ.",
  cnpj_invalido: "CNPJ inválido. Informe os 14 dígitos.",
  contratante_inexistente: "Contratante não encontrado.",
  contratante_encerrado:
    "Este contratante está encerrado e não pode receber novas unidades, gestores ou edições.",
  contratante_destino_inativo:
    "O contratante destino está encerrado. Reative-o antes de transferir unidades para ele.",
  contratante_destino_igual_origem:
    "O contratante destino é o mesmo da unidade. Selecione um contratante diferente.",
  data_termino_invalida:
    "A data de término do contrato deve ser posterior à data de início.",
  data_inicio_obrigatoria: "Informe a data de início do contrato.",
  justificativa_curta:
    "A justificativa precisa ter pelo menos 20 caracteres.",
  nome_contratante_obrigatorio:
    "Informe o nome do contratante (até 200 caracteres).",
  contato_email_invalido: "E-mail de contato inválido.",

  // [28.3b]
  contratante_obrigatorio: "O contratante é obrigatório para criar uma unidade.",

  // [29.1] Profissionais consultório
  plano_inexistente: "Plano não encontrado.",
  plano_inativo: "Plano selecionado não está mais ativo.",
  plano_igual_atual: "O profissional já está neste plano.",
  motivo_curto_mudanca: "Motivo da mudança deve ter no mínimo 10 caracteres.",
  motivo_curto_revogacao: "Motivo da revogação deve ter no mínimo 20 caracteres.",
  ja_revogado: "Este profissional já está com acesso revogado.",
  email_ja_cadastrado: "Já existe um usuário cadastrado com este e-mail.",
  nao_revogado: "Este profissional não está com acesso revogado.",
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
