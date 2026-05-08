import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { gerarResumoExecutivo } from './gerarResumoExecutivo';
import { slugify } from './slugify';
import { fetchDadosEquipe } from './fetchDadosEquipe';
import { PdfModeContext } from '@/components/gestao/PdfModeContext';
import BlocoOperacao from '@/components/gestao/BlocoOperacao';
import BlocoPerfilClinico from '@/components/gestao/BlocoPerfilClinico';
import BlocoGargalos from '@/components/gestao/BlocoGargalos';
import BlocoTendencia from '@/components/gestao/BlocoTendencia';
import SecaoEquipePdf from '@/components/gestao/SecaoEquipePdf';
import type {
  PainelOperacao,
  PainelPerfilClinico,
  PainelGargalos,
  PainelTendencia,
} from './painelEstrategicoTypes';

interface PacienteGargaloDetalhe {
  paciente_id: string;
  nome: string;
  ig_atual_dias: number;
  ultima_consulta: string | null;
  profissional_nome: string | null;
}

interface DetalhesGargalos {
  sem_gj_primeira_consulta: PacienteGargaloDetalhe[];
  atrasadas_gtt: PacienteGargaloDetalhe[];
  confirmadas_sem_retorno: PacienteGargaloDetalhe[];
}

export interface ExportarPainelInput {
  unidadeId: string;
  unidadeNome: string;
  operacao: PainelOperacao;
  perfil: PainelPerfilClinico;
  gargalos: PainelGargalos;
  tendencia: PainelTendencia;
}

const A4 = { w: 595.28, h: 841.89 }; // pt
const MARGIN = 32;
const FOOTER_H = 24;
const OFFSCREEN_WIDTH_PX = 1024;

async function carregarFontes() {
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

function formatIg(dias: number) {
  const w = Math.floor(dias / 7);
  const d = dias % 7;
  return `${w}s ${d}d`;
}

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

function buildResumoElement(
  unidadeNome: string,
  frases: string[],
  geradoEm: Date,
): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width: 794px; padding: 32px; background: #ffffff; font-family: 'Plus Jakarta Sans', system-ui, Arial, sans-serif; color: #1E293B;`;
  el.innerHTML = `
    <div style="border-bottom: 2px solid #9b87f5; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 700; font-size: 22px; color: #1E293B;">
        Painel da unidade — ${escapeHtml(unidadeNome)}
      </div>
      <div style="margin-top: 6px; font-size: 13px; color: #64748B;">
        Relatório gerado em ${geradoEm.toLocaleDateString('pt-BR')} às ${geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
    <div style="background: #F8FAFC; border-left: 4px solid #7E69AB; padding: 18px 22px; border-radius: 8px;">
      <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 600; font-size: 15px; color: #7E69AB; margin-bottom: 12px;">
        Resumo executivo
      </div>
      ${frases
        .map(
          f =>
            `<p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.6; color: #334155;">${escapeHtml(f)}</p>`,
        )
        .join('')}
    </div>
  `;
  return el;
}

function buildApendiceElement(detalhes: DetalhesGargalos): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width: 794px; padding: 32px; background: #ffffff; font-family: 'Plus Jakarta Sans', system-ui, Arial, sans-serif; color: #1E293B;`;

  const grupos: Array<{ titulo: string; cor: string; lista: PacienteGargaloDetalhe[] }> = [
    { titulo: 'Sem GJ na primeira consulta', cor: '#CA8A04', lista: detalhes.sem_gj_primeira_consulta },
    { titulo: 'GTT em atraso', cor: '#EA580C', lista: detalhes.atrasadas_gtt },
    { titulo: 'DMG confirmado sem retorno', cor: '#DC2626', lista: detalhes.confirmadas_sem_retorno },
  ];

  const blocos = grupos
    .map(g => {
      const linhas =
        g.lista.length === 0
          ? `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94A3B8; font-size: 13px;">Nenhuma paciente neste grupo.</td></tr>`
          : g.lista
              .map(
                p => `
        <tr style="border-top: 1px solid #E2E8F0;">
          <td style="padding: 8px 10px; font-size: 12px;">${escapeHtml(p.nome)}</td>
          <td style="padding: 8px 10px; font-size: 12px; color: #475569;">${formatIg(p.ig_atual_dias)}</td>
          <td style="padding: 8px 10px; font-size: 12px; color: #475569;">${formatDate(p.ultima_consulta)}</td>
          <td style="padding: 8px 10px; font-size: 12px; color: #475569;">${escapeHtml(p.profissional_nome || '—')}</td>
        </tr>`,
              )
              .join('');
      return `
        <div style="margin-bottom: 22px;">
          <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 600; font-size: 14px; color: ${g.cor}; margin-bottom: 8px;">
            ${escapeHtml(g.titulo)} (${g.lista.length})
          </div>
          <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #E2E8F0; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background: #F8FAFC;">
                <th style="text-align: left; padding: 8px 10px; font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase;">Paciente</th>
                <th style="text-align: left; padding: 8px 10px; font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase;">IG atual</th>
                <th style="text-align: left; padding: 8px 10px; font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase;">Última consulta</th>
                <th style="text-align: left; padding: 8px 10px; font-size: 11px; color: #64748B; font-weight: 600; text-transform: uppercase;">Profissional</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      `;
    })
    .join('');

  el.innerHTML = `
    <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 700; font-size: 18px; color: #1E293B; margin-bottom: 4px;">
      Apêndice — Pacientes nos gargalos
    </div>
    <div style="font-size: 12px; color: #64748B; margin-bottom: 18px;">
      Lista nominal limitada aos 30 casos mais antigos por gargalo.
    </div>
    ${blocos}
  `;
  return el;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function captureToCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });
}

