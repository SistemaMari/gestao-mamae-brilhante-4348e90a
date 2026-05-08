import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { STATUS_CONFIG, calcIdadeGestacional } from '@/lib/fichaUtils';

export interface FichaExcel {
  id: string;
  nome: string;
  status_ficha: string;
  profissional_nome: string;
  data_ultima_consulta: string | null;
  data_proximo_retorno: string | null;
  dum: string | null;
  usg_data: string | null;
  usg_ig_semanas: number | null;
  usg_ig_dias: number | null;
}

interface Params {
  fichas: FichaExcel[];
  unidadeNome: string;
  gestorNome: string;
  statusFiltro: string | null;
  busca: string;
  fileBase: string;
}

const ROXO = 'FF7C4DBA';
const ROXO_ESCURO = 'FF5B3A8C';
const CINZA_BORDA = 'FFD1D5DB';
const CINZA_TEXTO = 'FF475569';

const STATUS_ORDEM = [
  'aguardando_gj',
  'aguardando_gtt',
  'dmg_confirmado',
  'dmg_afastado',
  'resultado_parto',
  'encaminhada_endocrino',
];

const fmtBR = (v: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');

function thinBorder() {
  const b = { style: 'thin' as const, color: { argb: CINZA_BORDA } };
  return { top: b, bottom: b, left: b, right: b };
}

export async function exportarFichasExcel({
  fichas,
  unidadeNome,
  gestorNome,
  statusFiltro,
  busca,
  fileBase,
}: Params) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MARI';
  wb.created = new Date();

  // ============ ABA 1: RESUMO ============
  const resumo = wb.addWorksheet('Resumo', { views: [{ showGridLines: false }] });
  resumo.columns = [
    { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
  ];

  // L1 título
  resumo.mergeCells('A1:F1');
  const c1 = resumo.getCell('A1');
  c1.value = 'FICHAS DA UNIDADE';
  c1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: ROXO_ESCURO } };
  c1.alignment = { vertical: 'middle', horizontal: 'left' };
  resumo.getRow(1).height = 24;

  // L2 subtítulo
  resumo.mergeCells('A2:F2');
  const c2 = resumo.getCell('A2');
  c2.value = 'Relatório operacional gerado pelo painel da MARI';
  c2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: CINZA_TEXTO } };

  // L4-L7 metadados
  const filtroDesc = statusFiltro
    ? `Status: ${STATUS_CONFIG[statusFiltro]?.label || statusFiltro}`
    : 'Nenhum (todas as fichas)';
  const filtroComBusca = busca.trim() ? `${filtroDesc} · Busca: ${busca.trim()}` : filtroDesc;

  const meta: [string, string][] = [
    ['Unidade:', unidadeNome || '—'],
    ['Gestor:', gestorNome || '—'],
    ['Gerado em:', format(new Date(), 'dd/MM/yyyy HH:mm')],
    ['Filtro aplicado:', filtroComBusca],
  ];
  meta.forEach(([label, valor], i) => {
    const row = i + 4;
    const a = resumo.getCell(`A${row}`);
    a.value = label;
    a.font = { bold: true };
    resumo.getCell(`B${row}`).value = valor;
  });

  // L9 INDICADORES
  resumo.mergeCells('A9:F9');
  const c9 = resumo.getCell('A9');
  c9.value = 'INDICADORES OPERACIONAIS';
  c9.font = { size: 12, bold: true, color: { argb: ROXO } };

  // L10-L11 KPIs
  const cont: Record<string, number> = {};
  for (const f of fichas) cont[f.status_ficha] = (cont[f.status_ficha] || 0) + 1;
  const total = fichas.length;
  const aguardandoGj = cont['aguardando_gj'] || 0;
  const acomp = (cont['aguardando_gtt'] || 0) + (cont['dmg_confirmado'] || 0) + (cont['encaminhada_endocrino'] || 0);
  const concluidas = (cont['dmg_afastado'] || 0) + (cont['resultado_parto'] || 0);

  const kpiHeaders = ['Total', 'Aguardando GJ', 'Em acompanhamento', 'Concluídas'];
  const kpiValues = [total, aguardandoGj, acomp, concluidas];
  kpiHeaders.forEach((h, i) => {
    const cell = resumo.getRow(10).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  kpiValues.forEach((v, i) => {
    const cell = resumo.getRow(11).getCell(i + 1);
    cell.value = v;
    cell.font = { size: 14, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });
  resumo.getRow(10).height = 20;
  resumo.getRow(11).height = 24;

  // L13 DISTRIBUIÇÃO POR STATUS
  resumo.mergeCells('A13:F13');
  const c13 = resumo.getCell('A13');
  c13.value = 'DISTRIBUIÇÃO POR STATUS';
  c13.font = { size: 12, bold: true, color: { argb: ROXO } };

  // L14 header
  ['Status', 'Quantidade', '% do total'].forEach((h, i) => {
    const cell = resumo.getRow(14).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = thinBorder();
  });

  // L15+ rows fixos
  let rowIdx = 15;
  STATUS_ORDEM.forEach(key => {
    const qtd = cont[key] || 0;
    const pct = total > 0 ? (qtd / total) * 100 : 0;
    const r = resumo.getRow(rowIdx);
    r.getCell(1).value = STATUS_CONFIG[key]?.label || key;
    r.getCell(2).value = qtd;
    r.getCell(3).value = `${pct.toFixed(1)}%`;
    [1, 2, 3].forEach(c => {
      r.getCell(c).border = thinBorder();
      r.getCell(c).alignment = { vertical: 'middle' };
    });
    rowIdx++;
  });

  rowIdx++; // linha em branco

  // DISTRIBUIÇÃO POR PROFISSIONAL
  resumo.mergeCells(`A${rowIdx}:F${rowIdx}`);
  const cTitProf = resumo.getCell(`A${rowIdx}`);
  cTitProf.value = 'DISTRIBUIÇÃO POR PROFISSIONAL';
  cTitProf.font = { size: 12, bold: true, color: { argb: ROXO } };
  rowIdx++;

  ['Profissional', 'Quantidade'].forEach((h, i) => {
    const cell = resumo.getRow(rowIdx).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = thinBorder();
  });
  rowIdx++;

  const profCont: Record<string, number> = {};
  for (const f of fichas) profCont[f.profissional_nome] = (profCont[f.profissional_nome] || 0) + 1;
  const profsOrdenados = Object.entries(profCont).sort((a, b) => b[1] - a[1]);
  profsOrdenados.forEach(([nome, qtd]) => {
    const r = resumo.getRow(rowIdx);
    r.getCell(1).value = nome;
    r.getCell(2).value = qtd;
    [1, 2].forEach(c => {
      r.getCell(c).border = thinBorder();
      r.getCell(c).alignment = { vertical: 'middle' };
    });
    rowIdx++;
  });

  // ============ ABA 2: FICHAS ============
  const aba = wb.addWorksheet('Fichas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  aba.columns = [
    { header: 'Paciente', key: 'paciente', width: 28 },
    { header: 'IG', key: 'ig', width: 14 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'Profissional', key: 'profissional', width: 24 },
    { header: 'Última consulta', key: 'ultima', width: 18 },
    { header: 'Próxima consulta', key: 'proxima', width: 18 },
  ];

  const headerRow = aba.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROXO } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder();
  });

  fichas.forEach(f => {
    const row = aba.addRow({
      paciente: f.nome,
      ig: calcIdadeGestacional(f),
      status: STATUS_CONFIG[f.status_ficha]?.label || f.status_ficha,
      profissional: f.profissional_nome,
      ultima: fmtBR(f.data_ultima_consulta),
      proxima: fmtBR(f.data_proximo_retorno),
    });
    row.eachCell(cell => {
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = thinBorder();
    });
  });

  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };

  // ============ DOWNLOAD ============
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileBase}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
