// Edge Function: gerar-relatorios-mensais
// Disparada por pg_cron todo dia 1 do mês às 03:00 BRT.
// Itera todas as unidades ativas, agrega métricas do mês anterior e gera PDF
// arquivado em relatorios_unidade com origem='automatico'.
//
// Pode ser chamada também manualmente (admin) com body:
//   { "periodo_inicio": "2026-03-01", "periodo_fim": "2026-03-31" }
// para regerar um período específico.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { agregarMetricas, gerarPdfRelatorioCompleto } from '../_shared/relatorioMensal.ts';
import { papelDoToken } from '../_shared/papelDoToken.ts';

const SYSTEM_USER_UUID = '00000000-0000-0000-0000-000000000001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// Cálculo de período padrão (mês anterior)
// ============================================================
function calcularMesAnterior(): { inicio: string; fim: string; rotuloMes: string } {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  // Formatação LOCAL — evita -1 dia por timezone (alinhado ao item 2 do prompt)
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const rotuloMes = `${meses[inicio.getMonth()]}/${inicio.getFullYear()}`;
  return { inicio: fmt(inicio), fim: fmt(fim), rotuloMes };
}

// ============================================================
// Loop principal
// ============================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Auth guard: só chave de serviço (pg_cron manda a do cofre). verify_jwt = true
  // no config.toml: o gateway já conferiu a assinatura; aqui conferimos o papel.
  const bearer = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  if (!SERVICE_ROLE || papelDoToken(bearer) !== 'service_role') {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Permite override de período via body (para regeração manual por admin)
  let periodoInicio: string;
  let periodoFim: string;
  let rotuloMes: string;

  try {
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      const body = await req.json().catch(() => ({}));
      if (body.periodo_inicio && body.periodo_fim) {
        periodoInicio = body.periodo_inicio;
        periodoFim = body.periodo_fim;
        rotuloMes = `${periodoInicio} a ${periodoFim}`;
      } else {
        const m = calcularMesAnterior();
        periodoInicio = m.inicio; periodoFim = m.fim; rotuloMes = m.rotuloMes;
      }
    } else {
      const m = calcularMesAnterior();
      periodoInicio = m.inicio; periodoFim = m.fim; rotuloMes = m.rotuloMes;
    }
  } catch {
    const m = calcularMesAnterior();
    periodoInicio = m.inicio; periodoFim = m.fim; rotuloMes = m.rotuloMes;
  }

  // Verifica execução duplicada
  const { data: emAndamento } = await admin
    .from('execucoes_cron')
    .select('id')
    .eq('job_nome', 'gerar-relatorios-mensais')
    .eq('status', 'em_andamento')
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fim', periodoFim)
    .maybeSingle();

  if (emAndamento) {
    return jsonResponse(
      { status: 'abortado', mensagem: 'Já existe execução em andamento para este período.', execucao_id: emAndamento.id },
      409,
    );
  }

  // Cria registro de execução
  const { data: execucao, error: execErr } = await admin
    .from('execucoes_cron')
    .insert({
      job_nome: 'gerar-relatorios-mensais',
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      status: 'em_andamento',
    })
    .select('id')
    .single();

  if (execErr || !execucao) {
    console.error('Falha ao criar execucao_cron:', execErr);
    return jsonResponse({ status: 'erro', mensagem: 'Falha ao iniciar execução.' }, 500);
  }
  const execucaoId = execucao.id;

  try {
    // Busca unidades ativas
    const { data: unidades, error: uniErr } = await admin
      .from('unidades')
      .select('id, nome')
      .eq('ativa', true);

    if (uniErr) throw uniErr;
    const unidadesArr: any[] = unidades ?? [];

    const resultados = {
      sucesso: [] as Array<{ unidade_id: string; relatorio_id: string; arquivo_path: string }>,
      vazias: [] as Array<{ unidade_id: string; relatorio_id: string }>,
      falha: [] as Array<{ unidade_id: string; erro: string }>,
    };

    for (const unidade of unidadesArr) {
      try {
        const metricas = await agregarMetricas(
          admin, unidade.id as string, unidade.nome as string, periodoInicio, periodoFim,
        );

        const ehVazia = metricas.total_gestantes === 0 && metricas.partos_registrados === 0;

        const pdfBytes = await gerarPdfRelatorioCompleto(admin, {
          metricas, periodoInicio, periodoFim, rotuloMes,
        });

        // Salva via salvar-relatorio (passando service_role para o auth header)
        const fd = new FormData();
        fd.append('pdf_file', new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }), `relatorio-${unidade.id}.pdf`);
        fd.append('unidade_id', unidade.id as string);
        fd.append('gestor_id', SYSTEM_USER_UUID);
        fd.append('periodo_inicio', periodoInicio);
        fd.append('periodo_fim', periodoFim);
        fd.append('origem', 'automatico');
        fd.append('metricas_resumo', JSON.stringify(metricas));

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/salvar-relatorio`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
          body: fd,
        });
        const respJson = await resp.json();

        if (!resp.ok || respJson.status !== 'salvo') {
          throw new Error(respJson.mensagem ?? `HTTP ${resp.status}`);
        }

        if (ehVazia) {
          resultados.vazias.push({ unidade_id: unidade.id as string, relatorio_id: respJson.relatorio_id });
        } else {
          resultados.sucesso.push({
            unidade_id: unidade.id as string,
            relatorio_id: respJson.relatorio_id,
            arquivo_path: respJson.arquivo_path,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`Falha unidade ${unidade.id}:`, msg);
        resultados.falha.push({ unidade_id: unidade.id as string, erro: msg });
      }
    }

    // Retry uma vez para falhas
    if (resultados.falha.length > 0) {
      const falhasOriginais = [...resultados.falha];
      resultados.falha = [];

      for (const falha of falhasOriginais) {
        try {
          const uni = unidadesArr.find((u) => u.id === falha.unidade_id);
          if (!uni) {
            resultados.falha.push(falha);
            continue;
          }
          const metricas = await agregarMetricas(
            admin, uni.id as string, uni.nome as string, periodoInicio, periodoFim,
          );
          const ehVazia = metricas.total_gestantes === 0 && metricas.partos_registrados === 0;
          const pdfBytes = await gerarPdfRelatorioCompleto(admin, { metricas, periodoInicio, periodoFim, rotuloMes });

          const fd = new FormData();
          fd.append('pdf_file', new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' }), `relatorio-${uni.id}.pdf`);
          fd.append('unidade_id', uni.id as string);
          fd.append('gestor_id', SYSTEM_USER_UUID);
          fd.append('periodo_inicio', periodoInicio);
          fd.append('periodo_fim', periodoFim);
          fd.append('origem', 'automatico');
          fd.append('metricas_resumo', JSON.stringify(metricas));

          const resp = await fetch(`${SUPABASE_URL}/functions/v1/salvar-relatorio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${SERVICE_ROLE}` },
            body: fd,
          });
          const respJson = await resp.json();

          if (!resp.ok || respJson.status !== 'salvo') {
            throw new Error(respJson.mensagem ?? `HTTP ${resp.status}`);
          }

          if (ehVazia) {
            resultados.vazias.push({ unidade_id: uni.id as string, relatorio_id: respJson.relatorio_id });
          } else {
            resultados.sucesso.push({
              unidade_id: uni.id as string,
              relatorio_id: respJson.relatorio_id,
              arquivo_path: respJson.arquivo_path,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erro desconhecido';
          resultados.falha.push({ unidade_id: falha.unidade_id, erro: `[retry] ${msg}` });
        }
      }
    }

    // Encerra execução
    const status = resultados.falha.length === 0 ? 'sucesso' : 'parcial';
    await admin.from('execucoes_cron').update({
      status,
      total_unidades: unidadesArr.length,
      total_sucesso: resultados.sucesso.length,
      total_vazias: resultados.vazias.length,
      total_falha: resultados.falha.length,
      detalhe_falhas: resultados.falha.length > 0 ? resultados.falha : null,
      finalizado_em: new Date().toISOString(),
    }).eq('id', execucaoId);

    return jsonResponse({
      status,
      execucao_id: execucaoId,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      total_unidades: unidadesArr.length,
      total_sucesso: resultados.sucesso.length,
      total_vazias: resultados.vazias.length,
      total_falha: resultados.falha.length,
      falhas: resultados.falha,
    }, 200);

  } catch (err) {
    console.error('Falha total:', err);
    const msg = err instanceof Error ? err.message : 'Erro interno.';
    await admin.from('execucoes_cron').update({
      status: 'falha_total',
      detalhe_falhas: [{ erro_global: msg }],
      finalizado_em: new Date().toISOString(),
    }).eq('id', execucaoId);
    return jsonResponse({ status: 'falha_total', execucao_id: execucaoId, mensagem: msg }, 500);
  }
});
