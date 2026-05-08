import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import BlocoTendencia from '@/components/gestao/BlocoTendencia';
import { mockTendencia } from '@/lib/mockPainelEstrategico';

/**
 * POC Etapa 0 — validar captura do gráfico Recharts (LineChart) via html2canvas
 * + inserção em jsPDF, com fontes Sora + Plus Jakarta Sans carregadas corretamente.
 *
 * Critérios:
 *  1. PDF deve mostrar o gráfico com cores #9b87f5 e #7E69AB, eixos legíveis, legenda
 *  2. Canvas intermediário (toDataURL) deve aparecer fielmente em <img>
 *  3. Tipografia: títulos em Sora 600, corpo em Plus Jakarta — comparar visualmente
 */
export default function PocPdfGraficoPage() {
  const captureRef = useRef<HTMLDivElement>(null);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [tempoMs, setTempoMs] = useState<number | null>(null);
  const [fontsCarregadas, setFontsCarregadas] = useState<{
    sora: boolean;
    jakarta: boolean;
  } | null>(null);

  const aguardarFontes = async () => {
    try {
      // Força carregamento via Font Loading API
      await Promise.all([
        document.fonts.load('600 16px "Sora"'),
        document.fonts.load('400 14px "Plus Jakarta Sans"'),
        document.fonts.load('600 14px "Plus Jakarta Sans"'),
      ]);
      await document.fonts.ready;
      // 2x rAF para garantir layout estabilizado
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      const sora = document.fonts.check('600 16px "Sora"');
      const jakarta = document.fonts.check('400 14px "Plus Jakarta Sans"');
      setFontsCarregadas({ sora, jakarta });
      return { sora, jakarta };
    } catch (e) {
      console.error('Erro ao carregar fontes', e);
      setFontsCarregadas({ sora: false, jakarta: false });
      return { sora: false, jakarta: false };
    }
  };

  const gerarPdf = async () => {
    if (!captureRef.current) return;
    setStatus('Carregando fontes...');
    const t0 = performance.now();
    await aguardarFontes();

    setStatus('Capturando canvas (html2canvas)...');
    const canvas = await html2canvas(captureRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/png');
    setCanvasDataUrl(dataUrl);

    setStatus('Montando PDF (jsPDF)...');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 32;
    const usableWidth = pageWidth - margin * 2;
    const ratio = canvas.height / canvas.width;
    const imgHeight = usableWidth * ratio;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('POC — Captura de gráfico Recharts em PDF', margin, margin + 10);

    pdf.addImage(dataUrl, 'PNG', margin, margin + 30, usableWidth, imgHeight);

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);

    // Expor PDF + canvas como base64 em textareas para extração via tooling
    const pdfB64 = pdf.output('datauristring');
    (window as unknown as { __pocPdfB64: string }).__pocPdfB64 = pdfB64;
    (window as unknown as { __pocCanvasB64: string }).__pocCanvasB64 = dataUrl;

    const t1 = performance.now();
    setTempoMs(Math.round(t1 - t0));
    setStatus('PDF gerado ✓');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-xl border bg-white p-5">
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'Sora, sans-serif', color: '#1E293B' }}
          >
            POC — Etapa 0: PDF do Painel
          </h1>
          <p
            className="mt-2 text-sm text-slate-600"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            Valida captura do gráfico Recharts via html2canvas + jsPDF, e
            renderização correta de Sora + Plus Jakarta Sans no PDF.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={gerarPdf}
              className="rounded-lg bg-[#7C4DBA] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6A3FA0]"
            >
              Gerar PDF do POC
            </button>
            <span className="text-sm text-slate-500">Status: {status}</span>
            {tempoMs !== null && (
              <span className="text-sm text-slate-500">⏱ {tempoMs}ms</span>
            )}
          </div>
          {fontsCarregadas && (
            <div className="mt-3 text-xs text-slate-600">
              Sora: {fontsCarregadas.sora ? '✅ carregada' : '❌ fallback'} ·
              {' '}Plus Jakarta Sans: {fontsCarregadas.jakarta ? '✅ carregada' : '❌ fallback'}
            </div>
          )}
        </header>

        {/* Área que será capturada */}
        <div
          ref={captureRef}
          style={{ width: 794, background: '#FFFFFF', padding: 24 }}
          className="mx-auto rounded-xl border"
        >
          {/* Bloco de tipografia para validação visual */}
          <div className="mb-6">
            <h2
              style={{
                fontFamily: 'Sora, sans-serif',
                fontWeight: 600,
                fontSize: 20,
                color: '#1E293B',
                margin: 0,
              }}
            >
              Tipografia — Sora 600 (título)
            </h2>
            <p
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 400,
                fontSize: 14,
                color: '#475569',
                marginTop: 6,
              }}
            >
              Corpo em Plus Jakarta Sans 400. A renderização correta destas
              fontes é critério de aceite. Fallback (Arial) deve ser
              visualmente distinto: serif/proporções diferentes nas letras
              "g", "a" e "R".
            </p>
            <p
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontWeight: 600,
                fontSize: 13,
                color: '#1E293B',
                marginTop: 4,
              }}
            >
              Plus Jakarta Sans 600 — destaque secundário.
            </p>
          </div>

          {/* Gráfico real do produto */}
          <BlocoTendencia data={mockTendencia} />
        </div>

        {/* Canvas intermediário */}
        {canvasDataUrl && (
          <section className="rounded-xl border bg-white p-5">
            <h3
              style={{ fontFamily: 'Sora, sans-serif' }}
              className="mb-3 text-lg font-semibold"
            >
              Canvas intermediário (toDataURL → &lt;img&gt;)
            </h3>
            <img
              src={canvasDataUrl}
              alt="canvas capturado"
              style={{ width: '100%', border: '1px solid #E2E8F0' }}
            />
            <textarea
              data-testid="canvas-b64"
              readOnly
              value={canvasDataUrl}
              style={{ display: 'none' }}
            />
          </section>
        )}

        {pdfUrl && (
          <section className="rounded-xl border bg-white p-5">
            <h3
              style={{ fontFamily: 'Sora, sans-serif' }}
              className="mb-3 text-lg font-semibold"
            >
              PDF gerado (preview inline)
            </h3>
            <iframe
              src={pdfUrl}
              title="poc-pdf"
              style={{ width: '100%', height: 900, border: '1px solid #E2E8F0' }}
            />
            <a
              href={pdfUrl}
              download="poc-pdf-grafico.pdf"
              className="mt-2 inline-block text-sm text-[#7C4DBA] underline"
            >
              Baixar PDF
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
