// Edge function: seed-rede-demo-cleanup
// Apaga TUDO o que a seed-rede-demo criou — e só isso.
//
// O que é apagado é localizado exclusivamente pelas chaves da especificação
// (seed-rede-demo/rede.ts): o contratante pelo CNPJ fictício, as unidades
// ligadas a ele (e tudo o que pertence a essas unidades) e as contas pelos
// e-mails @demo.mari.health listados lá. Nenhum outro dado é tocado.
//
// Uso: POST com header x-seed-secret = secret SEED_SECRET. Body opcional
// { "confirmar": true } — sem ele, só mostra o que SERIA apagado.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { CONTRATANTE, DOMINIO_EMAIL, todosEmailsDemo } from '../seed-rede-demo/rede.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-seed-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SEED_SECRET = Deno.env.get('SEED_SECRET') ?? '';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function checar(contexto: string, error: { message: string } | null) {
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    throw new Error(`${contexto}: ${error.message}`);
  }
}

async function usuariosDemo(admin: SupabaseClient) {
  const alvo = new Set(todosEmailsDemo().map((e) => e.toLowerCase()));
  const out: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      const email = (u.email ?? '').toLowerCase();
      // Dupla trava: e-mail listado na especificação E do domínio da demo.
      if (alvo.has(email) && email.endsWith(`@${DOMINIO_EMAIL}`)) out.push({ id: u.id, email });
    }
    if (data.users.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'use POST' }, 405);
  if (!SEED_SECRET || req.headers.get('x-seed-secret') !== SEED_SECRET) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const body = await req.json().catch(() => ({}));
  const confirmar = body.confirmar === true;
  const log: string[] = [];

  try {
    const { data: contratante } = await admin.from('contratantes').select('id, nome')
      .eq('cnpj', CONTRATANTE.cnpj).maybeSingle();
    const { data: unidades } = contratante
      ? await admin.from('unidades').select('id, nome').eq('contratante_id', contratante.id)
      : { data: [] as { id: string; nome: string }[] };
    const unidadeIds = (unidades ?? []).map((u) => u.id as string);
    const { data: pacientes } = unidadeIds.length
      ? await admin.from('pacientes').select('id').in('unidade_id', unidadeIds)
      : { data: [] as { id: string }[] };
    const pacienteIds = (pacientes ?? []).map((p) => p.id as string);
    const usuarios = await usuariosDemo(admin);
    const { data: ggs } = usuarios.length
      ? await admin.from('gestores_gerais').select('id').in('user_id', usuarios.map((u) => u.id))
      : { data: [] as { id: string }[] };
    const ggIds = (ggs ?? []).map((g) => g.id as string);

    const resumo = {
      contratante: contratante?.nome ?? null,
      unidades: (unidades ?? []).map((u) => u.nome),
      gestantes: pacienteIds.length,
      contas: usuarios.map((u) => u.email),
    };
    if (!confirmar) {
      return json({ simulacao: true, mensagem: 'Nada foi apagado. Envie { "confirmar": true } para apagar.', seria_apagado: resumo });
    }

    // 1. Relatórios (arquivos + linhas) e consolidações do gestor geral demo.
    if (unidadeIds.length) {
      const { data: rels } = await admin.from('relatorios_unidade').select('id, arquivo_path').in('unidade_id', unidadeIds);
      const paths = (rels ?? []).map((r) => r.arquivo_path as string).filter(Boolean);
      for (let i = 0; i < paths.length; i += 100) await admin.storage.from('relatorios').remove(paths.slice(i, i + 100));
      const { error } = await admin.from('relatorios_unidade').delete().in('unidade_id', unidadeIds);
      checar('relatorios_unidade', error);
      log.push(`✓ ${rels?.length ?? 0} relatórios`);
    }
    if (ggIds.length) {
      const { data: cons } = await admin.from('consolidacoes').select('id, pdf_path, csv_path').in('gestor_geral_id', ggIds);
      const paths = (cons ?? []).flatMap((c) => [c.pdf_path, c.csv_path]).filter(Boolean) as string[];
      if (paths.length) await admin.storage.from('consolidados').remove(paths);
      const { error } = await admin.from('consolidacoes').delete().in('gestor_geral_id', ggIds);
      checar('consolidacoes', error);
    }

    // 2. Gestantes e tudo o que pende delas.
    for (let i = 0; i < pacienteIds.length; i += 100) {
      const lote = pacienteIds.slice(i, i + 100);
      for (const t of ['laudos', 'registros_atendimento', 'decisoes_ficha_a', 'exames_fetais',
        'perfis_glicemicos', 'exames_glicemia', 'consultas', 'exames_usg', 'partos']) {
        const { error } = await admin.from(t).delete().in('paciente_id', lote);
        checar(t, error);
      }
      const { error } = await admin.from('pacientes').delete().in('id', lote);
      checar('pacientes', error);
    }
    log.push(`✓ ${pacienteIds.length} gestantes`);

    // 3. Equipes, convites, vínculos e unidades.
    if (unidadeIds.length) {
      for (const t of ['registros_atendimento', 'convites', 'profissionais', 'gestores_gerais_unidades']) {
        const { error } = await admin.from(t).delete().in('unidade_id', unidadeIds);
        checar(t, error);
      }
      const { error } = await admin.from('unidades').delete().in('id', unidadeIds);
      checar('unidades', error);
      log.push(`✓ ${unidadeIds.length} unidades`);
    }

    // 4. Contas (gestor geral, gestores e profissionais da demo).
    if (ggIds.length) {
      await admin.from('gestores_gerais_contratantes').delete().in('gestor_geral_id', ggIds);
      await admin.from('gestores_gerais_unidades').delete().in('gestor_geral_id', ggIds);
    }
    for (const u of usuarios) {
      await admin.from('profissionais').delete().eq('user_id', u.id);
      await admin.from('gestores_gerais').delete().eq('user_id', u.id);
      await admin.from('user_roles').delete().eq('user_id', u.id);
      const { error } = await admin.auth.admin.deleteUser(u.id);
      if (error) log.push(`⚠ conta ${u.email}: ${error.message}`);
    }
    log.push(`✓ ${usuarios.length} contas`);

    // 5. Organização.
    if (contratante) {
      const { error } = await admin.from('contratantes').delete().eq('id', contratante.id);
      checar('contratante', error);
      log.push(`✓ contratante ${contratante.nome}`);
    }

    const { error: mvErr } = await admin.rpc('refresh_mv_metricas_unidade_seed');
    log.push(mvErr ? `⚠ refresh da MV: ${mvErr.message}` : '✓ métricas das unidades atualizadas (MV)');

    return json({ sucesso: true, apagado: resumo, log });
  } catch (e) {
    return json({ sucesso: false, error: (e as Error).message, log }, 500);
  }
});
