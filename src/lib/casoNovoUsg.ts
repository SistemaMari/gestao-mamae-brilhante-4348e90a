/**
 * Caso Novo — entrada de MÚLTIPLAS USGs + escolha da referência de IG.
 *
 * Uma gestante transferida pode chegar já com várias USGs. O Caso Novo deixa
 * registrar todas de uma vez e escolher qual é a âncora de IG. A numeração
 * (1ª, 2ª, …) segue a DATA do exame — a 1ª USG é sempre a mais antiga
 * (decisão de produto). O `localId` é só para a UI (chave de lista + seleção
 * de referência) e para o caller mapear a USG escolhida ao id gerado no banco.
 */

export type CasoNovoUsgEntry = {
  localId: string;
  dataExame: string; // YYYY-MM-DD
  igSemanas: string; // string numérica (input controlado)
  igDias: string;    // string numérica
};

/** Referência de IG escolhida no Caso Novo. `null` = nenhuma (sem default). */
export type CasoNovoUsgRef =
  | { tipo: 'dum' }
  | { tipo: 'usg'; localId: string }
  | null;

export type CasoNovoUsgValue = {
  jaFezUsg: 'sim' | 'nao' | null;
  usgs: CasoNovoUsgEntry[];
  referencia: CasoNovoUsgRef;
};

export const emptyCasoNovoUsg: CasoNovoUsgValue = {
  jaFezUsg: null,
  usgs: [],
  referencia: null,
};

export type UsgParaSalvar = {
  localId: string;
  data_exame: string;
  ig_semanas: number;
  ig_dias: number;
  ordem: number;
};

/**
 * Ordena por data do exame (mais antiga primeiro) e atribui `ordem` 1..N —
 * a 1ª USG é sempre a mais antiga. Descarta entradas sem data ou sem semanas.
 * Preserva `localId` para o caller casar a USG escolhida como referência com
 * o id retornado pelo INSERT.
 */
export function prepararUsgsParaSalvar(usgs: CasoNovoUsgEntry[]): UsgParaSalvar[] {
  return [...usgs]
    .filter((u) => !!u.dataExame && u.igSemanas !== '')
    .sort((a, b) => a.dataExame.localeCompare(b.dataExame))
    .map((u, i) => ({
      localId: u.localId,
      data_exame: u.dataExame,
      ig_semanas: Number(u.igSemanas),
      ig_dias: Number(u.igDias || 0),
      ordem: i + 1,
    }));
}

/** USGs ordenadas por data (mais antiga primeiro); sem data vão para o fim. */
export function ordenarUsgsPorData(usgs: CasoNovoUsgEntry[]): CasoNovoUsgEntry[] {
  return [...usgs].sort((a, b) => {
    if (!a.dataExame) return 1;
    if (!b.dataExame) return -1;
    return a.dataExame.localeCompare(b.dataExame);
  });
}

const ORDINAIS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
/** Rótulo ordinal por posição 0-based: 0 → "1ª". */
export function ordinalUsg(posicaoZeroBased: number): string {
  return ORDINAIS[posicaoZeroBased] ?? `${posicaoZeroBased + 1}ª`;
}

/**
 * Há duas USGs com a mesma data? O banco tem UNIQUE(paciente_id, data_exame);
 * detectar no cliente dá mensagem amigável imediata.
 */
export function temDatasUsgDuplicadas(usgs: CasoNovoUsgEntry[]): boolean {
  const datas = usgs.map((u) => u.dataExame).filter(Boolean);
  return new Set(datas).size !== datas.length;
}
