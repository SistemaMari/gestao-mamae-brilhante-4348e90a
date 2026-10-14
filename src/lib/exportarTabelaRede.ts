// Exportação (Excel / CSV) das tabelas do painel do gestor geral (rede).
// Mesmo visual da planilha de fichas da unidade (src/lib/exportarFichasExcel.ts):
// cabeçalho roxo, bordas finas, filtro automático. As funções puras (matriz,
// CSV, IG) ficam separadas do download para serem testadas.

export type ValorCelula = string | number | null | undefined;

export interface ColunaExport<T> {
  header: string;
  valor: (linha: T) => ValorCelula;
  /** Largura da coluna no Excel (caracteres). */
  width?: number;
}

export interface TabelaExport<T> {
  /** Título no topo da planilha (ex.: "Visão geral da rede"). */
  titulo: string;
  /** Pares [rótulo, valor] logo abaixo do título (período, unidades, gerado em). */
  meta: [string, string][];
  colunas: ColunaExport<T>[];
  linhas: T[];
  /** Nome da aba (Excel limita a 31 caracteres). */
  aba: string;
  /** Nome do arquivo sem extensão. */
  fileBase: string;
}

const ROXO = 'FF7C4DBA';
const ROXO_ESCURO = 'FF5B3A8C';
const CINZA_BORDA = 'FFD1D5DB';

/** Cabeçalho + linhas, com vazio no lugar de null/undefined/NaN. */
export function montarMatriz<T>(colunas: ColunaExport<T>[], linhas: T[]): (string | number)[][] {
  const limpar = (v: ValorCelula): string | number => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number' && Number.isNaN(v)) return '';
    return v;
  };
  return [colunas.map((c) => c.header), ...linhas.map((l) => colunas.map((c) => limpar(c.valor(l))))];
}

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV com ";" (o Excel em português abre direto em colunas) e BOM UTF-8
 * (acentos certos). Linhas de metadados antes da tabela, separadas por uma
 * linha em branco.
 */
export function matrizParaCsv(matriz: (string | number)[][], meta: [string, string][] = []): string {
  const linhas = [
    ...meta.map(([k, v]) => [k, v].map(csvEscape).join(';')),
    ...(meta.length ? [''] : []),
    ...matriz.map((r) => r.map(csvEscape).join(';')),
  ];
  return '﻿' + linhas.join('\r\n');
}

/** Dias de gestação → "30 sem 2d" (mesmo formato da IG nos painéis). */
export function igDiasParaTexto(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || Number.isNaN(dias) || dias < 0) return '—';
  return `${Math.floor(dias / 7)} sem ${dias % 7}d`;
}

/** Nome de arquivo seguro: sem acento, sem espaço, sem caractere especial. */
export function slugArquivo(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarTabelaCsv<T>(t: TabelaExport<T>): void {
  const csv = matrizParaCsv(montarMatriz(t.colunas, t.linhas), [[t.titulo, ''], ...t.meta]);
  baixar(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${t.fileBase}.csv`);
}

export async function exportarTabelaExcel<T>(t: TabelaExport<T>): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MARI';
  wb.created = new Date();

  const ws = wb.addWorksheet(t.aba.slice(0, 31), { views: [{ showGridLines: false }] });
  const n = t.colunas.length;
  ws.columns = t.colunas.map((c) => ({ width: c.width ?? Math.max(14, c.header.length + 4) }));
  const b = { style: 'thin' as const, color: { argb: CINZA_BORDA } };
  const borda = { top: b, bottom: b, left: b, right: b };

  // Título
  ws.mergeCells(1, 1, 1, Math.max(n, 2));
  const tit = ws.getCell(1, 1);
  tit.value = t.titulo;
  tit.font = { name: 'Calibri', size: 16, bold: true, color: { argb: ROXO_ESCURO } };
  ws.getRow(1).height = 24;

  // Metadados (período, unidades, gerado em)
  t.meta.forEach(([k, v], i) => {
    const r = ws.getRow(i + 3);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = v;
  });

  // Tabela
  const [cab, ...corpo] = montarMatriz(t.colunas, t.linhas);
  const linhaCab = t.meta.length + 4;
  const rc = ws.getRow(linhaCab);
  rc.height = 22;
  cab.forEach((h, i) => {
    const cell = rc.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borda;
  });
  corpo.forEach((linha, j) => {
    const r = ws.getRow(linhaCab + 1 + j);
    linha.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      cell.border = borda;
      cell.alignment = { vertical: 'middle', horizontal: typeof v === 'number' ? 'right' : 'left' };
    });
  });
  if (n > 0) ws.autoFilter = { from: { row: linhaCab, column: 1 }, to: { row: linhaCab, column: n } };
  ws.views = [{ state: 'frozen', ySplit: linhaCab, showGridLines: false }];

  const buffer = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${t.fileBase}.xlsx`,
  );
}
