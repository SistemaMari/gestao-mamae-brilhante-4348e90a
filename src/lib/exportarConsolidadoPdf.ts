// PDF do consolidado da rede (gestor geral) — mesmo formato do PDF do painel da
// unidade: página de resumo (com a tabela por unidade), uma página por bloco do
// Consolidador (capturados da própria tela, com os filtros aplicados) e apêndice
// com as gestantes de cada gargalo.
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { slugify } from './slugify';
import { formatDateISO } from './dateUtils';
import {
  addCanvasPaginated,
  addFootersAllPages,
  baixarPdf,
  captureToCanvas,
  carregarFontes,
  escapeHtml,
  formatDateBr,
  formatIgDias,
  formatPeriodo,
} from './pdfCaptura';
import type {
  ConsolidadorGargalosDetalhado,
  GargaloGestanteGG,
  VisaoGeralRow,
} from '@/hooks/usePainelDataGestorGeral';

/** Linhas por gargalo no apêndice (o diálogo na tela mostra até 500). */
export const LIMITE_APENDICE_REDE = 50;

export interface ExportarConsolidadoInput {
  redeNome: string;
  unidadesNomes: string[];
  periodo: { inicio: string; fim: string };
  /** Contêiner da tela do Consolidador: cada bloco tem data-pdf-section. */
  raiz: HTMLElement;
  visaoGeral: VisaoGeralRow[] | null;
  /** Unidades do filtro (null = todas as da rede), para a lista do apêndice. */
  unidadesIds: string[] | null;
}

const TH = 'text-align: left; padding: 7px 9px; font-size: 10.5px; color: #64748B; font-weight: 600; text-transform: uppercase;';
const TD = 'padding: 7px 9px; font-size: 11.5px; color: #334155;';

function tabelaPorUnidade(linhas: VisaoGeralRow[]): string {
  if (linhas.length === 0) return '';
  const corpo = [...linhas]
    .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome, 'pt-BR'))
    .map(
      (u) => `
      <tr style="border-top: 1px solid #E2E8F0;">
        <td style="${TD} color: #1E293B; font-weight: 600;">${escapeHtml(u.unidade_nome)}</td>
        <td style="${TD}">${escapeHtml(u.gestor_nome || '—')}</td>
        <td style="${TD} text-align: right;">${u.pacientes_ativos}</td>
        <td style="${TD} text-align: right;">${u.laudos_emitidos}</td>
        <td style="${TD} text-align: right;">${u.partos_registrados}</td>
        <td style="${TD} text-align: right;">${u.profissionais_ativos}</td>
        <td style="${TD} text-align: right;">${Number(u.taxa_dmg_positivo_pct ?? 0).toFixed(1).replace('.', ',')}%</td>
      </tr>`,
    )
    .join('');
  return `
    <div style="margin-top: 22px;">
      <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 600; font-size: 15px; color: #7E69AB; margin-bottom: 4px;">
        Visão geral por unidade
      </div>
      <div style="font-size: 11.5px; color: #64748B; margin-bottom: 10px;">
        Taxa de diagnóstico = gestantes com diabetes confirmado (DMG ou diabetes prévio/overt) entre as rastreadas no período.
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0;">
        <thead>
          <tr style="background: #F8FAFC;">
            <th style="${TH}">Unidade</th>
            <th style="${TH}">Gestor</th>
            <th style="${TH} text-align: right;">Gestantes ativas</th>
            <th style="${TH} text-align: right;">Laudos</th>
            <th style="${TH} text-align: right;">Partos</th>
            <th style="${TH} text-align: right;">Profissionais</th>
            <th style="${TH} text-align: right;">Taxa de diagnóstico</th>
          </tr>
        </thead>
        <tbody>${corpo}</tbody>
      </table>
    </div>`;
}

function buildResumo(input: ExportarConsolidadoInput, geradoEm: Date): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width: 794px; padding: 32px; background: #ffffff; font-family: 'Plus Jakarta Sans', system-ui, Arial, sans-serif; color: #1E293B;`;
  const periodoTxt = formatPeriodo(input.periodo);
  el.innerHTML = `
    <div style="border-bottom: 2px solid #9b87f5; padding-bottom: 16px; margin-bottom: 18px;">
      <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 700; font-size: 22px; color: #1E293B;">
        Consolidado da rede — ${escapeHtml(input.redeNome)}
      </div>
      <div style="margin-top: 6px; font-size: 13px; color: #64748B;">
        Relatório gerado em ${geradoEm.toLocaleDateString('pt-BR')} às ${geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
      ${periodoTxt ? `<div style="margin-top: 4px; font-size: 13px; color: #64748B;">Período analisado: ${escapeHtml(periodoTxt)} (gargalos e gestantes ativas: situação no dia do relatório)</div>` : ''}
    </div>
    <div style="background: #F8FAFC; border-left: 4px solid #7E69AB; padding: 14px 18px; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #334155;">
      <strong>Unidades incluídas (${input.unidadesNomes.length}):</strong> ${escapeHtml(input.unidadesNomes.join(', '))}
    </div>
    ${tabelaPorUnidade(input.visaoGeral ?? [])}
  `;
  return el;
}

