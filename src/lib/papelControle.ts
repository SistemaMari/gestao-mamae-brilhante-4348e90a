/**
 * V4 — Papel de controle glicêmico que a gestante leva para casa.
 *
 * Impresso pela própria MARI, em branco, para o período que começa agora. É a
 * contrapartida da leitura por foto: quanto mais este papel circular, mais
 * confiável fica a leitura — mas a funcionalidade nunca depende dele, porque
 * o sistema também lê o caderninho da gestante e o papel do posto.
 *
 * Três decisões de desenho, todas com motivo:
 *
 *  • UM QUADRADINHO POR DÍGITO. No primeiro teste com foto real, o único erro de
 *    leitura foi confusão entre dígitos — um 8 lido como 7. Caixas separadas
 *    atacam exatamente isso: o número não gruda no vizinho.
 *
 *  • SEM AS METAS. Na tela do profissional, "abaixo de 95" ajuda a enxergar o
 *    que saiu da linha. No papel que fica na cozinha, o mesmo número vira
 *    angústia a cada medição — ou tentação de não anotar o valor ruim. Decisão
 *    clínica da equipe da MARI.
 *
 *  • MARCAS NOS CANTOS. Ninguém fotografa reto. Com três pontos pretos de
 *    posição conhecida, a imagem pode ser endireitada antes da leitura.
 *
 * As datas vêm impressas dia a dia: a gestante acha a linha de hoje em vez de
 * contar "dia 1, dia 2...", e o sistema sabe a que data pertence cada valor.
 */
import jsPDF from 'jspdf';
import { addDays, format } from 'date-fns';
import { parseDateLocal } from './dateUtils';

export interface TextosPapel {
  titulo: string;
  instrucao: string;
  rotuloGestante: string;
  rotuloPeriodo: string;
  colunaData: string;
  /** Rótulo de cada ponto, na ordem da grade. */
  colunas: string[];
  /** Segunda linha do cabeçalho de cada ponto (pode vir vazia). */
  subColunas: string[];
  rodape: string;
  nomeArquivo: string;
}

export interface DadosPapel {
  nomeGestante: string;
  /** Datas de cada linha, em 'dd/MM/yyyy'. */
  datas: string[];
}

const A4 = { largura: 210, altura: 297 };
const MARGEM = 12;
const MARCA = 6;

/**
 * Datas do período que a gestante vai monitorar a partir de agora.
 * Começa no dia seguinte à consulta — o papel é entregue para daqui pra frente.
 */
export function datasDoProximoPeriodo(dataConsulta: string, dias: number): string[] {
  const base = parseDateLocal(dataConsulta);
  if (!base || dias <= 0) return [];
  return Array.from({ length: dias }, (_, i) => format(addDays(base, i + 1), 'dd/MM/yyyy'));
}

