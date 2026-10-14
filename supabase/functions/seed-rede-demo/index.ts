// Edge function: seed-rede-demo
// Carga MANUAL da "Rede Demonstração MARI" (capturas de tela / apresentações).
//
// Isolamento: cria um contratante próprio (CNPJ fictício) com 5 unidades e
// contas próprias (@demo.mari.health). Só lê/escreve linhas ligadas a esse
// contratante. Não altera nenhuma regra, tela ou cálculo do sistema.
//
// Fidelidade clínica: cada consulta grava as MESMAS linhas que a ficha grava
// (consultas, exames_glicemia, perfis_glicemicos, valores_perfil,
// decisoes_ficha_a, exames_fetais, pacientes, registros_atendimento) com o
// desfecho calculado pelas regras do sistema (regras.ts). O laudo é gerado
// chamando a edge function gerar-laudo AUTENTICADA COMO a profissional — o
// texto vem de laudo_textos, como em produção. Nenhum texto de laudo é
// escrito por aqui; depois só se ajusta created_at para a data da consulta.
//
// Uso (POST, header x-seed-secret = secret SEED_SECRET), uma etapa por vez:
//   { "etapa": "estrutura" }                     contratante, gestores, unidades, equipes, convites
//   { "etapa": "gestantes", "unidade": "centro" } (centro | norte | sul | leste | oeste)
//   { "etapa": "relatorios" }                    relatórios mensais dos últimos 6 meses + refresh MV
// Cada etapa é idempotente (rodar de novo recria os dados daquela etapa).
// Limpeza total: seed-rede-demo-cleanup.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  CONTRATANTE,
  GESTOR_GERAL,
  SENHA_DEMO,
  UNIDADES,
  type UnidadeSpec,
} from '../_shared/redeDemo.ts';
import { addDias, planejarRede, type Evento, type PlanoPaciente } from './plano.ts';
import { PONTOS_4 } from './regras.ts';
import { agregarMetricas, gerarPdfRelatorio } from '../_shared/relatorioMensal.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-seed-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SEED_SECRET = Deno.env.get('SEED_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const DIAS_ESTRUTURA = 200; // rede "contratada" há ~6,5 meses
const MESES_RELATORIO = 6;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Data de hoje no fuso de Brasília (YYYY-MM-DD). */
function hojeBrt(): string {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}
/** Timestamp ISO em horário de Brasília. */
function ts(data: string, hora: number, minutos = 0): string {
  const h = hora + Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${data}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-03:00`;
}

function falhou(contexto: string, error: { message?: string } | null | undefined): never {
  throw new Error(`${contexto}: ${error?.message ?? 'erro desconhecido'}`);
}

// ── contas ──────────────────────────────────────────────────────────────────
async function encontrarUsuario(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) falhou('listUsers', error);
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function garantirUsuario(admin: SupabaseClient, email: string, nome: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: SENHA_DEMO, email_confirm: true, user_metadata: { nome, rede_demo: true },
  });
  if (data?.user) return data.user.id;
  const id = await encontrarUsuario(admin, email);
  if (!id) falhou(`criar usuário ${email}`, error);
  const { error: upErr } = await admin.auth.admin.updateUserById(id, {
    password: SENHA_DEMO, email_confirm: true, user_metadata: { nome, rede_demo: true },
  });
  if (upErr) falhou(`atualizar usuário ${email}`, upErr);
  return id;
}

// ── contexto da rede (ids já criados) ───────────────────────────────────────
async function carregarContratante(admin: SupabaseClient) {
  const { data, error } = await admin.from('contratantes').select('id').eq('cnpj', CONTRATANTE.cnpj).maybeSingle();
  if (error) falhou('ler contratante', error);
  return data?.id as string | undefined;
}

async function carregarUnidade(admin: SupabaseClient, contratanteId: string, u: UnidadeSpec) {
  const { data, error } = await admin.from('unidades').select('id')
    .eq('contratante_id', contratanteId).eq('nome', u.nome).maybeSingle();
  if (error) falhou(`ler ${u.nome}`, error);
  return data?.id as string | undefined;
}

// ── ETAPA 1: estrutura ──────────────────────────────────────────────────────
async function etapaEstrutura(admin: SupabaseClient, hoje: string) {
  const log: string[] = [];
  const inicioRede = addDias(hoje, -DIAS_ESTRUTURA);

  const { data: plano, error: planoErr } = await admin.from('planos').select('id').eq('slug', 'inicial').maybeSingle();
  if (planoErr || !plano) falhou("plano 'inicial'", planoErr ?? { message: 'não encontrado' });
  const { data: tipoUbs } = await admin.from('tipos_unidade').select('id').eq('slug', 'ubs').maybeSingle();

  // Contratante (organização) — chave: CNPJ fictício.
  let contratanteId = await carregarContratante(admin);
  const dadosContratante = {
    nome: CONTRATANTE.nome,
    cnpj: CONTRATANTE.cnpj,
    razao_social: CONTRATANTE.razao_social,
    contato_nome: CONTRATANTE.contato_nome,
    contato_email: CONTRATANTE.contato_email,
    status: 'ativo',
    data_inicio_contrato: inicioRede,
    data_termino_contrato: addDias(hoje, 365),
    observacoes: 'Organização FICTÍCIA para demonstração comercial. Pode ser apagada com seed-rede-demo-cleanup.',
  };
  if (contratanteId) {
    const { error } = await admin.from('contratantes').update(dadosContratante).eq('id', contratanteId);
    if (error) falhou('atualizar contratante', error);
  } else {
    const { data, error } = await admin.from('contratantes')
      .insert({ ...dadosContratante, created_at: ts(inicioRede, 9) }).select('id').single();
    if (error) falhou('criar contratante', error);
    contratanteId = data.id;
  }
  log.push(`✓ contratante ${CONTRATANTE.nome}`);

  // Gestor geral
  const ggUser = await garantirUsuario(admin, GESTOR_GERAL.email, GESTOR_GERAL.nome);
  let { data: gg } = await admin.from('gestores_gerais').select('id').eq('user_id', ggUser).maybeSingle();
  if (!gg) {
    const { data, error } = await admin.from('gestores_gerais')
      .insert({ user_id: ggUser, nome: GESTOR_GERAL.nome, created_at: ts(inicioRede, 10) }).select('id').single();
    if (error) falhou('criar gestor geral', error);
    gg = data;
  } else {
    await admin.from('gestores_gerais').update({ nome: GESTOR_GERAL.nome, acesso_revogado: false }).eq('id', gg.id);
  }
  await admin.from('gestores_gerais_contratantes')
    .upsert({ gestor_geral_id: gg!.id, contratante_id: contratanteId }, { onConflict: 'gestor_geral_id,contratante_id' });
  log.push(`✓ gestor geral ${GESTOR_GERAL.email}`);

  for (const [i, u] of UNIDADES.entries()) {
    const criadaEm = addDias(inicioRede, i);
    let unidadeId = await carregarUnidade(admin, contratanteId!, u);
    const dadosUnidade = {
      nome: u.nome, tipo: 'ubs', tipo_id: tipoUbs?.id ?? null,
      cidade: 'São Paulo', estado: 'SP', pais: 'Brasil',
      ativa: true, plano_status: 'ativo', contratante_id: contratanteId,
    };
    if (unidadeId) {
      const { error } = await admin.from('unidades').update(dadosUnidade).eq('id', unidadeId);
      if (error) falhou(`atualizar ${u.nome}`, error);
    } else {
      const { data, error } = await admin.from('unidades')
        .insert({ ...dadosUnidade, created_at: ts(criadaEm, 9) }).select('id').single();
      if (error) falhou(`criar ${u.nome}`, error);
      unidadeId = data.id;
    }
    await admin.from('gestores_gerais_unidades')
      .upsert({ gestor_geral_id: gg!.id, unidade_id: unidadeId }, { onConflict: 'gestor_geral_id,unidade_id' });

    const profBase = {
      plano_id: plano!.id, plano_status: 'ativo', laudos_usados: 0,
      cidade: 'São Paulo', estado: 'SP', pais: 'Brasil', idioma: 'pt-BR',
      unidade_id: unidadeId, acesso_revogado: false,
    };
    const upsertProf = async (
      email: string, nome: string, crm: string | null, especialidade: string | null, perfilClinico: string,
      perfilInst: 'gestor' | 'institucional', desde: string,
    ) => {
      const userId = await garantirUsuario(admin, email, nome);
      const dados = {
        ...profBase, user_id: userId, nome, crm, especialidade,
        perfil_clinico: perfilClinico, perfil_institucional: perfilInst,
      };
      const { data: ex } = await admin.from('profissionais').select('id').eq('user_id', userId).maybeSingle();
      if (ex) {
        const { error } = await admin.from('profissionais').update(dados).eq('id', ex.id);
        if (error) falhou(`atualizar profissional ${email}`, error);
      } else {
        const { error } = await admin.from('profissionais').insert({ ...dados, created_at: ts(desde, 11) });
        if (error) falhou(`criar profissional ${email}`, error);
      }
      return userId;
    };

    const gestorUser = await upsertProf(
      // Gestor de unidade é cargo administrativo: sem CRM/especialidade.
      u.gestor.email, u.gestor.nome, null, null, 'outro', 'gestor', addDias(criadaEm, 1),
    );

    // Convites: recria os da unidade (a unidade é 100% da rede demo).
    await admin.from('convites').delete().eq('unidade_id', unidadeId);
    const convites: Record<string, unknown>[] = [];
    for (const [k, p] of u.profissionais.entries()) {
      const desde = addDias(criadaEm, 3 + k * 2);
      await upsertProf(p.email, p.nome, p.crm, p.especialidade, p.perfil_clinico, 'institucional', desde);
      convites.push({
        unidade_id: unidadeId, email_convidado: p.email, token: crypto.randomUUID(), status: 'aceito',
        convidado_por: gestorUser, created_at: ts(addDias(desde, -1), 14), expires_at: ts(addDias(desde, 6), 14),
      });
    }
    for (const [k, email] of u.convitesPendentes.entries()) {
      const enviado = addDias(hoje, -(2 + k));
      convites.push({
        unidade_id: unidadeId, email_convidado: email, token: crypto.randomUUID(), status: 'pendente',
        convidado_por: gestorUser, created_at: ts(enviado, 15), expires_at: ts(addDias(enviado, 7), 15),
      });
    }
    const { error: convErr } = await admin.from('convites').insert(convites);
    if (convErr) falhou(`convites ${u.nome}`, convErr);
    log.push(`✓ ${u.nome}: gestor + ${u.profissionais.length} profissionais, ${u.convitesPendentes.length} convite(s) pendente(s)`);
  }
  return log;
}

// ── ETAPA 2: gestantes de uma unidade ───────────────────────────────────────
interface ProfCtx { id: string; userId: string; nome: string; crm: string | null; especialidade: string | null; token: string }

async function apagarGestantesDaUnidade(admin: SupabaseClient, unidadeId: string) {
  const { data, error } = await admin.from('pacientes').select('id').eq('unidade_id', unidadeId);
  if (error) falhou('listar gestantes', error);
  const ids = (data ?? []).map((p) => p.id as string);
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    // As fichas apagam por ON DELETE CASCADE; apagamos as filhas antes para
    // não depender de nenhuma FK sem cascade.
    for (const t of ['laudos', 'registros_atendimento', 'decisoes_ficha_a', 'exames_fetais',
      'perfis_glicemicos', 'exames_glicemia', 'consultas', 'exames_usg', 'partos']) {
      const { error: e } = await admin.from(t).delete().in('paciente_id', lote);
      if (e && !/does not exist|schema cache/i.test(e.message)) falhou(`apagar ${t}`, e);
    }
    const { error: e } = await admin.from('pacientes').delete().in('id', lote);
    if (e) falhou('apagar gestantes', e);
  }
  return ids.length;
}

async function entrarComo(email: string): Promise<string> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.auth.signInWithPassword({ email, password: SENHA_DEMO });
  if (error || !data.session) falhou(`login ${email}`, error);
  return data.session!.access_token;
}

async function executarGestante(
  admin: SupabaseClient, unidadeId: string, p: PlanoPaciente, prof: ProfCtx, falhas: string[],
) {
  const cn = p.eventos[0];
  const { data: pac, error: pacErr } = await admin.from('pacientes').insert({
    nome: p.nome,
    profissional_id: prof.id,
    unidade_id: unidadeId,
    data_nascimento: p.dataNascimento,
    tipo_identificacao: 'prontuario',
    numero_identificacao: p.identificacao,
    whatsapp: null,
    dum: p.dum,
    dmg_gestacao_anterior: p.dmgAnterior,
    data_ultima_consulta: cn.data,
    is_rascunho: false,
    status_ficha: 'aguardando_gj',
    referencia_ig: 'dum',
    created_at: ts(cn.data, p.hora),
  }).select('id').single();
  if (pacErr) falhou(`gestante ${p.nome}`, pacErr);
  const pacienteId = pac.id as string;

  let seq = 0;
  let minuto = 0;
  const carimbo = async (data: string, tipo: string, recursoId: string | null, recursoTipo: string | null) => {
    const { error } = await admin.from('registros_atendimento').insert({
      paciente_id: pacienteId, profissional_id: prof.id, unidade_id: unidadeId,
      tipo_operacao: tipo, recurso_id: recursoId, recurso_tipo: recursoTipo,
      profissional_nome: prof.nome, profissional_crm: prof.crm, profissional_especialidade: prof.especialidade,
      created_at: ts(data, p.hora, minuto + 2),
    });
    if (error) falhou(`carimbo ${tipo}`, error);
  };
  const novaConsulta = async (e: Evento, extra: Record<string, unknown>) => {
    seq += 1;
    const { data, error } = await admin.from('consultas').insert({
      paciente_id: pacienteId, profissional_id: prof.id,
      numero_sequencial: e.tipo === 'retorno_1' ? 2 : seq,
      data: e.data, is_rascunho: false, status_ficha: 'completa',
      created_at: ts(e.data, p.hora, minuto), ...extra,
    }).select('id').single();
    if (error) falhou(`consulta ${e.tipo}`, error);
    return data.id as string;
  };
  const atualizarPaciente = async (dados: Record<string, unknown>) => {
    const { error } = await admin.from('pacientes').update(dados).eq('id', pacienteId);
    if (error) falhou('atualizar gestante', error);
  };
  const gerarLaudo = async (consultaId: string, e: Evento) => {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/gerar-laudo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${prof.token}`, apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paciente_id: pacienteId, consulta_id: consultaId, idioma: 'pt-BR' }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || !body.laudo_id) {
      falhas.push(`${p.nome} · ${e.tipo} ${e.data}: HTTP ${resp.status} ${JSON.stringify(body)}`);
      return;
    }
    // Só o carimbo de data: o laudo nasce "agora"; a consulta é retroativa.
    const quando = ts(e.data, p.hora, minuto + 20);
    await admin.from('laudos').update({ created_at: quando }).eq('id', body.laudo_id);
    await admin.from('registros_atendimento').update({ created_at: quando })
      .eq('recurso_id', body.laudo_id).eq('tipo_operacao', 'gerar_laudo');
  };

  for (const e of p.eventos) {
    minuto = (minuto + 37) % 50;
    if (e.tipo === 'caso_novo') {
      // Consulta1Form: consulta inicial sem cenário, status aguardando_gj.
      const id = await novaConsulta(e, { tipo: 'consulta_1', status_gerado: 'aguardando_gj' });
      await carimbo(e.data, 'consulta_inicial', id, 'consulta');
    } else if (e.tipo === 'retorno_1') {
      // Retorno1Form: GJ plasmática → diagnóstico.
      const id = await novaConsulta(e, {
        tipo: 'retorno_1', ig_semanas: e.ig.semanas, ig_dias: e.ig.dias,
        status_gerado: e.statusFicha, cenario_clinico: e.cenario,
      });
      const { error } = await admin.from('exames_glicemia').insert({
        consulta_id: id, paciente_id: pacienteId, profissional_id: prof.id,
        valor_mgdl: e.gj, tipo_exame: 'plasmatica', data_exame: e.data,
        ig_semanas_na_data: e.ig.semanas, ig_dias_na_data: e.ig.dias, created_at: ts(e.data, p.hora, minuto),
      });
      if (error) falhou('exame GJ', error);
      await atualizarPaciente({ status_ficha: e.statusFicha, data_ultima_consulta: e.data });
      await carimbo(e.data, 'retorno', id, 'consulta');
      if (e.cenario) await gerarLaudo(id, e);
    } else if (e.tipo === 'gtt') {
      // GttForm
      const id = await novaConsulta(e, {
        tipo: 'gtt', ig_semanas: e.ig.semanas, ig_dias: e.ig.dias,
        status_gerado: e.statusFicha, cenario_clinico: e.cenario,
      });
      const { error } = await admin.from('exames_glicemia').insert({
        consulta_id: id, paciente_id: pacienteId, profissional_id: prof.id,
        tipo_exame: 'gtt', valor_mgdl: e.jejum, gtt_jejum: e.jejum, gtt_1h: e.h1, gtt_2h: e.h2,
        gtt_recurso_limitado: false, data_exame: e.data,
        ig_semanas_na_data: e.ig.semanas, ig_dias_na_data: e.ig.dias, created_at: ts(e.data, p.hora, minuto),
      });
      if (error) falhou('exame GTT', error);
      await atualizarPaciente({ status_ficha: e.statusFicha, data_ultima_consulta: e.data });
      await carimbo(e.data, 'preencher_gtt', id, 'consulta');
      if (e.cenario) await gerarLaudo(id, e);
    } else if (e.tipo === 'ficha_ac') {
      // FichaACForm (Retorno 2 — perfil glicêmico de 4 pontos)
      const id = await novaConsulta(e, {
        tipo: e.fichaTipo, ig_semanas: e.ig.semanas, ig_dias: e.ig.dias,
        status_gerado: 'dmg_confirmado', cenario_clinico: e.cenario,
      });
      const { data: perfil, error: perfErr } = await admin.from('perfis_glicemicos').insert({
        consulta_id: id, paciente_id: pacienteId, profissional_id: prof.id,
        tipo_perfil: '4_pontos', peso_paciente_kg: null,
        data_inicio: e.dataInicio, data_fim: e.dataFim,
        percentual_meta: e.percentual, total_preenchidos: e.total, na_meta: e.naMeta,
        decisao: e.decisaoPerfil, dose_insulina_calculada: null, tipo_pos_prandial: e.janela,
        created_at: ts(e.data, p.hora, minuto),
      }).select('id').single();
      if (perfErr) falhou('perfil glicêmico', perfErr);
      const valores: Record<string, unknown>[] = [];
      e.grid.forEach((row, d) => {
        for (const ponto of PONTOS_4) {
          const v = row[ponto];
          if (v && v > 0) valores.push({ perfil_id: perfil.id, dia: d + 1, ponto, valor_mgdl: v });
        }
      });
      if (valores.length) {
        const { error } = await admin.from('valores_perfil').insert(valores);
        if (error) falhou('valores do perfil', error);
      }
      await atualizarPaciente({
        status_ficha: e.iniciaInsulina ? 'encerrada_insulinizacao' : 'dmg_confirmado',
        ...(e.iniciaInsulina ? { motivo_encerramento: 'insulinizacao', data_encerramento: e.data } : {}),
        data_ultima_consulta: e.data,
        data_proximo_retorno: e.proximoRetorno,
      });
      await carimbo(e.data, 'preencher_ficha_ac', id, 'ficha');
      await gerarLaudo(id, e);
      const quando = ts(e.data, p.hora, minuto + 5);
      const { error: decErr } = await admin.from('decisoes_ficha_a').upsert({
        consulta_id: id, paciente_id: pacienteId, profissional_id: prof.id,
        checklist_dieta: e.checklist.checklist_dieta,
        checklist_exercicio: e.checklist.checklist_exercicio,
        checklist_ganho_peso: e.checklist.checklist_ganho_peso,
        checklist_pfe_us: e.checklist.checklist_pfe_us,
        checklist_ca: e.checklist.checklist_ca,
        checklist_la: e.checklist.checklist_la,
        percentual_meta: e.percentual,
        regra_aplicada: e.decisao.regra_aplicada,
        conduta_gerada: e.decisao.conduta_gerada,
        memoria_glicosimetro: e.checklist.memoria_glicosimetro,
        pactuacao_adesao: e.checklist.pactuacao_adesao,
        dose_insulina_total: e.decisao.dose_total,
        dose_insulina_manha: e.decisao.dose_manha,
        dose_insulina_noite: e.decisao.dose_noite,
        proxima_ficha_recomendada: e.decisao.proxima_ficha_recomendada,
        created_at: quando, updated_at: quando,
      }, { onConflict: 'consulta_id' });
      if (decErr) falhou('decisão da ficha A', decErr);
      const { error: fetErr } = await admin.from('exames_fetais').upsert({
        consulta_id: id, paciente_id: pacienteId, profissional_id: prof.id,
        morfologico: null, pfe_us: null, ca: null, la: null,
        crescimento: null, cmf: null, ctg: null, pbf: null,
        created_at: quando, updated_at: quando,
      }, { onConflict: 'consulta_id' });
      if (fetErr) falhou('exames fetais', fetErr);
    } else if (e.tipo === 'encerramento') {
      // FichaPacientePage.handleEncerrar: grava só motivo + data (+ obs).
      await atualizarPaciente({ motivo_encerramento: e.motivo, data_encerramento: e.data, obs_encerramento: null });
    }
  }
}

