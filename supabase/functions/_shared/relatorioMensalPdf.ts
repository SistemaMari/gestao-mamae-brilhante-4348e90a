// PDF do relatório mensal da unidade (pdf-lib, roda nas edge functions).
// Mesmo visual do "Exportar PDF" do painel: faixa da marca, resumo do mês em
// frases, cartões com comparação com o mês anterior, linha de cuidado, últimos
// 6 meses, metas da rede e "como ler". Fonte padrão (Helvetica) — todo texto
// passa por textoPdf (WinAnsi).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'https://esm.sh/pdf-lib@1.17.1';
import type { MetricasUnidade } from './relatorioMensal.ts';

// ── tipos dos dados extras (_relatorio_mensal_dados) ──────────────────────────
export interface BlocoLinhaCuidado {
  criterios?: { perfil_min_dias?: number; meta_pct?: number };
  funil: {
    rastreadas: number;
    diagnosticadas: number;
    em_acompanhamento: number;
    encerradas: Record<string, number>;
    taxa_diagnostico_pct: number | null;
    perda_seguimento_pct: number | null;
  };
  adesao: {
    diagnosticadas: number;
    com_perfil: number;
    com_perfil_completo: number;
    perfil_completo_pct: number | null;
    ultimo_na_meta: number;
    ultimo_na_meta_pct: number | null;
  };
  tempos: {
    gj_gtt_mediana_dias: number | null;
    gj_gtt_n: number;
    diag_perfil_mediana_dias: number | null;
    diag_perfil_n: number;
    diag_insulina_mediana_dias: number | null;
    diag_insulina_n: number;
    diag_com_ig: number;
    diag_antes_28s: number;
    diag_antes_28s_pct: number | null;
  };
}

export interface DadosExtrasRelatorio {
  rede_nome?: string | null;
  atual?: BlocoLinhaCuidado | null;
  anterior?: BlocoLinhaCuidado | null;
  tendencia?: Array<{ mes: string; rastreadas: number; diagnosticadas: number; taxa: number | null }>;
  metas?: Record<string, number | string>;
}

// ── texto (WinAnsi) e números ─────────────────────────────────────────────────
// As fontes padrão do pdf-lib só codificam WinAnsi (Latin-1 + extras do
// CP1252). Qualquer outro caractere (ex.: "≥") derruba a geração inteira com
// "WinAnsi cannot encode" — troca pelos equivalentes ou por "?".
const WINANSI_EXTRAS = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);
export function textoPdf(texto: string): string {
  return Array.from(String(texto ?? ''))
    .map((ch) => {
      if (ch === '≥') return '>=';
      if (ch === '≤') return '<=';
      if (ch === '→') return '>';
      if (ch === '−') return '-';
      const c = ch.codePointAt(0) ?? 0;
      return c <= 255 || WINANSI_EXTRAS.has(ch) ? ch : '?';
    })
    .join('');
}

const num = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('pt-BR'));
const pct = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n)) ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const dias = (n: number | null | undefined) =>
  n == null || Number.isNaN(Number(n)) ? '—' : `${Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${Number(n) === 1 ? 'dia' : 'dias'}`;
const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function nomeMes(iso: string, curto = false): string {
  const [a, m] = iso.split('-').map(Number);
  return curto ? `${MESES_CURTOS[m - 1]}/${String(a).slice(2)}` : `${MESES[m - 1]} de ${a}`;
}
const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ── cores e medidas ───────────────────────────────────────────────────────────
const hex = (h: string): RGB => {
  const v = h.replace('#', '');
  return rgb(parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255);
};
const C = {
  roxo: hex('#7E69AB'),
  lilas: hex('#9b87f5'),
  lilasClaro: hex('#F1F0FB'),
  lilasMedio: hex('#E8E0FF'),
  borda: hex('#E9E5F5'),
  texto: hex('#1E293B'),
  corpo: hex('#334155'),
  muted: hex('#64748B'),
  fundo: hex('#F8FAFC'),
  branco: rgb(1, 1, 1),
  verde: hex('#15803D'),
  verdeClaro: hex('#DCFCE7'),
  verdeFaixa: hex('#BBF7D0'),
  vermelho: hex('#B91C1C'),
  vermelhoClaro: hex('#FEE2E2'),
  vermelhoBarra: hex('#F87171'),
  ambar: hex('#B45309'),
  ambarClaro: hex('#FEF3C7'),
  cinza: hex('#475569'),
  cinzaClaro: hex('#F1F5F9'),
};
type Tom = 'bom' | 'ruim' | 'alerta' | 'neutro';
const TONS: Record<Tom, { fg: RGB; bg: RGB }> = {
  bom: { fg: C.verde, bg: C.verdeClaro },
  ruim: { fg: C.vermelho, bg: C.vermelhoClaro },
  alerta: { fg: C.ambar, bg: C.ambarClaro },
  neutro: { fg: C.cinza, bg: C.cinzaClaro },
};

const W = 595.28;
const H = 841.89;
const M = 36;
const CW = W - 2 * M;
const RODAPE = 40;
const GAP = 8;

