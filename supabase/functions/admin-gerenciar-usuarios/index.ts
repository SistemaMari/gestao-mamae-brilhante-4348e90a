import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Acao =
  | 'promover_admin'
  | 'remover_admin'
  | 'promover_gestor_geral'
  | 'remover_gestor_geral'
  | 'vincular_unidade'
  | 'criar_unidade';

interface Body {
  acao: Acao;
  alvo_user_id?: string;
  payload?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Cliente com JWT do usuário (para validar identidade)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerId = userData.user.id;

    // Cliente service role para checagem e mutações
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verificar se quem chamou é admin
    const { data: isAdminRow } = await admin
      .from('admins')
      .select('id')
      .eq('user_id', callerId)
      .maybeSingle();

    if (!isAdminRow) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem executar esta ação' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: Body = await req.json();
    const { acao, alvo_user_id, payload } = body;

    if (!acao) {
      return new Response(JSON.stringify({ error: 'Ação não informada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (acao) {
      case 'promover_admin': {
        if (!alvo_user_id) throw new Error('alvo_user_id obrigatório');
        const nome = (payload?.nome as string) ?? null;
        const { error } = await admin.from('admins').insert({ user_id: alvo_user_id, nome });
        if (error && !error.message.includes('duplicate')) throw error;
        return ok({ ok: true });
      }
      case 'remover_admin': {
        if (!alvo_user_id) throw new Error('alvo_user_id obrigatório');
        if (alvo_user_id === callerId) throw new Error('Você não pode remover seu próprio acesso de admin');
        const { error } = await admin.from('admins').delete().eq('user_id', alvo_user_id);
        if (error) throw error;
        return ok({ ok: true });
      }
      case 'promover_gestor_geral': {
        if (!alvo_user_id) throw new Error('alvo_user_id obrigatório');
        const nome = (payload?.nome as string) ?? null;
        const { error } = await admin.from('gestores_gerais').insert({ user_id: alvo_user_id, nome });
        if (error && !error.message.includes('duplicate')) throw error;
        return ok({ ok: true });
      }
      case 'remover_gestor_geral': {
        if (!alvo_user_id) throw new Error('alvo_user_id obrigatório');
        const { error } = await admin.from('gestores_gerais').delete().eq('user_id', alvo_user_id);
        if (error) throw error;
        return ok({ ok: true });
      }
      case 'vincular_unidade': {
        if (!alvo_user_id) throw new Error('alvo_user_id obrigatório');
        const unidade_id = payload?.unidade_id as string | null;
        const perfil_institucional = (payload?.perfil_institucional as string) ?? 'profissional';
        const { error } = await admin
          .from('profissionais')
          .update({ unidade_id, perfil_institucional })
          .eq('user_id', alvo_user_id);
        if (error) throw error;
        return ok({ ok: true });
      }
      case 'criar_unidade': {
        const nome = payload?.nome as string;
        const tipo = (payload?.tipo as string) ?? null;
        if (!nome) throw new Error('nome da unidade obrigatório');
        const { data, error } = await admin.from('unidades').insert({ nome, tipo }).select().single();
        if (error) throw error;
        return ok({ ok: true, unidade: data });
      }
      default:
        return new Response(JSON.stringify({ error: 'Ação desconhecida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error('admin-gerenciar-usuarios error:', err);
    const message = err instanceof Error ? err.message : 'Erro interno';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
