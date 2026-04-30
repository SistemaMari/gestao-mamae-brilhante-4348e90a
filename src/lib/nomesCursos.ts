/**
 * Mapa de slugs de cursos para nomes amigáveis.
 * Usado na PlanosPage até que exista uma tabela `cursos` no banco.
 */
export const NOMES_CURSOS: Record<string, string> = {
  'hiperglicemia': 'Curso: Hiperglicemia na Gestação',
  'insulinoterapia': 'Curso: Insulinoterapia',
  'novos-paradigmas-dmg': 'Curso: Novos Paradigmas do DMG',
};

export function nomeAmigavelCurso(slug: string): string {
  return NOMES_CURSOS[slug] ?? slug;
}