// ── documento com cursor (y conta de cima para baixo) ─────────────────────────
class Doc {
  pdf: PDFDocument;
  r: PDFFont;
  b: PDFFont;
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  constructor(pdf: PDFDocument, r: PDFFont, b: PDFFont, private cabecalho: (d: Doc, primeira: boolean) => void) {
    this.pdf = pdf;
    this.r = r;
    this.b = b;
  }
  novaPagina() {
    this.page = this.pdf.addPage([W, H]);
    this.pages.push(this.page);
    this.cabecalho(this, this.pages.length === 1);
  }
  /** Garante h pt livres antes do rodapé; senão abre página nova. */
  garantir(h: number) {
    if (this.y + h > H - RODAPE) this.novaPagina();
  }
  largura(t: string, size: number, bold = false) {
    return (bold ? this.b : this.r).widthOfTextAtSize(textoPdf(t), size);
  }
  texto(t: string, x: number, top: number, size: number, opts: { bold?: boolean; cor?: RGB; alinhar?: 'dir'; opacidade?: number } = {}) {
    const font = opts.bold ? this.b : this.r;
    const s = textoPdf(t);
    const w = font.widthOfTextAtSize(s, size);
    this.page.drawText(s, {
      x: opts.alinhar === 'dir' ? x - w : x,
      y: H - top - size * 0.78,
      size,
      font,
      color: opts.cor ?? C.texto,
      opacity: opts.opacidade,
    });
    return w;
  }
  linhas(t: string, size: number, maxW: number, bold = false): string[] {
    const font = bold ? this.b : this.r;
    const out: string[] = [];
    let linha = '';
    for (const p of textoPdf(t).split(/\s+/)) {
      const tentativa = linha ? `${linha} ${p}` : p;
      if (linha && font.widthOfTextAtSize(tentativa, size) > maxW) {
        out.push(linha);
        linha = p;
      } else linha = tentativa;
    }
    if (linha) out.push(linha);
    return out;
  }
  /** Parágrafo quebrado na largura. Devolve a altura usada. */
  paragrafo(t: string, x: number, top: number, size: number, maxW: number, opts: { bold?: boolean; cor?: RGB; entre?: number } = {}) {
    const ls = this.linhas(t, size, maxW, opts.bold);
    const lh = size * (opts.entre ?? 1.4);
    ls.forEach((l, i) => this.texto(l, x, top + i * lh, size, { bold: opts.bold, cor: opts.cor }));
    return ls.length * lh;
  }
  caixa(x: number, top: number, w: number, h: number, opts: { fundo?: RGB; borda?: RGB; raio?: number; espessura?: number; opacidade?: number } = {}) {
    const r = Math.min(opts.raio ?? 8, h / 2, w / 2);
    const path = `M ${r},0 H ${w - r} Q ${w},0 ${w},${r} V ${h - r} Q ${w},${h} ${w - r},${h} H ${r} Q 0,${h} 0,${h - r} V ${r} Q 0,0 ${r},0 Z`;
    this.page.drawSvgPath(path, {
      x,
      y: H - top,
      color: opts.fundo,
      borderColor: opts.borda,
      borderWidth: opts.borda ? opts.espessura ?? 0.8 : undefined,
      opacity: opts.opacidade,
    });
  }
  pilula(t: string, x: number, top: number, tom: Tom) {
    const size = 6.8;
    const w = this.largura(t, size, true) + 10;
    this.caixa(x, top, w, 12, { fundo: TONS[tom].bg, raio: 6 });
    this.texto(t, x + 5, top + 3, size, { bold: true, cor: TONS[tom].fg });
    return w;
  }
}

// ── variação e metas ──────────────────────────────────────────────────────────
type Sentido = 'bom_subir' | 'ruim_subir' | 'neutro';
function variacao(atual: number | null | undefined, anterior: number | null | undefined, tipo: 'contagem' | 'pct' | 'dias', sentido: Sentido, mesAnt: string) {
  if (atual == null || anterior == null || Number.isNaN(Number(atual)) || Number.isNaN(Number(anterior))) return null;
  const d = Math.round((Number(atual) - Number(anterior)) * 10) / 10;
  if (d === 0) return { texto: `igual a ${mesAnt}`, tom: 'neutro' as Tom };
  const abs = Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const sufixo = tipo === 'pct' ? ' p.p.' : tipo === 'dias' ? (Math.abs(d) === 1 ? ' dia' : ' dias') : '';
  let tom: Tom = 'neutro';
  if (sentido === 'bom_subir') tom = d > 0 ? 'bom' : 'ruim';
  if (sentido === 'ruim_subir') tom = d > 0 ? 'ruim' : 'bom';
  return { texto: `${d > 0 ? '+' : '-'}${abs}${sufixo} vs. ${mesAnt}`, tom };
}

const BASE_MINIMA_META = 5;
const METAS: Array<{ chave: string; nome: string; sentido: 'minimo' | 'maximo'; unidade: 'pct' | 'dias'; valor: (b: BlocoLinhaCuidado) => { v: number | null; base: number } }> = [
  { chave: 'diag_antes_28s_pct', nome: 'Diagnosticadas antes de 28 semanas', sentido: 'minimo', unidade: 'pct', valor: (b) => ({ v: b.tempos.diag_antes_28s_pct, base: b.tempos.diag_com_ig }) },
  { chave: 'perda_seguimento_pct', nome: 'Perda de seguimento', sentido: 'maximo', unidade: 'pct', valor: (b) => ({ v: b.funil.perda_seguimento_pct, base: b.funil.diagnosticadas }) },
  { chave: 'perfil_completo_pct', nome: 'Perfil glicêmico completo', sentido: 'minimo', unidade: 'pct', valor: (b) => ({ v: b.adesao.perfil_completo_pct, base: b.adesao.diagnosticadas }) },
  { chave: 'ultimo_na_meta_pct', nome: 'Último perfil com glicemia controlada', sentido: 'minimo', unidade: 'pct', valor: (b) => ({ v: b.adesao.ultimo_na_meta_pct, base: b.adesao.com_perfil }) },
  { chave: 'gj_gtt_mediana_dias', nome: 'Glicemia de jejum até a curva glicêmica', sentido: 'maximo', unidade: 'dias', valor: (b) => ({ v: b.tempos.gj_gtt_mediana_dias, base: b.tempos.gj_gtt_n }) },
];