function buildApendice(detalhes: ConsolidadorGargalosDetalhado): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `width: 794px; padding: 32px; background: #ffffff; font-family: 'Plus Jakarta Sans', system-ui, Arial, sans-serif; color: #1E293B;`;
  const grupos: Array<{ titulo: string; cor: string; lista: GargaloGestanteGG[] }> = [
    { titulo: 'Sem glicemia de jejum na primeira consulta', cor: '#CA8A04', lista: detalhes.sem_gj_primeira_consulta ?? [] },
    { titulo: 'Curva glicêmica (GTT 75g) em atraso', cor: '#EA580C', lista: detalhes.atrasadas_gtt ?? [] },
    { titulo: 'Diabetes confirmado sem retorno', cor: '#DC2626', lista: detalhes.confirmadas_sem_retorno ?? [] },
  ];
  const blocos = grupos
    .map((g) => {
      const mostradas = g.lista.slice(0, LIMITE_APENDICE_REDE);
      const linhas =
        mostradas.length === 0
          ? `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94A3B8; font-size: 12.5px;">Nenhuma gestante neste grupo.</td></tr>`
          : mostradas
              .map(
                (p) => `
        <tr style="border-top: 1px solid #E2E8F0;">
          <td style="${TD} color: #1E293B;">${escapeHtml(p.nome)}</td>
          <td style="${TD}">${escapeHtml(p.unidade_nome || '—')}</td>
          <td style="${TD}">${formatIgDias(p.ig_atual_dias)}</td>
          <td style="${TD}">${formatDateBr(p.ultima_consulta)}</td>
          <td style="${TD}">${escapeHtml(p.profissional_nome || '—')}</td>
        </tr>`,
              )
              .join('');
      const aviso =
        g.lista.length > mostradas.length
          ? `<div style="font-size: 11px; color: #64748B; margin-top: 4px;">Mostrando ${mostradas.length} de ${g.lista.length}. A lista completa está na tela do Consolidador (exportável em Excel).</div>`
          : '';
      return `
        <div style="margin-bottom: 22px;">
          <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 600; font-size: 14px; color: ${g.cor}; margin-bottom: 8px;">
            ${escapeHtml(g.titulo)} (${g.lista.length})
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #E2E8F0;">
            <thead>
              <tr style="background: #F8FAFC;">
                <th style="${TH}">Gestante</th>
                <th style="${TH}">Unidade</th>
                <th style="${TH}">IG hoje</th>
                <th style="${TH}">Última consulta</th>
                <th style="${TH}">Profissional</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
          ${aviso}
        </div>`;
    })
    .join('');
  el.innerHTML = `
    <div style="font-family: 'Sora', system-ui, sans-serif; font-weight: 700; font-size: 18px; color: #1E293B; margin-bottom: 4px;">
      Apêndice — Gestantes nos gargalos
    </div>
    <div style="font-size: 12px; color: #64748B; margin-bottom: 18px;">
      Situação no dia do relatório (não depende do período escolhido). Até ${LIMITE_APENDICE_REDE} gestantes por gargalo.
    </div>
    ${blocos}`;
  return el;
}

/** Blocos da tela com data-pdf-section, sem os aninhados (o externo já os inclui). */
function secoesDaTela(raiz: HTMLElement): HTMLElement[] {
  const todas = Array.from(raiz.querySelectorAll<HTMLElement>('[data-pdf-section]'));
  return todas.filter((el) => {
    const pai = el.parentElement?.closest('[data-pdf-section]');
    return !pai || !raiz.contains(pai);
  });
}

export async function exportarConsolidadoPdf(
  input: ExportarConsolidadoInput,
): Promise<{ ok: boolean; tempoMs: number; error?: string }> {
  const t0 = performance.now();
  let off: HTMLDivElement | null = null;
  try {
    await carregarFontes();

    let detalhes: ConsolidadorGargalosDetalhado | null = null;
    const { data, error } = await supabase.rpc('get_consolidador_gargalos_detalhado_gestor_geral', {
      p_unidades: input.unidadesIds ?? undefined,
      p_limit: LIMITE_APENDICE_REDE,
    });
    if (!error && data) detalhes = data as unknown as ConsolidadorGargalosDetalhado;

    const geradoEm = new Date();
    off = document.createElement('div');
    off.style.cssText = `position: fixed; left: -10000px; top: 0; background: #ffffff; z-index: -1;`;
    document.body.appendChild(off);
    const resumoEl = buildResumo(input, geradoEm);
    off.appendChild(resumoEl);
    const apendiceEl = detalhes ? buildApendice(detalhes) : null;
    if (apendiceEl) off.appendChild(apendiceEl);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    addCanvasPaginated(pdf, await captureToCanvas(resumoEl), { firstPage: true });

    for (const sec of secoesDaTela(input.raiz)) {
      try {
        addCanvasPaginated(pdf, await captureToCanvas(sec));
      } catch (err) {
        console.error('[exportarConsolidadoPdf] falha ao capturar bloco:', sec.dataset.pdfSection, err);
      }
    }

    if (apendiceEl) addCanvasPaginated(pdf, await captureToCanvas(apendiceEl));

    addFootersAllPages(pdf, `Rede ${input.redeNome}`, geradoEm);
    baixarPdf(pdf, `consolidado-${slugify(input.redeNome)}-${formatDateISO(geradoEm)}.pdf`);
    return { ok: true, tempoMs: Math.round(performance.now() - t0) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha ao gerar PDF';
    return { ok: false, tempoMs: Math.round(performance.now() - t0), error: msg };
  } finally {
    if (off && off.parentNode) off.parentNode.removeChild(off);
  }
}
