// Resumo semanal por e-mail (gestor de unidade e gestor geral) — montagem do
// conteúdo a partir dos números. Módulo PURO (sem Deno, sem banco): usado pela
// edge function enviar-resumo-semanal e testado em src/lib/resumoSemanal.test.ts.
//
// Os números vêm de resumo_semanal_destinatarios (SQL): as pendências são as
// mesmas do painel (get_painel_gargalos) contadas na hora do envio; laudos e
// gestantes novas são da semana anterior (segunda a domingo, Brasília).
//
// Regra de envio: manda se há pendência OU se houve atividade na semana
// (laudo emitido ou gestante nova). Sem pendência e sem atividade não há o que
// contar — o e-mail só ensinaria a pessoa a ignorá-lo. Com zero pendência e
// alguma atividade, o e-mail sai com "Tudo em dia".

export interface NumerosUnidade {
  unidade_id: string;
  nome: string;
  /** Nome da rede (contratante) — só no e-mail do gestor geral. */
  rede?: string | null;
  sem_gj_primeira_consulta: number;
  atrasadas_gtt: number;
  confirmadas_sem_retorno: number;
  laudos_semana: number;
  novas_gestantes_semana: number;
}

export interface EmailMontado {
  subject: string;
  html: string;
  text: string;
}

export interface LinksEmail {
  /** Abre o painel no app. */
  painel: string;
  /** Tela de Configurações (onde se desliga o resumo). */
  configuracoes: string;
}

const FUSO = 'America/Sao_Paulo';

// ------------------------------------------------------------------ datas

/** Data (AAAA-MM-DD) e dia da semana (0 = domingo) em Brasília. */
function dataBrasilia(agora: Date): { iso: string; diaSemana: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(agora);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { iso: `${p('year')}-${p('month')}-${p('day')}`, diaSemana: dias.indexOf(p('weekday')) };
}

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira (AAAA-MM-DD, Brasília) da semana em que `agora` cai. */
export function semanaDoEnvio(agora: Date): string {
  const { iso, diaSemana } = dataBrasilia(agora);
  const voltar = (diaSemana + 6) % 7; // segunda → 0, domingo → 6
  return somarDias(iso, -voltar);
}

