import jsPDF from 'jspdf';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { gerarResumoExecutivo } from './gerarResumoExecutivo';
import { slugify } from './slugify';
import { formatDateISO } from './dateUtils';
import {
  addCanvasPaginated,
  addFootersAllPages,
  baixarPdf,
  captureToCanvas,
  carregarFontes,
  escapeHtml,
  formatDateBr as formatDate,
  formatIgDias as formatIg,
  formatPeriodo,
} from './pdfCaptura';
import { fetchDadosEquipe } from './fetchDadosEquipe';
import { PdfModeContext } from '@/components/gestao/PdfModeContext';
import BlocoOperacao from '@/components/gestao/BlocoOperacao';
import BlocoPerfilClinico from '@/components/gestao/BlocoPerfilClinico';
import BlocoGargalos from '@/components/gestao/BlocoGargalos';
import BlocoTendencia from '@/components/gestao/BlocoTendencia';
import SecaoEquipePdf from '@/components/gestao/SecaoEquipePdf';
import LinhaDeCuidado from '@/components/gestao/LinhaDeCuidado';
import type { LinhaCuidadoResposta } from './linhaCuidado';
import type { MetasRede } from './metas';
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
  /** Seção "Linha de cuidado" (opcional: sem dados, o PDF sai sem ela). */
  linhaCuidado?: LinhaCuidadoResposta | null;
  metas?: MetasRede | null;
  notaMetas?: string | null;
  /** Período escolhido no filtro do painel (datas AAAA-MM-DD). */
  periodo?: { inicio: string; fim: string } | null;
}

const OFFSCREEN_WIDTH_PX = 1024;
function buildResumoElement(
  unidadeNome: string,
  frases: string[],
  geradoEm: Date,
  periodo?: { inicio: string; fim: string } | null,
): HTMLDivElement {
  const periodoTxt = formatPeriodo(periodo);
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
      ${periodoTxt ? `<div style="margin-top: 4px; font-size: 13px; color: #64748B;">Período analisado: ${escapeHtml(periodoTxt)} (gargalos e gestantes ativas: situação no dia do relatório)</div>` : ''}
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
    { titulo: 'GTT 75g em atraso', cor: '#EA580C', lista: detalhes.atrasadas_gtt },
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
    const resumoEl = buildResumoElement(input.unidadeNome, frases, geradoEm, input.periodo);
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
            input.linhaCuidado
              ? createElement(LinhaDeCuidado, {
                  data: input.linhaCuidado,
                  loading: false,
                  error: null,
                  metas: input.metas ?? null,
                  notaMetas: input.notaMetas ?? null,
                })
              : null,
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
    const sections = ['operacao', 'perfil', 'linha-cuidado', 'gargalos', 'tendencia', 'equipe'];
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

    const filename = `painel-${slugify(input.unidadeNome)}-${formatDateISO(geradoEm)}.pdf`;
    baixarPdf(pdf, filename);

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
