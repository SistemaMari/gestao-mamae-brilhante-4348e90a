import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ status: 'erro', mensagem: 'Método não permitido.' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ status: 'erro', mensagem: 'Não autorizado.' }, 401);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse multipart/form-data
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonResponse({ status: 'erro', mensagem: 'Body inválido (esperado multipart/form-data).' }, 400);
    }

    const pdfFile = form.get('pdf_file');
    const unidadeId = (form.get('unidade_id') as string | null)?.trim() ?? null;
    const gestorIdRaw = (form.get('gestor_id') as string | null)?.trim() ?? null;
    const periodoInicio = (form.get('periodo_inicio') as string | null)?.trim() ?? null;
    const periodoFim = (form.get('periodo_fim') as string | null)?.trim() ?? null;
    const metricasResumoRaw = form.get('metricas_resumo') as string | null;
    const origem = ((form.get('origem') as string | null)?.trim() ?? 'manual') as 'manual' | 'automatico';

    if (!pdfFile || !(pdfFile instanceof File)) {
      return jsonResponse({ status: 'erro', mensagem: 'PDF não recebido.' }, 400);
    }
    if (!unidadeId || !periodoInicio || !periodoFim) {
      return jsonResponse(
        { status: 'erro', mensagem: 'Parâmetros obrigatórios ausentes (unidade_id, periodo_inicio, periodo_fim).' },
        400,
      );
    }
    if (origem !== 'manual' && origem !== 'automatico') {
      return jsonResponse({ status: 'erro', mensagem: 'origem deve ser "manual" ou "automatico".' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fluxo AUTOMATICO só é válido quando o caller apresenta a service_role key
    // (cron job interno). O UUID de sistema sozinho NÃO é mais suficiente —
    // ele era forjável por qualquer cliente autenticado.
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    const isServiceRole = bearer === SERVICE_ROLE;
    const isAutomatico = origem === 'automatico' && isServiceRole;

    if (origem === 'automatico' && !isServiceRole) {
      return jsonResponse(
        { status: 'erro', mensagem: 'origem=automatico requer credenciais de serviço.' },
        403,
      );
    }

    let gestorId: string | null = gestorIdRaw;


    if (!isAutomatico) {
      // Fluxo MANUAL: valida sessão do gestor humano
      if (!gestorIdRaw) {
        return jsonResponse({ status: 'erro', mensagem: 'gestor_id obrigatório para origem manual.' }, 400);
      }

      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) {
        return jsonResponse({ status: 'erro', mensagem: 'Sessão inválida.' }, 401);
      }
      const callerId = userData.user.id;

      if (gestorIdRaw !== callerId) {
        return jsonResponse({ status: 'erro', mensagem: 'gestor_id não corresponde ao usuário autenticado.' }, 403);
      }

      const { data: prof, error: profErr } = await admin
        .from('profissionais')
        .select('id, unidade_id, perfil_institucional')
        .eq('user_id', gestorIdRaw)
        .maybeSingle();

      if (profErr) {
        console.error('Erro ao buscar profissional:', profErr);
        return jsonResponse({ status: 'erro', mensagem: 'Falha ao validar gestor.' }, 500);
      }

      if (!prof || prof.unidade_id !== unidadeId || prof.perfil_institucional !== 'gestor') {
        return jsonResponse({ status: 'erro', mensagem: 'Gestor não pertence a esta unidade.' }, 403);
      }
    } else {
      // Fluxo AUTOMATICO: o cron chama com service_role; gestor_id vai como NULL no banco
      // (preferência por NULL em vez do UUID do sistema, para deixar claro que não há gestor humano)
      gestorId = null;

      // Sanity check: a unidade existe?
      const { data: uni, error: uniErr } = await admin
        .from('unidades')
        .select('id')
        .eq('id', unidadeId)
        .maybeSingle();
      if (uniErr || !uni) {
        return jsonResponse({ status: 'erro', mensagem: 'Unidade não encontrada.' }, 404);
      }
    }

    // Path: {unidade_id}/{ano-mes}/{automatico_|manual_}{timestamp}.pdf
    const timestamp = Date.now();
    const anoMes = new Date().toISOString().slice(0, 7);
    const prefix = isAutomatico ? 'automatico_' : 'manual_';
    const path = `${unidadeId}/${anoMes}/${prefix}${timestamp}.pdf`;

    const { error: uploadErr } = await admin.storage
      .from('relatorios')
      .upload(path, pdfFile, { contentType: 'application/pdf', upsert: false });

    if (uploadErr) {
      console.error('Erro upload storage:', uploadErr);
      return jsonResponse({ status: 'erro', mensagem: 'Falha ao salvar arquivo.' }, 500);
    }

    const tamanho = pdfFile.size;

    let metricas: Record<string, unknown> | null = null;
    if (metricasResumoRaw) {
      try {
        const parsed = JSON.parse(metricasResumoRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          metricas = parsed;
        }
      } catch {
        metricas = null;
      }
    }

    const { data: inserted, error: dbErr } = await admin
      .from('relatorios_unidade')
      .insert({
        unidade_id: unidadeId,
        gestor_id: gestorId,
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        tipo: 'dashboard_gestao',
        arquivo_path: path,
        arquivo_tamanho_bytes: tamanho,
        metricas_resumo: metricas,
        origem,
      })
      .select('id')
      .single();

    if (dbErr) {
      console.error('Erro insert relatorios_unidade:', dbErr);
      await admin.storage.from('relatorios').remove([path]).catch(() => {});
      return jsonResponse({ status: 'erro', mensagem: 'Falha ao registrar relatório.' }, 500);
    }

    return jsonResponse(
      {
        status: 'salvo',
        relatorio_id: inserted.id,
        arquivo_path: path,
        origem,
      },
      200,
    );
  } catch (err) {
    console.error('salvar-relatorio erro inesperado:', err);
    const mensagem = err instanceof Error ? err.message : 'Erro interno.';
    return jsonResponse({ status: 'erro', mensagem }, 500);
  }
});