function addCanvasPaginated(
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
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, usableW, imgFullH);
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
    pdf.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, usableW, h / ratio);
    yPx += h;
    firstSlice = false;
  }
}

function addFootersAllPages(pdf: jsPDF, unidadeNome: string, geradoEm: Date) {
  const totalPages = pdf.getNumberOfPages();
  const footer = `${unidadeNome} · Gerado em ${geradoEm.toLocaleDateString('pt-BR')} ${geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(footer, MARGIN, A4.h - 14);
    pdf.text(`Página ${i} de ${totalPages}`, A4.w - MARGIN, A4.h - 14, { align: 'right' });
  }
}

export async function exportarPainelPdf(
  input: ExportarPainelInput,
): Promise<{ ok: boolean; tempoMs: number; error?: string }> {
  const t0 = performance.now();
  let off: HTMLDivElement | null = null;
  let reactRoot: Root | null = null;
  try {
    await carregarFontes();

    // Buscar detalhes nominais dos gargalos (RPC) + dados do painel de equipe
    const isVitrine = input.unidadeId === 'vitrine-unidade';
    let detalhes: DetalhesGargalos = {
      sem_gj_primeira_consulta: [],
      atrasadas_gtt: [],
      confirmadas_sem_retorno: [],
    };
    if (!isVitrine) {
      const { data, error } = await supabase.rpc('get_painel_gargalos_detalhado', {
        p_unidade_id: input.unidadeId,
        p_limit: 30,
      });
      if (!error && data) {
        detalhes = data as unknown as DetalhesGargalos;
      }
    }

    const dadosEquipe = isVitrine
      ? null
      : await fetchDadosEquipe(input.unidadeId).catch(() => null);

    const geradoEm = new Date();
    const frases = gerarResumoExecutivo({
      unidadeNome: input.unidadeNome,
      operacao: input.operacao,
      perfil: input.perfil,
      gargalos: input.gargalos,
    });

    // Off-screen container
    off = document.createElement('div');
    off.style.cssText = `position: fixed; left: -10000px; top: 0; width: ${OFFSCREEN_WIDTH_PX}px; background: #ffffff; z-index: -1;`;
    document.body.appendChild(off);

    // 1) Resumo (HTML puro)
    const resumoEl = buildResumoElement(input.unidadeNome, frases, geradoEm);
    off.appendChild(resumoEl);

    // 2) React root para os blocos do painel + equipe (com PdfModeContext = true)
    const reactHost = document.createElement('div');
    reactHost.style.cssText = `width: ${OFFSCREEN_WIDTH_PX}px; padding: 24px; background: #ffffff;`;
    off.appendChild(reactHost);

    reactRoot = createRoot(reactHost);
    reactRoot.render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/gestao'] },
        createElement(
          PdfModeContext.Provider,
          { value: true },
          createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
            createElement(BlocoOperacao, { data: input.operacao }),
            createElement(BlocoPerfilClinico, { data: input.perfil }),
            createElement(BlocoGargalos, { data: input.gargalos, hideVerPacientesLink: true }),
            createElement(BlocoTendencia, { data: input.tendencia, showDataLabels: true }),
            dadosEquipe ? createElement(SecaoEquipePdf, { dados: dadosEquipe }) : null,
          ),
        ),
      ),
    );

    // 3) Apêndice (HTML puro)
    const apendiceEl = buildApendiceElement(detalhes);
    off.appendChild(apendiceEl);

    // Aguarda layout + Recharts renderizar (ResponsiveContainer + animações)
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise(r => setTimeout(r, 600));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    // Página 1: resumo
    const cResumo = await captureToCanvas(resumoEl);
    addCanvasPaginated(pdf, cResumo, { firstPage: true });

    // Seções renderizadas pelo React (cada uma vira uma página)
    const sections = ['operacao', 'perfil', 'gargalos', 'tendencia', 'equipe'];
    for (const sec of sections) {
      const node = reactHost.querySelector(`[data-pdf-section="${sec}"]`) as HTMLElement | null;
      if (!node) {
        console.warn(`[exportarPainelPdf] seção "${sec}" não renderizou no host React`);
        continue;
      }
      try {
        const c = await captureToCanvas(node);
        addCanvasPaginated(pdf, c);
      } catch (err) {
        console.error(`[exportarPainelPdf] falha ao capturar seção "${sec}":`, err);
      }
    }

    // Apêndice
    const cApend = await captureToCanvas(apendiceEl);
    addCanvasPaginated(pdf, cApend);

    addFootersAllPages(pdf, input.unidadeNome, geradoEm);

    const filename = `painel-${slugify(input.unidadeNome)}-${geradoEm.toISOString().slice(0, 10)}.pdf`;
    const blob = pdf.output('blob');
    const b64 = pdf.output('datauristring').replace(/^data:.*?;base64,/, '');
    (window as unknown as Record<string, unknown>).__painelPdfB64 = b64;
    let dbg = document.getElementById('__painel_pdf_b64') as HTMLTextAreaElement | null;
    if (!dbg) {
      dbg = document.createElement('textarea');
      dbg.id = '__painel_pdf_b64';
      dbg.style.cssText = 'position: fixed; left: -9999px; top: 0;';
      document.body.appendChild(dbg);
    }
    dbg.value = b64;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    const tempoMs = Math.round(performance.now() - t0);
    return { ok: true, tempoMs };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha ao gerar PDF';
    return { ok: false, tempoMs: Math.round(performance.now() - t0), error: msg };
  } finally {
    try { reactRoot?.unmount(); } catch { /* ignore */ }
    if (off && off.parentNode) off.parentNode.removeChild(off);
  }
}
