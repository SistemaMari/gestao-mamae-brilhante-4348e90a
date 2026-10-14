// Peças comuns dos PDFs de painel (unidade e rede): captura de HTML em imagem,
// paginação A4 e rodapé. Usado por exportarPainelPdf e exportarConsolidadoPdf.
import html2canvas from 'html2canvas';
import type jsPDF from 'jspdf';

export const A4 = { w: 595.28, h: 841.89 }; // pt
export const MARGIN = 32;
export const FOOTER_H = 24;
// JPEG em vez de PNG: o PNG sem compressão deixava o PDF com dezenas de MB.
// Fundo é sempre branco (html2canvas), então não há transparência a perder.
const JPEG_QUALIDADE = 0.92;

/** Elementos marcados com este atributo não entram no PDF (ex.: links "Ver gestantes"). */
export const ATRIBUTO_OCULTAR_NO_PDF = 'data-pdf-ocultar';

export async function carregarFontes() {
  try {
    await Promise.all([
      document.fonts.load('600 16px "Sora"'),
      document.fonts.load('700 20px "Sora"'),
      document.fonts.load('400 14px "Plus Jakarta Sans"'),
      document.fonts.load('600 14px "Plus Jakarta Sans"'),
    ]);
    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  } catch {
    /* fallback Helvetica */
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatIgDias(dias: number | null | undefined) {
  if (dias == null) return '—';
  const w = Math.floor(dias / 7);
  const d = dias % 7;
  return `${w}s ${d}d`;
}

export function formatDateBr(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

export function formatPeriodo(p: { inicio: string; fim: string } | null | undefined): string | null {
  if (!p?.inicio || !p?.fim) return null;
  const br = (s: string) => s.split('-').reverse().join('/');
  return `${br(p.inicio)} a ${br(p.fim)}`;
}

export async function captureToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    ignoreElements: (node) => node instanceof Element && node.hasAttribute(ATRIBUTO_OCULTAR_NO_PDF),
  });
}

export function addCanvasPaginated(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  opts: { firstPage?: boolean } = {},
): void {
  const usableW = A4.w - MARGIN * 2;
  const usableH = A4.h - MARGIN * 2 - FOOTER_H;
  const ratio = canvas.width / usableW;
  const imgFullH = canvas.height / ratio;

  if (imgFullH <= usableH) {
    if (!opts.firstPage) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALIDADE), 'JPEG', MARGIN, MARGIN, usableW, imgFullH);
    return;
  }

  const sliceHpx = Math.floor(usableH * ratio);
  let yPx = 0;
  let firstSlice = true;
  while (yPx < canvas.height) {
    const h = Math.min(sliceHpx, canvas.height - yPx);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext('2d')!;
    ctx.drawImage(canvas, 0, yPx, canvas.width, h, 0, 0, canvas.width, h);
    if (!(firstSlice && opts.firstPage)) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', JPEG_QUALIDADE), 'JPEG', MARGIN, MARGIN, usableW, h / ratio);
    yPx += h;
    firstSlice = false;
  }
}

export function addFootersAllPages(pdf: jsPDF, rotulo: string, geradoEm: Date) {
  const totalPages = pdf.getNumberOfPages();
  const footer = `${rotulo} · Gerado em ${geradoEm.toLocaleDateString('pt-BR')} ${geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(footer, MARGIN, A4.h - 14);
    pdf.text(`Página ${i} de ${totalPages}`, A4.w - MARGIN, A4.h - 14, { align: 'right' });
  }
}

/** Baixa o PDF no navegador. */
export function baixarPdf(pdf: jsPDF, filename: string) {
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