function avaliar(b: BlocoLinhaCuidado, chave: string, metas: Record<string, number | string> | undefined) {
  const cfg = METAS.find((m) => m.chave === chave)!;
  const meta = metas?.[chave] == null ? null : Number(metas[chave]);
  if (meta == null || Number.isNaN(meta)) return null;
  const { v, base } = cfg.valor(b);
  const metaTxt = `Meta: ${cfg.sentido === 'minimo' ? 'mínimo' : 'máximo'} ${cfg.unidade === 'pct' ? pct(meta) : dias(meta)}`;
  if (v == null || !base) return { texto: 'Sem dados no mês', tom: 'neutro' as Tom, meta: metaTxt, situacao: 'sem_dados' };
  if (base < BASE_MINIMA_META) return { texto: 'Poucos dados', tom: 'neutro' as Tom, meta: metaTxt, situacao: 'poucos' };
  const ok = cfg.sentido === 'minimo' ? Number(v) >= meta : Number(v) <= meta;
  return ok
    ? { texto: 'Meta atingida', tom: 'bom' as Tom, meta: metaTxt, situacao: 'ok' }
    : { texto: cfg.sentido === 'minimo' ? 'Abaixo da meta' : 'Acima do limite', tom: 'alerta' as Tom, meta: metaTxt, situacao: 'nao' };
}

// ── peças visuais ─────────────────────────────────────────────────────────────
interface ItemKpi {
  rotulo: string;
  valor: string;
  detalhe?: string;
  variacao?: { texto: string; tom: Tom } | null;
  selo?: { texto: string; tom: Tom; meta: string } | null;
  destaque?: boolean;
}

function linhaDeKpis(d: Doc, itens: ItemKpi[], colunas = itens.length) {
  const w = (CW - GAP * (colunas - 1)) / colunas;
  const linhasRotulo = Math.max(...itens.map((it) => d.linhas(it.rotulo, 7.6, w - 20, true).length));
  const alturaDe = (it: ItemKpi) => {
    const detalhe = it.detalhe ? d.linhas(it.detalhe, 7, w - 20).length * 9.5 : 0;
    const pills = (it.variacao ? 15 : 0) + (it.selo ? 25 : 0);
    return 14 + linhasRotulo * 10 + 24 + detalhe + pills + 10;
  };
  const h = Math.max(...itens.map(alturaDe));
  d.garantir(h + GAP);
  itens.forEach((it, i) => {
    const x = M + i * (w + GAP);
    const top = d.y;
    d.caixa(x, top, w, h, { fundo: C.branco, borda: it.destaque ? C.lilas : C.borda, espessura: it.destaque ? 1.2 : 0.8, raio: 9 });
    if (it.destaque) d.caixa(x, top + 8, 3, h - 16, { fundo: C.lilas, raio: 1.5 });
    let y = top + 12;
    d.paragrafo(it.rotulo, x + 10, y, 7.6, w - 20, { bold: true, cor: C.muted, entre: 1.3 });
    y += linhasRotulo * 7.6 * 1.3;
    d.texto(it.valor, x + 10, y + 3, 19, { bold: true });
    y += 26;
    if (it.detalhe) y += d.paragrafo(it.detalhe, x + 10, y, 7, w - 20, { cor: C.muted, entre: 1.35 });
    y += 3;
    if (it.variacao) {
      d.pilula(it.variacao.texto, x + 10, y, it.variacao.tom);
      y += 15;
    }
    if (it.selo) {
      d.pilula(it.selo.texto, x + 10, y, it.selo.tom);
      d.texto(it.selo.meta, x + 10, y + 15, 6.6, { cor: C.muted });
    }
  });
  d.y += h + GAP;
}

function secao(d: Doc, numero: number, titulo: string, descricao?: string, reserva = 90) {
  const desc = descricao ? d.linhas(descricao, 8, CW - 30) : [];
  const h = 26 + desc.length * 11;
  d.garantir(h + reserva);
  d.y += 8;
  d.caixa(M, d.y, 20, 20, { fundo: C.lilasMedio, raio: 10 });
  d.texto(String(numero), M + 10 - d.largura(String(numero), 10, true) / 2, d.y + 5, 10, { bold: true, cor: C.roxo });
  d.texto(titulo, M + 28, d.y + 3, 14, { bold: true });
  desc.forEach((l, i) => d.texto(l, M + 28, d.y + 22 + i * 11, 8, { cor: C.muted }));
  d.y += h;
}

function linhaBarra(d: Doc, x: number, top: number, w: number, rotulo: string, valor: string, p: number, cor: RGB, largRotulo = 150) {
  d.texto(rotulo, x, top + 1, 8.2, { cor: C.corpo });
  const bx = x + largRotulo;
  const bw = w - largRotulo - 70;
  d.caixa(bx, top + 1, bw, 9, { fundo: C.lilasClaro, raio: 4.5 });
  const fill = Math.max(0, Math.min(100, p)) / 100 * bw;
  if (fill > 0) d.caixa(bx, top + 1, Math.max(fill, 5), 9, { fundo: cor, raio: 4.5 });
  d.texto(valor, x + w, top + 1, 8.2, { bold: true, alinhar: 'dir' });
}

