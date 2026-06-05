// Edge Function: smoke-test-consolidacao
// Smoke test end-to-end do fluxo de consolidação:
// 1) Cria 1 auth.user gestor geral (email aleatório, senha conhecida)
// 2) Cria registro em gestores_gerais
// 3) Cria 2 unidades + vínculos em gestores_gerais_unidades
// 4) Cria 2 relatorios_unidade com metricas_resumo sintéticas (origem 'manual' via admin)
// 5) Faz signIn com a senha para obter JWT
// 6) Invoca consolidar-relatorios e valida resposta
// 7) Faz cleanup (apaga registros e auth user)
//
// Esta função NÃO requer JWT (verify_jwt = false) e existe apenas para validação interna.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function metricas(seed: number, nomeUnidade: string) {
  return {
    unidade_nome: nomeUnidade,
    total_gestantes: 100 + seed,
    total_dmg_confirmado: 12 + seed,
    taxa_dmg_percent: 0,
    total_overt: 1 + (seed % 3),
    dmg_retorno1: 8 + seed,
    dmg_gtt: 5 + seed,
    controle_adequado_sem_insulina: 6 + seed,
    controle_com_insulina: 4 + seed,
    controle_adequado_com_insulina: 3 + seed,
    encaminhadas_especialista: 2 + seed,
    partos_registrados: 9 + seed,
    partos_vaginal: 5 + seed,
    partos_cesarea: 4 + seed,
    rn_aig: 7 + seed,
    rn_gig: 1,
    rn_pig: 1,
    intercorrencias_maternas: 1,
    intercorrencias_neonatais: 1,
    profissionais_ativos: 3,
    total_laudos: 20 + seed,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth guard: only callable with the service-role key (internal smoke test).
  const bearer = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  if (!SERVICE_ROLE || bearer !== SERVICE_ROLE) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const log: string[] = [];
  const cleanup: { table: string; id: string }[] = [];
  let authUserId: string | null = null;

  const recordCleanup = (table: string, id: string) => cleanup.push({ table, id });

  try {
    const ts = Date.now();
    const email = `smoke+${ts}@dramari.local`;
    const password = `Smoke!${ts}#X`;
    log.push(`Iniciando smoke test (ts=${ts})`);

    // 1) Criar auth.user
    const { data: createdUser, error: cuErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { smoke_test: true },
    });
    if (cuErr || !createdUser.user) throw new Error(`createUser: ${cuErr?.message ?? 'sem user'}`);
    authUserId = createdUser.user.id;
    log.push(`✓ auth.user criado: ${authUserId}`);

    // 2) gestores_gerais
    const { data: gg, error: ggErr } = await admin
      .from('gestores_gerais')
      .insert({ user_id: authUserId, nome: `Smoke GG ${ts}` })
      .select('id')
      .single();
    if (ggErr || !gg) throw new Error(`insert gestores_gerais: ${ggErr?.message}`);
    recordCleanup('gestores_gerais', gg.id);
    log.push(`✓ gestor_geral criado: ${gg.id}`);

    // 3) 2 unidades
    const { data: unidades, error: uErr } = await admin
      .from('unidades')
      .insert([
        { nome: `Smoke Unidade A ${ts}`, tipo: 'consultorio', ativa: true },
        { nome: `Smoke Unidade B ${ts}`, tipo: 'consultorio', ativa: true },
      ])
      .select('id, nome');
    if (uErr || !unidades || unidades.length !== 2) throw new Error(`insert unidades: ${uErr?.message}`);
    unidades.forEach((u) => recordCleanup('unidades', u.id));
    log.push(`✓ unidades criadas: ${unidades.map((u) => u.id).join(', ')}`);

    // 4) Vínculos M:N
    const { data: vinc, error: vErr } = await admin
      .from('gestores_gerais_unidades')
      .insert(unidades.map((u) => ({ gestor_geral_id: gg.id, unidade_id: u.id })))
      .select('id');
    if (vErr) throw new Error(`insert vinculos: ${vErr.message}`);
    (vinc ?? []).forEach((v) => recordCleanup('gestores_gerais_unidades', v.id));
    log.push(`✓ vínculos criados: ${vinc?.length}`);

    // 5) 2 relatorios_unidade
    const periodoInicio = '2026-03-01';
    const periodoFim = '2026-03-31';
    const SYSTEM_USER_UUID = '00000000-0000-0000-0000-000000000001';
    const relatoriosPayload = unidades.map((u, i) => {
      const m = metricas(i * 5, u.nome);
      m.taxa_dmg_percent = Number(((m.total_dmg_confirmado / m.total_gestantes) * 100).toFixed(1));
      return {
        unidade_id: u.id,
        gestor_id: SYSTEM_USER_UUID,
        tipo: 'dashboard_gestao',
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        arquivo_path: `smoke/${ts}/${u.id}.pdf`,
        arquivo_tamanho_bytes: 1024,
        metricas_resumo: m,
        origem: 'manual',
      };
    });
    const { data: rels, error: rErr } = await admin
      .from('relatorios_unidade')
      .insert(relatoriosPayload)
      .select('id');
    if (rErr || !rels) throw new Error(`insert relatorios: ${rErr?.message}`);
    rels.forEach((r) => recordCleanup('relatorios_unidade', r.id));
    log.push(`✓ relatórios criados: ${rels.map((r) => r.id).join(', ')}`);

    // 6) Login para obter JWT
    const userClient = createClient(SUPABASE_URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signIn, error: siErr } = await userClient.auth.signInWithPassword({ email, password });
    if (siErr || !signIn.session) throw new Error(`signIn: ${siErr?.message}`);
    const jwt = signIn.session.access_token;
    log.push(`✓ JWT obtido (len=${jwt.length})`);

    // 7) Invocar consolidar-relatorios
    const consolidarResp = await fetch(`${SUPABASE_URL}/functions/v1/consolidar-relatorios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        apikey: ANON,
      },
      body: JSON.stringify({
        gestor_geral_id: gg.id,
        relatorio_ids: rels.map((r) => r.id),
        formato_saida: 'ambos',
      }),
    });
    const consolidarBody = await consolidarResp.json().catch(() => ({}));
    log.push(`✓ consolidar-relatorios HTTP ${consolidarResp.status}`);

    let consolidacaoId: string | null = null;
    let validacao: Record<string, unknown> = {};

    if (consolidarResp.status === 200 && consolidarBody.status === 'consolidado') {
      consolidacaoId = consolidarBody.consolidacao_id ?? null;
      if (consolidacaoId) recordCleanup('consolidacoes', consolidacaoId);

      // Verifica signed URLs (HEAD request)
      const checkUrl = async (url: string | null) => {
        if (!url) return { ok: false, reason: 'sem url' };
        try {
          const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1023' } });
          return { ok: r.ok, status: r.status, content_length: r.headers.get('content-length') };
        } catch (e) {
          return { ok: false, reason: e instanceof Error ? e.message : String(e) };
        }
      };
      const [pdfCheck, csvCheck] = await Promise.all([
        checkUrl(consolidarBody.pdf_url ?? null),
        checkUrl(consolidarBody.csv_url ?? null),
      ]);

      validacao = {
        consolidacao_id: consolidacaoId,
        unidades_incluidas: consolidarBody.unidades_incluidas,
        pdf_url_presente: !!consolidarBody.pdf_url,
        csv_url_presente: !!consolidarBody.csv_url,
        pdf_acessivel: pdfCheck,
        csv_acessivel: csvCheck,
      };
      log.push(`✓ consolidação registrada: ${consolidacaoId}`);
      log.push(`✓ pdf_url ${pdfCheck.ok ? 'OK' : 'FALHA'}, csv_url ${csvCheck.ok ? 'OK' : 'FALHA'}`);
    } else {
      log.push(`✗ consolidar-relatorios falhou: ${JSON.stringify(consolidarBody)}`);
    }

    // 8) Cleanup
    log.push('Iniciando cleanup...');
    // Storage: tentar remover arquivos via consolidacao
    if (consolidacaoId) {
      const { data: cons } = await admin
        .from('consolidacoes')
        .select('pdf_path, csv_path')
        .eq('id', consolidacaoId)
        .maybeSingle();
      if (cons) {
        const paths = [cons.pdf_path, cons.csv_path].filter(Boolean) as string[];
        if (paths.length > 0) {
          await admin.storage.from('consolidados').remove(paths).catch(() => {});
        }
      }
    }
    // Apagar em ordem inversa (consolidacoes -> relatorios -> vinculos -> unidades -> gestores_gerais)
    const order = ['consolidacoes', 'relatorios_unidade', 'gestores_gerais_unidades', 'unidades', 'gestores_gerais'];
    for (const tbl of order) {
      const ids = cleanup.filter((c) => c.table === tbl).map((c) => c.id);
      if (ids.length === 0) continue;
      const { error: delErr } = await admin.from(tbl).delete().in('id', ids);
      if (delErr) log.push(`⚠ cleanup ${tbl}: ${delErr.message}`);
      else log.push(`✓ cleanup ${tbl}: ${ids.length} registros`);
    }
    if (authUserId) {
      const { error: duErr } = await admin.auth.admin.deleteUser(authUserId);
      if (duErr) log.push(`⚠ cleanup auth.user: ${duErr.message}`);
      else log.push(`✓ cleanup auth.user`);
    }

    const sucesso = consolidarResp.status === 200
      && consolidarBody.status === 'consolidado'
      && (validacao.pdf_acessivel as any)?.ok === true
      && (validacao.csv_acessivel as any)?.ok === true;

    return json({
      sucesso,
      log,
      consolidar_resposta: {
        http_status: consolidarResp.status,
        body: consolidarBody,
      },
      validacao,
    }, sucesso ? 200 : 500);

  } catch (err) {
    log.push(`✗ ERRO: ${err instanceof Error ? err.message : String(err)}`);
    // best-effort cleanup
    const order = ['consolidacoes', 'relatorios_unidade', 'gestores_gerais_unidades', 'unidades', 'gestores_gerais'];
    for (const tbl of order) {
      const ids = cleanup.filter((c) => c.table === tbl).map((c) => c.id);
      if (ids.length === 0) continue;
      await admin.from(tbl).delete().in('id', ids).then(() => {}, () => {});
    }
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return json({ sucesso: false, log, erro: err instanceof Error ? err.message : String(err) }, 500);
  }
});