async function emParalelo<T>(itens: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) await fn(itens[i++]);
  }));
}

async function etapaGestantes(admin: SupabaseClient, hoje: string, chave: string) {
  const u = UNIDADES.find((x) => x.chave === chave);
  if (!u) throw new Error(`unidade inválida: ${chave} (use ${UNIDADES.map((x) => x.chave).join(', ')})`);
  const contratanteId = await carregarContratante(admin);
  const unidadeId = contratanteId && await carregarUnidade(admin, contratanteId, u);
  if (!unidadeId) throw new Error('rode a etapa "estrutura" antes');

  const removidas = await apagarGestantesDaUnidade(admin, unidadeId);

  const profs: Record<string, ProfCtx> = {};
  for (const ps of u.profissionais) {
    const { data, error } = await admin.from('profissionais')
      .select('id, user_id, nome, crm, especialidade').eq('unidade_id', unidadeId)
      .eq('user_id', (await encontrarUsuario(admin, ps.email)) ?? '').maybeSingle();
    if (error || !data) falhou(`profissional ${ps.email}`, error ?? { message: 'não encontrado — rode "estrutura"' });
    await admin.from('profissionais').update({ laudos_usados: 0 }).eq('id', data.id);
    profs[ps.chave] = {
      id: data.id, userId: data.user_id, nome: data.nome, crm: data.crm, especialidade: data.especialidade,
      token: await entrarComo(ps.email),
    };
  }

  const plano = planejarRede(hoje)[u.chave];
  const falhas: string[] = [];
  await emParalelo(plano, 4, (p) => executarGestante(admin, unidadeId, p, profs[p.profissional], falhas));

  const { count: laudos } = await admin.from('laudos').select('id, pacientes!inner(unidade_id)', { count: 'exact', head: true })
    .eq('pacientes.unidade_id', unidadeId);
  return [
    `${u.nome}: ${removidas} gestantes antigas removidas, ${plano.length} criadas, ${laudos ?? '?'} laudos gerados pelo gerar-laudo`,
    ...(falhas.length ? [`⚠ ${falhas.length} laudo(s) não gerado(s):`, ...falhas] : []),
  ];
}