/** true se a data AAAA-MM-DD é uma segunda-feira. */
export function ehSegunda(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso && d.getUTCDay() === 1;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "06/10 a 12/10" — a semana anterior à segunda `semana`. */
export function rotuloSemanaAnterior(semana: string): string {
  return `${ddmm(somarDias(semana, -7))} a ${ddmm(somarDias(semana, -1))}`;
}

// ------------------------------------------------------------------ regras

export function totalPendencias(n: NumerosUnidade): number {
  return (n.sem_gj_primeira_consulta || 0) + (n.atrasadas_gtt || 0) + (n.confirmadas_sem_retorno || 0);
}

export function teveAtividade(n: NumerosUnidade): boolean {
  return (n.laudos_semana || 0) + (n.novas_gestantes_semana || 0) > 0;
}

/** Há algo a contar para esta unidade? (pendência hoje ou atividade na semana) */
export function temAlgoARelatar(n: NumerosUnidade): boolean {
  return totalPendencias(n) > 0 || teveAtividade(n);
}

export function deveEnviarGestorGeral(unidades: NumerosUnidade[]): boolean {
  return unidades.some(temAlgoARelatar);
}

/** Contas da rede de demonstração nunca recebem (defesa extra além do SQL). */
export function ehEmailDemo(email: string, dominioDemo: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${dominioDemo.toLowerCase()}`);
}

// ------------------------------------------------------------------ HTML

const COR = {
  marca: '#9b87f5',
  marcaEscura: '#7E69AB',
  titulo: '#1e293b',
  texto: '#475569',
  suave: '#64748B',
  rodape: '#94a3b8',
  card: '#F5F0FF',
  borda: '#E9E3FA',
  alerta: '#B45309',
  ok: '#15803d',
};
const FONTE = "'Plus Jakarta Sans', Arial, sans-serif"; // aspas simples: vai dentro de style="..."

export function escaparHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

const GARGALOS: Array<{ chave: keyof NumerosUnidade; titulo: string; explicacao: string }> = [
  {
    chave: 'sem_gj_primeira_consulta',
    titulo: 'Sem glicemia de jejum na 1ª consulta',
    explicacao: 'Já passaram pela 1ª consulta, mas o resultado da glicemia de jejum ainda não foi registrado.',
  },
  {
    chave: 'atrasadas_gtt',
    titulo: 'Atrasadas para o GTT',
    explicacao: 'Têm 28 semanas de gestação ou mais e ainda não têm o resultado do GTT (curva glicêmica) registrado.',
  },
  {
    chave: 'confirmadas_sem_retorno',
    titulo: 'Diagnosticadas sem retorno',
    explicacao: 'Têm diabetes confirmado na gestação e nenhum atendimento registrado nos últimos 14 dias.',
  },
];

function documento(titulo: string, preview: string, corpo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escaparHtml(titulo)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;">${escaparHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${FONTE};color:${COR.texto};">
<tr><td style="padding:0 16px 20px;font-size:14px;font-weight:bold;letter-spacing:2px;color:${COR.marca};">MARI</td></tr>
${corpo}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function linhaTitulo(texto: string): string {
  return `<tr><td style="padding:0 16px 16px;font-family:Sora, ${FONTE};font-size:22px;font-weight:bold;color:${COR.titulo};">${escaparHtml(texto)}</td></tr>`;
}

function linhaTexto(html: string): string {
  return `<tr><td style="padding:0 16px 16px;font-size:14px;line-height:1.6;color:${COR.texto};">${html}</td></tr>`;
}

function rotuloSecao(texto: string): string {
  return `<div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${COR.marcaEscura};margin:0 0 8px;">${escaparHtml(texto)}</div>`;
}

function botao(link: string, texto: string): string {
  return `<tr><td style="padding:8px 16px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:${COR.marca};border-radius:12px;">
<a href="${escaparHtml(link)}" style="display:inline-block;padding:12px 24px;font-family:${FONTE};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${escaparHtml(texto)}</a>
</td></tr></table>
</td></tr>`;
}

function rodape(linkConfiguracoes: string, papel: string): string {
  return `<tr><td style="padding:16px 16px 0;border-top:1px solid ${COR.borda};font-size:12px;line-height:1.6;color:${COR.rodape};">
Você recebe este e-mail toda segunda-feira porque é ${papel} na MARI. Os nomes das gestantes não vão por e-mail — ficam só no painel.<br>
Não quer mais receber? <a href="${escaparHtml(linkConfiguracoes)}" style="color:${COR.marcaEscura};">Desligue o resumo semanal em Configurações</a>.
</td></tr>`;
}

// ------------------------------------------------------------------ gestor de unidade

export interface DadosEmailGestor {
  nome: string | null;
  unidade: NumerosUnidade;
  /** Segunda-feira do envio (AAAA-MM-DD). */
  semana: string;
  links: LinksEmail;
}

export function montarEmailGestor(d: DadosEmailGestor): EmailMontado {
  const u = d.unidade;
  const total = totalPendencias(u);
  const periodo = rotuloSemanaAnterior(d.semana);
  const subject = `Resumo da semana — ${u.nome}`;
  const saudacao = d.nome?.trim() ? `Olá, ${escaparHtml(d.nome.trim())}.` : 'Olá.';

  const pendenciasHtml = total === 0
    ? `<div style="font-size:15px;font-weight:bold;color:${COR.ok};">Tudo em dia: nenhuma gestante com pendência hoje.</div>`
    : `<div style="font-size:15px;font-weight:bold;color:${COR.alerta};margin:0 0 8px;">${plural(total, 'pendência', 'pendências')} para resolver hoje</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${GARGALOS.map((g) => {
    const n = Number(u[g.chave]) || 0;
    return `<tr>
<td valign="top" style="padding:8px 0;border-top:1px solid ${COR.borda};font-size:14px;color:${COR.titulo};">
<strong>${escaparHtml(g.titulo)}</strong><br><span style="font-size:12px;color:${COR.suave};">${escaparHtml(g.explicacao)}</span>
</td>
<td valign="top" align="right" style="padding:8px 0 8px 12px;border-top:1px solid ${COR.borda};font-size:20px;font-weight:bold;color:${n > 0 ? COR.alerta : COR.suave};white-space:nowrap;">${n}</td>
</tr>`;
  }).join('\n')}
</table>`;

  const corpo = [
    linhaTitulo(subject),
    linhaTexto(`${saudacao} Este é o resumo automático de <strong>${escaparHtml(u.nome)}</strong> para começar a semana.`),
    `<tr><td style="padding:0 16px 16px;"><div style="background:${COR.card};border-radius:12px;padding:16px 20px;">
${rotuloSecao('Pendências de hoje')}
${pendenciasHtml}
</div></td></tr>`,
    `<tr><td style="padding:0 16px 16px;"><div style="background:${COR.card};border-radius:12px;padding:16px 20px;">
${rotuloSecao(`Semana passada (${periodo})`)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 0;font-size:14px;color:${COR.titulo};">Laudos emitidos</td><td align="right" style="padding:4px 0;font-size:16px;font-weight:bold;color:${COR.titulo};">${u.laudos_semana || 0}</td></tr>
<tr><td style="padding:4px 0;font-size:14px;color:${COR.titulo};">Gestantes novas cadastradas</td><td align="right" style="padding:4px 0;font-size:16px;font-weight:bold;color:${COR.titulo};">${u.novas_gestantes_semana || 0}</td></tr>
</table>
</div></td></tr>`,
    linhaTexto(`<span style="font-size:12px;color:${COR.suave};">As pendências são as mesmas do painel da MARI, contadas na manhã de hoje. No painel você vê quem são as gestantes e pode agir.</span>`),
    botao(d.links.painel, 'Abrir o painel'),
    rodape(d.links.configuracoes, 'gestor(a) de unidade'),
  ].join('\n');

  const linhasPend = total === 0
    ? ['Tudo em dia: nenhuma gestante com pendência hoje.']
    : [
      `${plural(total, 'pendência', 'pendências')} para resolver hoje:`,
      ...GARGALOS.map((g) => `- ${g.titulo}: ${Number(u[g.chave]) || 0}`),
    ];
  const text = [
    subject,
    '',
    `${d.nome?.trim() ? `Olá, ${d.nome.trim()}.` : 'Olá.'} Este é o resumo automático de ${u.nome} para começar a semana.`,
    '',
    'PENDÊNCIAS DE HOJE',
    ...linhasPend,
    '',
    `SEMANA PASSADA (${periodo})`,
    `- Laudos emitidos: ${u.laudos_semana || 0}`,
    `- Gestantes novas cadastradas: ${u.novas_gestantes_semana || 0}`,
    '',
    `Abrir o painel: ${d.links.painel}`,
    '',
    `Para parar de receber, desligue o resumo semanal em Configurações: ${d.links.configuracoes}`,
  ].join('\n');

  return { subject, html: documento(subject, linhasPend[0], corpo), text };
}

// ------------------------------------------------------------------ gestor geral

export interface DadosEmailGestorGeral {
  nome: string | null;
  unidades: NumerosUnidade[];
  semana: string;
  links: LinksEmail;
}

export function montarEmailGestorGeral(d: DadosEmailGestorGeral): EmailMontado {
  const redes = [...new Set(d.unidades.map((u) => u.rede?.trim()).filter((r): r is string => !!r))];
  const variasRedes = redes.length > 1;
  const subject = redes.length === 1 ? `Resumo da semana — ${redes[0]}` : 'Resumo da semana — suas unidades';
  const periodo = rotuloSemanaAnterior(d.semana);
  const tot = d.unidades.reduce(
    (a, u) => ({
      pend: a.pend + totalPendencias(u),
      laudos: a.laudos + (u.laudos_semana || 0),
      novas: a.novas + (u.novas_gestantes_semana || 0),
    }),
    { pend: 0, laudos: 0, novas: 0 },
  );
  const saudacao = d.nome?.trim() ? `Olá, ${escaparHtml(d.nome.trim())}.` : 'Olá.';

  const th = (t: string, align = 'right') =>
    `<td align="${align}" style="padding:8px 6px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;color:${COR.marcaEscura};border-bottom:2px solid ${COR.borda};">${t}</td>`;
  const td = (v: string | number, opts: { align?: string; cor?: string; negrito?: boolean } = {}) =>
    `<td align="${opts.align ?? 'right'}" style="padding:8px 6px;font-size:14px;color:${opts.cor ?? COR.titulo};border-bottom:1px solid ${COR.borda};${opts.negrito ? 'font-weight:bold;' : ''}">${v}</td>`;

  const linhas: string[] = [];
  let redeAtual: string | null | undefined;
  for (const u of d.unidades) {
    if (variasRedes && u.rede !== redeAtual) {
      redeAtual = u.rede;
      linhas.push(`<tr><td colspan="4" style="padding:12px 6px 4px;font-size:12px;font-weight:bold;color:${COR.suave};">${escaparHtml(u.rede ?? '')}</td></tr>`);
    }
    const p = totalPendencias(u);
    linhas.push(`<tr>${td(escaparHtml(u.nome), { align: 'left' })}${td(p, { cor: p > 0 ? COR.alerta : COR.suave, negrito: p > 0 })}${td(u.laudos_semana || 0)}${td(u.novas_gestantes_semana || 0)}</tr>`);
  }
  linhas.push(`<tr>${td('Total', { align: 'left', negrito: true })}${td(tot.pend, { negrito: true, cor: tot.pend > 0 ? COR.alerta : COR.titulo })}${td(tot.laudos, { negrito: true })}${td(tot.novas, { negrito: true })}</tr>`);

  const resumoPend = tot.pend === 0
    ? 'Tudo em dia: nenhuma gestante com pendência hoje nas suas unidades.'
    : `${plural(tot.pend, 'pendência', 'pendências')} para resolver hoje nas suas unidades.`;

  const corpo = [
    linhaTitulo(subject),
    linhaTexto(`${saudacao} Este é o resumo automático das ${plural(d.unidades.length, 'unidade', 'unidades')} que você acompanha, para começar a semana.`),
    linhaTexto(`<strong style="color:${tot.pend > 0 ? COR.alerta : COR.ok};">${escaparHtml(resumoPend)}</strong>`),
    `<tr><td style="padding:0 16px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONTE};">
<tr>${th('Unidade', 'left')}${th('Pendências hoje')}${th('Laudos')}${th('Novas')}</tr>
${linhas.join('\n')}
</table>
</td></tr>`,
    linhaTexto(`<span style="font-size:12px;color:${COR.suave};"><strong>Pendências hoje</strong> soma os 3 pontos de atenção do painel, contados na manhã de hoje: gestantes sem glicemia de jejum na 1ª consulta, atrasadas para o GTT (28 semanas ou mais sem o resultado) e com diabetes confirmado sem atendimento nos últimos 14 dias. <strong>Laudos</strong> e <strong>Novas</strong> (gestantes cadastradas) são da semana passada (${periodo}).</span>`),
    botao(d.links.painel, 'Abrir o painel'),
    rodape(d.links.configuracoes, 'gestor(a) geral'),
  ].join('\n');

  const text = [
    subject,
    '',
    `${d.nome?.trim() ? `Olá, ${d.nome.trim()}.` : 'Olá.'} Este é o resumo automático das ${plural(d.unidades.length, 'unidade', 'unidades')} que você acompanha.`,
    '',
    resumoPend,
    '',
    `Unidade — pendências hoje / laudos e gestantes novas na semana passada (${periodo})`,
    ...d.unidades.map((u) =>
      `- ${variasRedes && u.rede ? `${u.rede} · ` : ''}${u.nome}: ${totalPendencias(u)} pendência(s) / ${u.laudos_semana || 0} laudo(s) / ${u.novas_gestantes_semana || 0} nova(s)`),
    `- Total: ${tot.pend} pendência(s) / ${tot.laudos} laudo(s) / ${tot.novas} nova(s)`,
    '',
    'Pendências = sem glicemia de jejum na 1ª consulta + atrasadas para o GTT + diabetes confirmado sem atendimento há 14 dias.',
    '',
    `Abrir o painel: ${d.links.painel}`,
    '',
    `Para parar de receber, desligue o resumo semanal em Configurações: ${d.links.configuracoes}`,
  ].join('\n');

  return { subject, html: documento(subject, resumoPend, corpo), text };
}
