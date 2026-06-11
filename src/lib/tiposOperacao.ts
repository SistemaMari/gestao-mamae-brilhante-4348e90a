export type TipoOperacao =
  | "abrir_ficha"
  | "preencher_ficha_ac"
  | "preencher_ficha_bd"
  | "preencher_gtt"
  | "consulta_inicial"
  | "retorno"
  | "perfil_glicemico"
  | "gerar_laudo"
  | "registrar_parto"
  | "encerramento"
  | "editar_dados_paciente";

export const TIPOS_OPERACAO_LABELS: Record<TipoOperacao, string> = {
  abrir_ficha: "Abertura de ficha",
  preencher_ficha_ac: "Registro de perfil glicêmico de 4 pontos",
  preencher_ficha_bd: "Registro de perfil glicêmico de 6 pontos",
  preencher_gtt: "Resultado de GTT",
  consulta_inicial: "Consulta inicial",
  retorno: "Retorno clínico",
  perfil_glicemico: "Perfil glicêmico",
  gerar_laudo: "Geração de laudo",
  registrar_parto: "Registro de parto",
  encerramento: "Encerramento de caso",
  editar_dados_paciente: "Edição de dados",
};

export function labelTipoOperacao(tipo: string | null | undefined): string {
  if (!tipo) return "—";
  return TIPOS_OPERACAO_LABELS[tipo as TipoOperacao] ?? tipo;
}
