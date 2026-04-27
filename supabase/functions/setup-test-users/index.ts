// Função TEMPORÁRIA — cria os 3 usuários de teste faltantes (gestor_geral, institucional, gestor)
// + 1 unidade de teste e os vínculos correspondentes. Idempotente.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENHA = 'TesteDraMari2026!';
const USUARIOS = [
  { email: 'gestor.geral@teste.dramari.com', nome: 'Gestor Geral Teste', tipo: 'gestor_geral' },
  { email: 'institucional@teste.dramari.com', nome: 'Profissional Institucional Teste', tipo: 'institucional' },
  { email: 'gestor.unidade@teste.dramari.com', nome: 'Gestor de Unidade Teste', tipo: 'gestor' },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const log: any[] = [];

  try {
    // 1. Garantir 1 unidade de teste
    let unidadeId: string;
    const { data: unidadeExistente } = await supabase
      .from('unidades').select('id').eq('nome', 'Unidade Teste — Maternidade Central').maybeSingle();
    if (unidadeExistente) {
      unidadeId = unidadeExistente.id;
      log.push({ step: 'unidade', acao: 'reutilizada', id: unidadeId });
    } else {
      const { data: novaUni, error: errUni } = await supabase
        .from('unidades')
        .insert({ nome: 'Unidade Teste — Maternidade Central', tipo: 'maternidade', ativa: true })
        .select('id').single();
      if (errUni) throw new Error(`Falha ao criar unidade: ${errUni.message}`);
      unidadeId = novaUni!.id;
      log.push({ step: 'unidade', acao: 'criada', id: unidadeId });
    }

    // 2. Criar/garantir usuários
    const credenciais: any[] = [];
    for (const u of USUARIOS) {
      let user: any = null;

      // Tentar criar; se já existir, buscar via SQL no auth.users
      const { data: novo, error: errUser } = await supabase.auth.admin.createUser({
        email: u.email,
        password: SENHA,
        email_confirm: true,
        user_metadata: { nome: u.nome },
      });

      if (errUser) {
        if (errUser.message.toLowerCase().includes('already')) {
          // Buscar via raw SQL no schema auth (service role tem permissão)
          const { data: existing, error: errSql } = await supabase
            .schema('auth' as any).from('users').select('id, email').eq('email', u.email).maybeSingle();
          if (errSql || !existing) {
            // Fallback: paginar listUsers
            for (let page = 1; page <= 10; page++) {
              const { data: list } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
              user = list.users.find((x) => x.email?.toLowerCase() === u.email.toLowerCase());
              if (user) break;
              if (list.users.length < 1000) break;
            }
            if (!user) throw new Error(`Usuário ${u.email} já existe mas não foi encontrado`);
          } else {
            user = { id: existing.id, email: existing.email };
          }
          // Resetar senha pra padrão
          await supabase.auth.admin.updateUserById(user.id, { password: SENHA, email_confirm: true });
          log.push({ step: 'user', email: u.email, acao: 'reutilizado', id: user.id });
        } else {
          throw new Error(`Falha criar ${u.email}: ${errUser.message}`);
        }
      } else {
        user = novo.user!;
        log.push({ step: 'user', email: u.email, acao: 'criado', id: user.id });
      }

      // 3. Vincular ao perfil correto
      if (u.tipo === 'gestor_geral') {
        const { data: ggExistente } = await supabase
          .from('gestores_gerais').select('id').eq('user_id', user.id).maybeSingle();
        let ggId = ggExistente?.id;
        if (!ggId) {
          const { data: gg, error: errGG } = await supabase
            .from('gestores_gerais')
            .insert({ user_id: user.id, nome: u.nome })
            .select('id').single();
          if (errGG) throw new Error(`Falha gestor_geral ${u.email}: ${errGG.message}`);
          ggId = gg!.id;
          log.push({ step: 'gestor_geral', email: u.email, acao: 'criado', id: ggId });
        }
        // Vínculo unidade
        const { data: vinc } = await supabase
          .from('gestores_gerais_unidades')
          .select('id').eq('gestor_geral_id', ggId).eq('unidade_id', unidadeId).maybeSingle();
        if (!vinc) {
          await supabase.from('gestores_gerais_unidades').insert({ gestor_geral_id: ggId, unidade_id: unidadeId });
          log.push({ step: 'vinculo_gg', gestor_geral_id: ggId, unidade_id: unidadeId, acao: 'criado' });
        }
      } else if (u.tipo === 'institucional' || u.tipo === 'gestor') {
        const { data: profExistente } = await supabase
          .from('profissionais').select('id').eq('user_id', user.id).maybeSingle();
        const perfilInst = u.tipo === 'gestor' ? 'gestor' : 'profissional';
        if (!profExistente) {
          const { error: errProf } = await supabase.from('profissionais').insert({
            user_id: user.id,
            nome: u.nome,
            unidade_id: unidadeId,
            perfil_institucional: perfilInst,
            plano: 'free',
          });
          if (errProf) throw new Error(`Falha profissional ${u.email}: ${errProf.message}`);
          log.push({ step: 'profissional', email: u.email, perfil: perfilInst, acao: 'criado' });
        } else {
          // Garantir unidade + perfil corretos
          await supabase.from('profissionais').update({
            unidade_id: unidadeId,
            perfil_institucional: perfilInst,
          }).eq('id', profExistente.id);
          log.push({ step: 'profissional', email: u.email, perfil: perfilInst, acao: 'atualizado' });
        }
      }

      credenciais.push({ email: u.email, senha: SENHA, perfil: u.tipo });
    }

    return new Response(JSON.stringify({ status: 'ok', credenciais, unidade_id: unidadeId, log }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ status: 'erro', mensagem: e.message, log }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