// ── o relatório ───────────────────────────────────────────────────────────────
export async function gerarPdfRelatorio(params: {
  metricas: MetricasUnidade;
  periodoInicio: string;
  periodoFim: string;
  rotuloMes: string;
  /** Métricas do mês anterior (para a comparação). */
  anterior?: MetricasUnidade | null;
  /** Linha de cuidado, tendência e metas (_relatorio_mensal_dados). */
  extras?: DadosExtrasRelatorio | null;
}): Promise<Uint8Array> {
  const { metricas: m, periodoInicio, periodoFim, anterior: a, extras } = params;
  const pdf = await PDFDocument.create();
  pdf.setTitle(textoPdf(`Relatório mensal — ${m.unidade_nome} — ${nomeMes(periodoInicio)}`));
  pdf.setAuthor('MARI · Inteligência Clínica');
  const r = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);

  const mes = capitalizar(nomeMes(periodoInicio));
  const [ano, mesNum] = periodoInicio.split('-').map(Number);
  const mesAntIso = `${mesNum === 1 ? ano - 1 : ano}-${String(mesNum === 1 ? 12 : mesNum - 1).padStart(2, '0')}-01`;
  const mesAnt = MESES_CURTOS[Number(mesAntIso.slice(5, 7)) - 1];
  const rede = extras?.rede_nome ?? null;
  const geradoEm = new Date();
  const lc = extras?.atual ?? null;
  const lcAnt = extras?.anterior ?? null;
  const metas = extras?.metas ?? {};
  const temMetas = lc != null && METAS.some((x) => metas[x.chave] != null);

  const d = new Doc(pdf, r, b, (doc, primeira) => {
    const p = doc.page;
    if (primeira) {
      p.drawRectangle({ x: 0, y: H - 128, width: W, height: 128, color: C.roxo });
      p.drawEllipse({ x: W - 40, y: H - 20, xScale: 190, yScale: 150, color: C.lilas, opacity: 0.55 });
      p.drawEllipse({ x: W + 30, y: H - 120, xScale: 120, yScale: 90, color: C.lilas, opacity: 0.35 });
      p.drawRectangle({ x: 0, y: H - 128 - 220, width: W, height: 220, color: C.branco });
      doc.caixa(M, 22, 30, 30, { fundo: C.branco, raio: 8, opacidade: 0.2 });
      doc.texto('MARI', M + 15 - doc.largura('MARI', 8.5, true) / 2, 33, 8.5, { bold: true, cor: C.branco });
      doc.texto('MARI · Inteligência Clínica', M + 40, 24, 10.5, { bold: true, cor: C.branco });
      doc.texto('Relatório mensal da unidade', M + 40, 38, 8.5, { cor: C.branco, opacidade: 0.9 });
      doc.texto(mes, W - M, 24, 12, { bold: true, cor: C.branco, alinhar: 'dir' });
      doc.texto(`Gerado automaticamente em ${geradoEm.toLocaleDateString('pt-BR')}`, W - M, 40, 7.5, { cor: C.branco, alinhar: 'dir', opacidade: 0.9 });
      doc.texto(m.unidade_nome, M, 70, 22, { bold: true, cor: C.branco });
      doc.texto(`${rede ? `${rede} · ` : ''}Período: ${dataBr(periodoInicio)} a ${dataBr(periodoFim)}`, M, 100, 9, { cor: C.branco, opacidade: 0.95 });
      doc.y = 146;
    } else {
      p.drawRectangle({ x: 0, y: H - 40, width: W, height: 40, color: C.roxo });
      p.drawEllipse({ x: W - 30, y: H - 10, xScale: 140, yScale: 60, color: C.lilas, opacity: 0.5 });
      p.drawRectangle({ x: 0, y: H - 40 - 80, width: W, height: 80, color: C.branco });
      doc.texto('MARI · Inteligência Clínica', M, 12, 9, { bold: true, cor: C.branco });
      doc.texto(`Relatório mensal · ${m.unidade_nome} · ${mes}`, M, 25, 7.5, { cor: C.branco, opacidade: 0.9 });
      doc.y = 58;
    }
  });
  d.novaPagina();

  // Resumo do mês
  const frases: string[] = [];
  frases.push(
    `Em ${nomeMes(periodoInicio)}, a unidade acompanhou ${num(m.total_gestantes)} ${plural(m.total_gestantes, 'gestante', 'gestantes')} ` +
      `(${num(m.gestantes_novas)} ${plural(m.gestantes_novas, 'nova', 'novas')}) e emitiu ${num(m.total_laudos)} ${plural(m.total_laudos, 'laudo', 'laudos')}.`,
  );
  const taxa = lc?.funil.taxa_diagnostico_pct ?? m.taxa_dmg_percent;
  const rastreadas = lc?.funil.rastreadas ?? m.gestantes_rastreadas;
  const diagnosticadas = lc?.funil.diagnosticadas ?? m.total_dmg_confirmado;
  frases.push(
    `${num(rastreadas)} ${plural(rastreadas, 'gestante foi rastreada', 'gestantes foram rastreadas')} e ${num(diagnosticadas)} ${plural(diagnosticadas, 'teve', 'tiveram')} diabetes confirmado: taxa de diagnóstico de ${pct(taxa)}` +
      (rastreadas > 0 ? (taxa < 7 ? ', abaixo da faixa esperada (7–18%).' : taxa > 18 ? ', acima da faixa esperada (7–18%).' : ', dentro da faixa esperada (7–18%).') : '.'),
  );
  if (lc && lc.funil.diagnosticadas > 0) {
    const nr = lc.funil.encerradas?.nao_retornou ?? 0;
    frases.push(
      nr > 0
        ? `${num(nr)} de ${num(lc.funil.diagnosticadas)} gestantes com diabetes pararam de vir (perda de seguimento de ${pct(lc.funil.perda_seguimento_pct)}).`
        : 'Nenhuma gestante com diabetes deixou de voltar (perda de seguimento de 0%).',
    );
    frases.push(`${num(lc.adesao.com_perfil_completo)} de ${num(lc.adesao.diagnosticadas)} entregaram o perfil glicêmico completo (${pct(lc.adesao.perfil_completo_pct)}).`);
  }
  if (m.encaminhadas_insulina || m.partos_registrados) {
    frases.push(`${num(m.encaminhadas_insulina ?? 0)} ${plural(m.encaminhadas_insulina ?? 0, 'gestante foi encaminhada', 'gestantes foram encaminhadas')} para insulina e ${num(m.partos_registrados)} ${plural(m.partos_registrados, 'parto foi registrado', 'partos foram registrados')} no mês.`);
  }
  if (temMetas && lc) {
    const av = METAS.map((x) => avaliar(lc, x.chave, metas)).filter(Boolean) as Array<{ situacao: string }>;
    const avaliadas = av.filter((x) => x.situacao === 'ok' || x.situacao === 'nao');
    const atingidas = av.filter((x) => x.situacao === 'ok').length;
    frases.push(
      avaliadas.length > 0
        ? `Metas da rede: ${atingidas} de ${avaliadas.length} ${plural(avaliadas.length, 'meta avaliada', 'metas avaliadas')} ${plural(atingidas, 'foi atingida', 'foram atingidas')}.`
        : 'Metas da rede: poucos dados no mês para avaliar.',
    );
  }
  if (m.total_gestantes === 0 && !m.partos_registrados && !m.encaminhadas_insulina) {
    frases.splice(0, frases.length, 'Nenhum atendimento registrado para esta unidade no mês.');
  }

  const linhasResumo = frases.map((f) => d.linhas(f, 8.6, CW - 40));
  const hResumo = 30 + linhasResumo.reduce((s, l) => s + l.length * 12.5 + 3, 0) + 6;
  d.caixa(M, d.y, CW, hResumo, { fundo: C.fundo, borda: C.borda, raio: 10 });
  d.texto('Resumo do mês', M + 14, d.y + 12, 10.5, { bold: true, cor: C.roxo });
  let yr = d.y + 30;
  for (const ls of linhasResumo) {
    d.caixa(M + 15, yr + 3, 4, 4, { fundo: C.lilas, raio: 2 });
    ls.forEach((l, i) => d.texto(l, M + 26, yr + i * 12.5, 8.6, { cor: C.corpo }));
    yr += ls.length * 12.5 + 3;
  }
  d.y += hResumo + GAP;

  // 1. Visão geral
  let n = 0;
  secao(
    d,
    ++n,
    'Visão geral do mês',
    `Volume de atendimento da unidade em ${nomeMes(periodoInicio)}${a ? `, comparado com ${MESES[Number(mesAntIso.slice(5, 7)) - 1]}` : ''}.`,
  );
  const vc = (atual: number, ant: number | undefined, s: Sentido = 'neutro') => (a ? variacao(atual, ant, 'contagem', s, mesAnt) : null);
  linhaDeKpis(d, [
    { rotulo: 'Acompanhadas no mês', valor: num(m.total_gestantes), detalhe: 'Com consulta no mês', variacao: vc(m.total_gestantes, a?.total_gestantes) },
    { rotulo: 'Novas no mês', valor: num(m.gestantes_novas), detalhe: 'Cadastradas no mês', variacao: vc(m.gestantes_novas, a?.gestantes_novas) },
    { rotulo: 'Rastreadas', valor: num(m.gestantes_rastreadas), detalhe: 'Glicemia de jejum ou curva', variacao: vc(m.gestantes_rastreadas, a?.gestantes_rastreadas, 'bom_subir') },
    { rotulo: 'Profissionais que atenderam', valor: num(m.profissionais_ativos), variacao: vc(m.profissionais_ativos, a?.profissionais_ativos) },
    { rotulo: 'Laudos emitidos', valor: num(m.total_laudos), variacao: vc(m.total_laudos, a?.total_laudos) },
  ]);

  // 2. Diagnóstico
  secao(d, ++n, 'Diagnóstico de diabetes', 'Gestantes rastreadas no mês que tiveram diabetes confirmado (DMG ou diabetes prévio, o overt).', 140);
  {
    const hCard = 100;
    d.garantir(hCard + GAP);
    const wTaxa = CW * 0.56;
    const top = d.y;
    d.caixa(M, top, wTaxa, hCard, { fundo: C.branco, borda: C.lilas, espessura: 1.2, raio: 9 });
    d.caixa(M, top + 8, 3, hCard - 16, { fundo: C.lilas, raio: 1.5 });
    d.texto('Taxa de diagnóstico (DMG + diabetes prévio)', M + 12, top + 11, 7.6, { bold: true, cor: C.muted });
    const wv = d.texto(pct(taxa), M + 12, top + 24, 24, { bold: true });
    d.texto(`${num(diagnosticadas)} de ${num(rastreadas)} rastreadas`, M + 20 + wv, top + 33, 8.4, { cor: C.corpo });
    const tv = a ? variacao(taxa, a.taxa_dmg_percent, 'pct', 'neutro', mesAnt) : null;
    if (tv) d.pilula(tv.texto, M + 12, top + 54, tv.tom);
    // régua 0–30% com a faixa 7–18%
    const rx = M + 12;
    const rw = wTaxa - 24;
    const topo = Math.max(30, Math.ceil(((taxa ?? 0) + 5) / 5) * 5);
    const px = (v: number) => rx + (Math.max(0, Math.min(topo, v)) / topo) * rw;
    const ry = top + 72;
    d.caixa(rx, ry, rw, 7, { fundo: C.cinzaClaro, raio: 3.5 });
    d.caixa(px(7), ry, px(18) - px(7), 7, { fundo: C.verdeFaixa, raio: 3.5 });
    if (rastreadas > 0) d.caixa(px(taxa) - 1.5, ry - 3, 3, 13, { fundo: C.roxo, raio: 1.5 });
    d.texto('0%', rx, ry + 11, 6.5, { cor: C.muted });
    d.texto('7%', px(7) - 4, ry + 11, 6.5, { cor: C.muted });
    d.texto('18%', px(18) - 6, ry + 11, 6.5, { cor: C.muted });
    d.texto(`${topo}%`, rx + rw, ry + 11, 6.5, { cor: C.muted, alinhar: 'dir' });
    // cartões menores
    const wMini = (CW - wTaxa - GAP * 2) / 2;
    const mini = (x: number, y: number, rot: string, val: string, det: string) => {
      d.caixa(x, y, wMini, (hCard - GAP) / 2, { fundo: C.branco, borda: C.borda, raio: 9 });
      d.texto(rot, x + 10, y + 9, 7.4, { bold: true, cor: C.muted });
      d.texto(val, x + 10, y + 20, 15, { bold: true });
      d.texto(det, x + 10, y + 37, 6.6, { cor: C.muted });
    };
    const x2 = M + wTaxa + GAP;
    const x3 = x2 + wMini + GAP;
    const hm = (hCard - GAP) / 2;
    mini(x2, top, 'Pela glicemia de jejum', num(m.dmg_retorno1), 'Retorno 1');
    mini(x3, top, 'Pela curva glicêmica', num(m.dmg_gtt), 'GTT 75g');
    mini(x2, top + hm + GAP, 'Diabetes prévio (overt)', num(m.total_overt), 'Já incluído na taxa');
    mini(x3, top + hm + GAP, 'Antes de 28 semanas', pct(lc?.tempos.diag_antes_28s_pct), lc ? `${num(lc.tempos.diag_antes_28s)} de ${num(lc.tempos.diag_com_ig)} diagnósticos` : 'Sem dados');
    d.y += hCard + GAP;
  }

  // 3. Linha de cuidado (precisa da migration 20261015200000)
  if (lc) {
    secao(d, ++n, 'Linha de cuidado', 'Gestantes com diabetes confirmado no mês e o que aconteceu com elas até a data do relatório.');
    linhaDeKpis(d, [
      {
        rotulo: 'Perda de seguimento',
        valor: pct(lc.funil.perda_seguimento_pct),
        detalhe: `${num(lc.funil.encerradas?.nao_retornou ?? 0)} de ${num(lc.funil.diagnosticadas)} pararam de vir`,
        variacao: lcAnt ? variacao(lc.funil.perda_seguimento_pct, lcAnt.funil.perda_seguimento_pct, 'pct', 'ruim_subir', mesAnt) : null,
        selo: avaliar(lc, 'perda_seguimento_pct', metas),
        destaque: true,
      },
      {
        rotulo: 'Perfil glicêmico completo',
        valor: pct(lc.adesao.perfil_completo_pct),
        detalhe: `${num(lc.adesao.com_perfil_completo)} de ${num(lc.adesao.diagnosticadas)} com diabetes`,
        variacao: lcAnt ? variacao(lc.adesao.perfil_completo_pct, lcAnt.adesao.perfil_completo_pct, 'pct', 'bom_subir', mesAnt) : null,
        selo: avaliar(lc, 'perfil_completo_pct', metas),
      },
      {
        rotulo: 'Último perfil dentro do alvo',
        valor: pct(lc.adesao.ultimo_na_meta_pct),
        detalhe: `${num(lc.adesao.ultimo_na_meta)} de ${num(lc.adesao.com_perfil)} que entregaram`,
        variacao: lcAnt ? variacao(lc.adesao.ultimo_na_meta_pct, lcAnt.adesao.ultimo_na_meta_pct, 'pct', 'bom_subir', mesAnt) : null,
        selo: avaliar(lc, 'ultimo_na_meta_pct', metas),
      },
      {
        rotulo: 'Jejum até a curva glicêmica',
        valor: dias(lc.tempos.gj_gtt_mediana_dias),
        detalhe: `Mediana · base: ${num(lc.tempos.gj_gtt_n)} ${plural(lc.tempos.gj_gtt_n, 'gestante', 'gestantes')}`,
        variacao: lcAnt ? variacao(lc.tempos.gj_gtt_mediana_dias, lcAnt.tempos.gj_gtt_mediana_dias, 'dias', 'ruim_subir', mesAnt) : null,
        selo: avaliar(lc, 'gj_gtt_mediana_dias', metas),
      },
    ]);

    // Desfechos + tempos lado a lado
    const desfechos: Array<[string, number, RGB]> = [
      ['Em acompanhamento', lc.funil.em_acompanhamento, C.lilas],
      ['Encaminhada para insulina', lc.funil.encerradas?.insulinizacao ?? 0, C.roxo],
      ['Parto', lc.funil.encerradas?.parto ?? 0, C.roxo],
      ['Aborto', lc.funil.encerradas?.aborto ?? 0, C.roxo],
      ['Não retornou', lc.funil.encerradas?.nao_retornou ?? 0, C.vermelhoBarra],
      ['Outro motivo', lc.funil.encerradas?.outro ?? 0, C.roxo],
    ];
    const hBox = 40 + desfechos.length * 15 + 6;
    d.garantir(hBox + GAP);
    const wE = CW * 0.56;
    const wD = CW - wE - GAP;
    const top = d.y;
    d.caixa(M, top, wE, hBox, { fundo: C.branco, borda: C.borda, raio: 9 });
    d.texto('Situação hoje das gestantes com diabetes do mês', M + 12, top + 11, 9.5, { bold: true });
    d.texto(`${num(lc.funil.diagnosticadas)} ${plural(lc.funil.diagnosticadas, 'gestante', 'gestantes')} com diabetes confirmado no mês.`, M + 12, top + 24, 7.2, { cor: C.muted });
    const base = Math.max(lc.funil.diagnosticadas, 1);
    desfechos.forEach(([rot, v, cor], i) =>
      linhaBarra(d, M + 12, top + 40 + i * 15, wE - 24, rot, lc.funil.diagnosticadas > 0 ? `${num(v)} · ${pct((v / base) * 100)}` : num(v), (v / base) * 100, cor, 118),
    );
    const xD = M + wE + GAP;
    d.caixa(xD, top, wD, hBox, { fundo: C.branco, borda: C.borda, raio: 9 });
    d.texto('Tempos da linha de cuidado', xD + 12, top + 11, 9.5, { bold: true });
    d.texto('Medianas, em dias.', xD + 12, top + 24, 7.2, { cor: C.muted });
    const tempos: Array<[string, number | null, number]> = [
      ['Diagnóstico até o 1º perfil', lc.tempos.diag_perfil_mediana_dias, lc.tempos.diag_perfil_n],
      ['Diagnóstico até a insulina', lc.tempos.diag_insulina_mediana_dias, lc.tempos.diag_insulina_n],
      ['Jejum até a curva glicêmica', lc.tempos.gj_gtt_mediana_dias, lc.tempos.gj_gtt_n],
    ];
    tempos.forEach(([rot, v, nBase], i) => {
      const ty = top + 42 + i * 26;
      d.texto(rot, xD + 12, ty, 8.2, { cor: C.corpo });
      d.texto(`base: ${num(nBase)}`, xD + 12, ty + 11, 6.6, { cor: C.muted });
      d.texto(dias(v), xD + wD - 12, ty + 1, 12, { bold: true, alinhar: 'dir' });
    });
    d.y += hBox + GAP;
  }

  // 4. Controle e desfechos do mês
  secao(d, ++n, 'Controle glicêmico e desfechos', 'O que aconteceu no mês com as gestantes acompanhadas.');
  linhaDeKpis(d, [
    { rotulo: 'Controle adequado', valor: num(m.controle_adequado_sem_insulina), detalhe: 'Último perfil com 70% ou mais das medidas no alvo', variacao: vc(m.controle_adequado_sem_insulina, a?.controle_adequado_sem_insulina, 'bom_subir') },
    { rotulo: 'Encaminhadas para insulina', valor: num(m.encaminhadas_insulina ?? 0), detalhe: 'Seguem no serviço que cuida da insulina', variacao: vc(m.encaminhadas_insulina ?? 0, a?.encaminhadas_insulina) },
    { rotulo: 'Partos no mês', valor: num(m.partos_registrados), detalhe: 'Acompanhamentos encerrados por parto', variacao: vc(m.partos_registrados, a?.partos_registrados) },
  ]);

  // 5. Últimos 6 meses
  const tend = extras?.tendencia ?? [];
  if (tend.length > 0) {
    secao(d, ++n, 'Últimos 6 meses', 'Gestantes rastreadas e com diabetes confirmado, mês a mês, e a taxa de diagnóstico.', 170);
    const hG = 160;
    d.garantir(hG + GAP);
    const top = d.y;
    d.caixa(M, top, CW, hG, { fundo: C.branco, borda: C.borda, raio: 9 });
    const max = Math.max(1, ...tend.map((t) => t.rastreadas));
    const areaTop = top + 30;
    const areaH = hG - 62;
    const colW = (CW - 40) / tend.length;
    // legenda
    d.caixa(M + 12, top + 12, 8, 8, { fundo: C.lilasMedio, raio: 2 });
    d.texto('Rastreadas', M + 24, top + 12, 7.4, { cor: C.corpo });
    d.caixa(M + 82, top + 12, 8, 8, { fundo: C.roxo, raio: 2 });
    d.texto('Diabetes confirmado', M + 94, top + 12, 7.4, { cor: C.corpo });
    tend.forEach((t, i) => {
      const cx = M + 20 + i * colW + colW / 2;
      const bw = Math.min(26, colW * 0.32);
      const hR = (t.rastreadas / max) * areaH;
      const hD = (t.diagnosticadas / max) * areaH;
      const base = areaTop + areaH;
      if (hR > 0) d.caixa(cx - bw - 2, base - hR, bw, hR, { fundo: C.lilasMedio, raio: 3 });
      if (hD > 0) d.caixa(cx + 2, base - hD, bw, Math.max(hD, 2), { fundo: C.roxo, raio: 3 });
      d.texto(num(t.rastreadas), cx - bw / 2 - 2 - d.largura(num(t.rastreadas), 6.8) / 2, base - hR - 10, 6.8, { cor: C.muted });
      d.texto(num(t.diagnosticadas), cx + 2 + bw / 2 - d.largura(num(t.diagnosticadas), 6.8) / 2, base - hD - 10, 6.8, { bold: true, cor: C.roxo });
      const rot = nomeMes(`${t.mes}-01`, true);
      d.texto(rot, cx - d.largura(rot, 7.4, true) / 2, base + 6, 7.4, { bold: true, cor: t.mes === periodoInicio.slice(0, 7) ? C.roxo : C.corpo });
      const tx = t.rastreadas > 0 ? `taxa ${pct(t.taxa)}` : 'sem rastreio';
      d.texto(tx, cx - d.largura(tx, 6.6) / 2, base + 17, 6.6, { cor: C.muted });
    });
    d.page.drawLine({ start: { x: M + 14, y: H - (areaTop + areaH) }, end: { x: M + CW - 14, y: H - (areaTop + areaH) }, thickness: 0.6, color: C.borda });
    d.y += hG + GAP;
  }

  // 6. Metas da rede
  if (temMetas && lc) {
    secao(d, ++n, 'Metas da rede', 'Metas definidas pela gestão da rede. Com menos de 5 gestantes na conta, o indicador fica como "poucos dados".');
    const linhas = METAS.filter((x) => metas[x.chave] != null);
    const hT = 22 + linhas.length * 20 + 4;
    d.garantir(hT + GAP);
    const top = d.y;
    d.caixa(M, top, CW, hT, { fundo: C.branco, borda: C.borda, raio: 9 });
    d.caixa(M, top, CW, 20, { fundo: C.lilasMedio, raio: 9 });
    d.page.drawRectangle({ x: M, y: H - (top + 20), width: CW, height: 8, color: C.lilasMedio });
    const cols = [M + 12, M + CW * 0.52, M + CW * 0.68, M + CW * 0.8];
    ['Indicador', 'Meta', 'Resultado', 'Situação'].forEach((t, i) => d.texto(t, cols[i], top + 6, 7.8, { bold: true }));
    linhas.forEach((cfg, i) => {
      const ry = top + 22 + i * 20;
      if (i % 2 === 1) d.page.drawRectangle({ x: M + 1, y: H - (ry + 20), width: CW - 2, height: 20, color: C.fundo });
      const r0 = avaliar(lc, cfg.chave, metas)!;
      const { v } = cfg.valor(lc);
      d.texto(cfg.nome, cols[0], ry + 6, 8.2, { cor: C.corpo });
      d.texto(`${cfg.sentido === 'minimo' ? 'mín.' : 'máx.'} ${cfg.unidade === 'pct' ? pct(Number(metas[cfg.chave])) : dias(Number(metas[cfg.chave]))}`, cols[1], ry + 6, 8.2, { cor: C.corpo });
      d.texto(cfg.unidade === 'pct' ? pct(v) : dias(v), cols[2], ry + 6, 8.2, { bold: true });
      d.pilula(r0.texto, cols[3], ry + 4, r0.tom);
    });
    d.y += hT + GAP;
  }

  // 7. Como ler
  const notas = [
    'Taxa de diagnóstico: gestantes com diabetes confirmado (DMG ou diabetes prévio, o overt) entre as rastreadas no mês. Faixa esperada para a população geral: 7% a 18% (Febrasgo).',
    'Rastreadas: gestantes com glicemia de jejum (Retorno 1) ou curva glicêmica (GTT 75g) no mês.',
    'Perda de seguimento: gestantes com diabetes do mês cujo acompanhamento foi encerrado como "não retornou".',
    'Perfil completo: pelo menos 7 dias com medições de glicose em casa. Dentro do alvo: 70% ou mais das medições no alvo glicêmico. Critérios provisórios, a validar pelas médicas.',
    'Encaminhadas para insulina: a indicação de insulina encerra o acompanhamento pela MARI; a gestante segue no serviço que cuida da insulina.',
  ];
  const ls = notas.map((t) => d.linhas(t, 7.6, CW - 40));
  const hN = 28 + ls.reduce((s, l) => s + l.length * 10.5 + 3, 0) + 4;
  secao(d, ++n, 'Como ler este relatório', undefined, hN);
  d.garantir(hN);
  d.caixa(M, d.y, CW, hN, { fundo: C.fundo, borda: C.borda, raio: 9 });
  let yn = d.y + 14;
  for (const l of ls) {
    d.caixa(M + 14, yn + 3, 3.5, 3.5, { fundo: C.lilas, raio: 1.75 });
    l.forEach((t, i) => d.texto(t, M + 24, yn + i * 10.5, 7.6, { cor: C.corpo }));
    yn += l.length * 10.5 + 3;
  }
  d.y += hN;

  // Rodapé em todas as páginas
  const total = d.pages.length;
  d.pages.forEach((p, i) => {
    d.page = p;
    p.drawLine({ start: { x: M, y: 30 }, end: { x: W - M, y: 30 }, thickness: 0.6, color: C.borda });
    d.texto(`MARI · Relatório mensal gerado automaticamente — ${m.unidade_nome} · ${mes}`, M, H - 24, 7, { cor: C.muted });
    d.texto(`Página ${i + 1} de ${total}`, W - M, H - 24, 7, { cor: C.muted, alinhar: 'dir' });
  });

  return await pdf.save();
}
