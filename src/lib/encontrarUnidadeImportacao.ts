/**
 * Importação em massa (gestores e profissionais): encontra a unidade da linha
 * pela REDE + nome. Antes casava só pelo nome, entre todas as redes, e usava a
 * primeira que achasse: duas redes com uma "Unidade Centro" podiam se misturar.
 *
 * - Com a coluna "rede" preenchida: procura só dentro dela.
 * - Sem a coluna: aceita só se o nome for único no sistema; se houver mais de
 *   uma unidade com esse nome, pede a rede (erro 'ambigua').
 */
export interface UnidadeImportacao {
  id: string;
  nome: string;
  contratante_nome?: string | null;
}

export type ResultadoUnidade =
  | { id: string; erro?: undefined }
  | { id?: undefined; erro: 'naoEncontrada' | 'ambigua' | 'redeNaoEncontrada' };

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export function encontrarUnidadeImportacao(
  unidades: UnidadeImportacao[],
  nomeUnidade: string,
  nomeRede?: string | null,
): ResultadoUnidade {
  const rede = norm(nomeRede);
  let base = unidades;
  if (rede) {
    base = unidades.filter((u) => norm(u.contratante_nome) === rede);
    if (base.length === 0) return { erro: 'redeNaoEncontrada' };
  }
  const achadas = base.filter((u) => norm(u.nome) === norm(nomeUnidade));
  if (achadas.length === 0) return { erro: 'naoEncontrada' };
  if (achadas.length > 1) return { erro: 'ambigua' };
  return { id: achadas[0].id };
}
