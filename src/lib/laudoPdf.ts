import jsPDF from 'jspdf';

export interface LaudoPdfData {
  pacienteNome: string;
  medicoNome?: string | null;
  medicoCrm?: string | null;
  /** @deprecated mantido por compatibilidade; não é mais exibido no header */
  cenario?: string | null;
  geradoEm: string; // formatted
  conteudo: string;
}

/**
 * Gera um PDF simples a partir do conteúdo textual do laudo
 * (que pode vir como JSON estruturado ou texto puro).
 */
export function downloadLaudoPdf({ pacienteNome, medicoNome, medicoCrm, geradoEm, conteudo }: LaudoPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 56;
  const usableWidth = pageWidth - marginX * 2;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Laudo de apoio diagnóstico — DMG', marginX, marginTop);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(110);
  let headerY = marginTop + 18;
  doc.text(`Paciente: ${pacienteNome}`, marginX, headerY);
  headerY += 14;
  if (medicoNome) {
    const crmTxt = medicoCrm ? ` — CRM ${medicoCrm}` : '';
    doc.text(`Médico responsável: Dr(a). ${medicoNome}${crmTxt}`, marginX, headerY);
    headerY += 14;
  }
  doc.text(`Gerado em ${geradoEm}`, marginX, headerY);
  headerY += 10;
  doc.setDrawColor(220);
  doc.line(marginX, headerY, pageWidth - marginX, headerY);

  // Body start
  const bodyStartY = headerY + 20;

  // Body
  doc.setTextColor(20);
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(conteudo || '(laudo vazio)', usableWidth);

  let y = bodyStartY;
  const lineHeight = 14;
  for (const line of lines) {
    if (y > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
    doc.text(line, marginX, y);
    y += lineHeight;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `MARI  •  Página ${p} de ${totalPages}`,
      marginX,
      pageHeight - 24,
    );
  }

  const safe = pacienteNome.replace(/[^a-zA-Z0-9-_]+/g, '_').slice(0, 40) || 'paciente';
  doc.save(`laudo_${safe}_${Date.now()}.pdf`);
}

/**
 * Converte o conteúdo do laudo (texto ou JSON) em string legível.
 */
export function laudoConteudoToText(conteudo: string | null | undefined): string {
  if (!conteudo) return '';
  const trimmed = conteudo.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    return jsonToText(parsed);
  } catch {
    return trimmed;
  }
}

function jsonToText(obj: any, depth = 0): string {
  const indent = '  '.repeat(depth);
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => `${indent}• ${jsonToText(item, depth + 1)}`).join('\n');
  }
  return Object.entries(obj)
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const value = jsonToText(v, depth + 1);
      if (value.includes('\n')) return `${indent}${label}:\n${value}`;
      return `${indent}${label}: ${value}`;
    })
    .join('\n');
}