export function gerarPapelControle(dados: DadosPapel, textos: TextosPapel): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const colunas = textos.colunas.length;

  // ── Marcas de canto (âncoras para endireitar a foto) ──────────────────────
  doc.setFillColor(20, 18, 28);
  doc.rect(MARGEM - 4, MARGEM - 4, MARCA, MARCA, 'F');
  doc.rect(A4.largura - MARGEM - MARCA + 4, MARGEM - 4, MARCA, MARCA, 'F');
  doc.rect(MARGEM - 4, A4.altura - MARGEM - MARCA + 4, MARCA, MARCA, 'F');

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  let y = MARGEM + 8;
  doc.setTextColor(20, 18, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(textos.titulo, MARGEM + 6, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(86, 80, 107);
  doc.text(textos.instrucao, MARGEM + 6, y);

  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(20, 18, 28);
  doc.setFont('helvetica', 'bold');
  doc.text(textos.rotuloGestante, MARGEM + 6, y);
  const larguraRotulo = doc.getTextWidth(textos.rotuloGestante) + 2;
  doc.setFont('helvetica', 'normal');
  doc.text(dados.nomeGestante, MARGEM + 6 + larguraRotulo, y);

  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text(textos.rotuloPeriodo, MARGEM + 6, y);
  const larguraPeriodo = doc.getTextWidth(textos.rotuloPeriodo) + 2;
  doc.setFont('helvetica', 'normal');
  const primeira = dados.datas[0] ?? '';
  const ultima = dados.datas[dados.datas.length - 1] ?? '';
  doc.text(`${primeira}  a  ${ultima}`, MARGEM + 6 + larguraPeriodo, y);

  // ── Geometria da tabela ───────────────────────────────────────────────────
  y += 8;
  const esquerda = MARGEM + 6;
  const direita = A4.largura - MARGEM - 6;
  const larguraTotal = direita - esquerda;
  const colData = 20;
  const larguraColuna = (larguraTotal - colData) / colunas;

  const alturaRodape = 18;
  const disponivel = A4.altura - MARGEM - alturaRodape - y - 12;
  const alturaLinha = Math.min(14, disponivel / Math.max(dados.datas.length, 1));

  // Caixas de dígito: três por célula, com folga entre elas.
  const ladoCaixa = Math.min(8, (larguraColuna - 6) / 3.4);
  const vaoCaixa = 1.4;
  const larguraCaixas = ladoCaixa * 3 + vaoCaixa * 2;
  const alturaCaixa = Math.min(ladoCaixa * 1.15, alturaLinha - 3);

  // ── Cabeçalho da tabela ───────────────────────────────────────────────────
  doc.setDrawColor(20, 18, 28);
  doc.setLineWidth(0.5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 18, 28);
  doc.text(textos.colunaData, esquerda + 1, y);

  textos.colunas.forEach((rotulo, i) => {
    const centro = esquerda + colData + larguraColuna * i + larguraColuna / 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(20, 18, 28);
    doc.text(rotulo, centro, y, { align: 'center' });
    const sub = textos.subColunas[i];
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(86, 80, 107);
      doc.text(sub, centro, y + 3.4, { align: 'center' });
    }
  });

  y += 5.5;
  doc.setDrawColor(20, 18, 28);
  doc.setLineWidth(0.5);
  doc.line(esquerda, y, direita, y);

  // ── Linhas ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  dados.datas.forEach((data, linha) => {
    const topo = y + alturaLinha * linha;
    const meio = topo + alturaLinha / 2;

    doc.setFontSize(8.5);
    doc.setTextColor(20, 18, 28);
    doc.text(data, esquerda + 1, meio + 1);

    for (let c = 0; c < colunas; c++) {
      const inicioColuna = esquerda + colData + larguraColuna * c;
      const inicioCaixas = inicioColuna + (larguraColuna - larguraCaixas) / 2;
      for (let d = 0; d < 3; d++) {
        // Azul claro de propósito: essa tonalidade some no tratamento da imagem
        // e sobra só o que foi escrito de caneta. Linha preta atrapalharia.
        doc.setDrawColor(159, 192, 228);
        doc.setLineWidth(0.25);
        doc.rect(inicioCaixas + (ladoCaixa + vaoCaixa) * d, meio - alturaCaixa / 2,
                 ladoCaixa, alturaCaixa);
      }
    }

    // Separador entre os dias, discreto.
    doc.setDrawColor(220, 231, 245);
    doc.setLineWidth(0.2);
    doc.line(esquerda, topo + alturaLinha, direita, topo + alturaLinha);
  });

  // ── Rodapé ────────────────────────────────────────────────────────────────
  const baseRodape = y + alturaLinha * dados.datas.length + 6;
  doc.setDrawColor(20, 18, 28);
  doc.setLineWidth(0.5);
  doc.line(esquerda, baseRodape, direita, baseRodape);

  doc.setFontSize(7.5);
  doc.setTextColor(86, 80, 107);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(textos.rodape, larguraTotal), esquerda, baseRodape + 4.5);

  return doc;
}

/**
 * Abre a janela de impressão do navegador. Se o navegador bloquear a nova aba
 * (acontece bastante no celular), baixa o arquivo — o profissional imprime pelo
 * próprio aparelho. Nunca deixa o clique sem resposta.
 */
export function imprimirPapelControle(doc: jsPDF, nomeArquivo: string): void {
  try {
    doc.autoPrint();
    const janela = window.open(doc.output('bloburl'), '_blank');
    if (janela) return;
  } catch {
    /* cai no download */
  }
  doc.save(nomeArquivo);
}
