import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

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
  | 'criar_unidade'
  | 'listar_usuarios';

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
      case 'listar_usuarios': {
        // Lista todos os usuários auth com flags de papel
        const usuarios: Array<{
          user_id: string;
          email: string | null;
          created_at: string;
          nome_profissional: string | null;
          is_admin: boolean;
          is_gestor_geral: boolean;
          is_profissional: boolean;
        }> = [];

        // Paginação do auth admin (perPage máx 1000)
        let page = 1;
        const perPage = 50;
        // limite de segurança: 40 páginas (2000 usuários)
        for (let i = 0; i < 40; i++) {
          const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
          if (error) {
            console.error('listUsers falhou', { page, perPage, error });
            throw new Error(`Falha ao listar usuários (page ${page}): ${error.message}`);
          }
          for (const u of data.users) {
            usuarios.push({
              user_id: u.id,
              email: u.email ?? null,
              created_at: u.created_at,
              nome_profissional: null,
              is_admin: false,
              is_gestor_geral: false,
              is_profissional: false,
            });
          }
          if (data.users.length < perPage) break;
          page++;
        }

        const ids = usuarios.map((u) => u.user_id);
        if (ids.length > 0) {
          const [adminsRes, gestoresRes, profsRes] = await Promise.all([
            admin.from('admins').select('user_id').in('user_id', ids),
            admin.from('gestores_gerais').select('user_id').in('user_id', ids),
            admin.from('profissionais').select('user_id, nome').in('user_id', ids),
          ]);
          const adminSet = new Set((adminsRes.data ?? []).map((r) => r.user_id));
          const gestorSet = new Set((gestoresRes.data ?? []).map((r) => r.user_id));
          const profMap = new Map((profsRes.data ?? []).map((r) => [r.user_id, r.nome as string]));
          for (const u of usuarios) {
            u.is_admin = adminSet.has(u.user_id);
            u.is_gestor_geral = gestorSet.has(u.user_id);
            u.is_profissional = profMap.has(u.user_id);
            u.nome_profissional = profMap.get(u.user_id) ?? null;
          }
        }

        return ok({ ok: true, usuarios });
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
