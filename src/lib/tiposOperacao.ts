export type TipoOperacao =
  | "abrir_ficha"
  | "preencher_ficha_ac"
  | "preencher_ficha_bd"
  | "preencher_ficha_e"      // 40B — grafia idêntica ao CHECK do 40A
  | "preencher_gtt"
  | "inserir_usg"            // 40B
  | "trocar_referencia_ig"   // 40B
  | "reabrir_consulta"       // 40B
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
  preencher_ficha_e: "Registro de perfil glicêmico de 6 pontos (sem insulina)",
  preencher_gtt: "Resultado de GTT 75g",
  inserir_usg: "Inserção de ultrassonografia",
  trocar_referencia_ig: "Troca de referência de IG",
  reabrir_consulta: "Reabertura de consulta",
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