// ── ETAPA 3: relatórios mensais (só das unidades da rede) ───────────────────
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

async function etapaRelatorios(admin: SupabaseClient, hoje: string) {
  const log: string[] = [];
  const contratanteId = await carregarContratante(admin);
  if (!contratanteId) throw new Error('rode a etapa "estrutura" antes');
  const { data: unidades, error } = await admin.from('unidades').select('id, nome').eq('contratante_id', contratanteId);
  if (error) falhou('listar unidades', error);
  const ids = unidades!.map((x) => x.id as string);

  // Idempotência: apaga os relatórios automáticos já gerados para estas unidades.
  const { data: antigos } = await admin.from('relatorios_unidade').select('id, arquivo_path')
    .in('unidade_id', ids).eq('origem', 'automatico');
  const paths = (antigos ?? []).map((r) => r.arquivo_path as string).filter(Boolean);
  if (paths.length) await admin.storage.from('relatorios').remove(paths);
  if (antigos?.length) await admin.from('relatorios_unidade').delete().in('id', antigos.map((r) => r.id));

  const [ano, mes] = hoje.split('-').map(Number);
  for (let k = MESES_RELATORIO; k >= 1; k--) {
    const ini = new Date(Date.UTC(ano, mes - 1 - k, 1));
    const fim = new Date(Date.UTC(ano, mes - k, 0));
    const periodoInicio = ini.toISOString().slice(0, 10);
    const periodoFim = fim.toISOString().slice(0, 10);
    const rotuloMes = `${MESES[ini.getUTCMonth()]}/${ini.getUTCFullYear()}`;
    for (const u of unidades!) {
      const metricas = await agregarMetricas(admin, u.id, u.nome, periodoInicio, periodoFim);
      const pdf = await gerarPdfRelatorio({ metricas, periodoInicio, periodoFim, rotuloMes });
      // Mesmo caminho do gerar-relatorios-mensais: salva via salvar-relatorio.
      const fd = new FormData();
      fd.append('pdf_file', new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' }), `relatorio-${u.id}.pdf`);
      fd.append('unidade_id', u.id);
      fd.append('gestor_id', '00000000-0000-0000-0000-000000000001');
      fd.append('periodo_inicio', periodoInicio);
      fd.append('periodo_fim', periodoFim);
      fd.append('origem', 'automatico');
      fd.append('metricas_resumo', JSON.stringify(metricas));
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/salvar-relatorio`, {
        method: 'POST', headers: { Authorization: `Bearer ${SERVICE_ROLE}` }, body: fd,
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || body.status !== 'salvo') {
        log.push(`⚠ ${u.nome} ${rotuloMes}: ${body.mensagem ?? `HTTP ${resp.status}`}`);
        continue;
      }
      // O automático roda no dia 1 do mês seguinte, de madrugada.
      await admin.from('relatorios_unidade').update({ created_at: ts(addDias(periodoFim, 1), 3) }).eq('id', body.relatorio_id);
    }
    log.push(`✓ relatórios de ${rotuloMes}`);
  }

  const { error: mvErr } = await admin.rpc('refresh_mv_metricas_unidade_seed');
  log.push(mvErr ? `⚠ refresh da MV: ${mvErr.message}` : '✓ métricas das unidades atualizadas (MV)');
  return log;
}

// ── handler ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'use POST' }, 405);
  if (!SEED_SECRET || req.headers.get('x-seed-secret') !== SEED_SECRET) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const hoje = hojeBrt();

  try {
    let log: string[];
    if (body.etapa === 'estrutura') log = await etapaEstrutura(admin, hoje);
    else if (body.etapa === 'gestantes') log = await etapaGestantes(admin, hoje, String(body.unidade ?? ''));
    else if (body.etapa === 'relatorios') log = await etapaRelatorios(admin, hoje);
    else return json({ error: 'etapa inválida', etapas: ['estrutura', 'gestantes (+ unidade)', 'relatorios'] }, 400);

    return json({
      sucesso: true,
      etapa: body.etapa,
      log,
      acesso: {
        senha: SENHA_DEMO,
        gestor_geral: GESTOR_GERAL.email,
        gestores_de_unidade: Object.fromEntries(UNIDADES.map((u) => [u.nome, u.gestor.email])),
      },
    });
  } catch (e) {
    return json({ sucesso: false, etapa: body.etapa, error: (e as Error).message }, 500);
  }
});
