import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    // Parse body
    const { paciente_id, consulta_id } = await req.json();
    if (!paciente_id || !consulta_id) {
      return new Response(JSON.stringify({ error: "paciente_id e consulta_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for full data access
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Dados do profissional
    const { data: profissional } = await supabaseAdmin
      .from("profissionais")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profissional) {
      return new Response(JSON.stringify({ error: "Profissional não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Dados do paciente
    const { data: paciente } = await supabaseAdmin
      .from("pacientes")
      .select("*")
      .eq("id", paciente_id)
      .single();

    if (!paciente) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Todas as consultas do paciente
    const { data: consultas } = await supabaseAdmin
      .from("consultas")
      .select("*")
      .eq("paciente_id", paciente_id)
      .order("numero_sequencial", { ascending: true });

    // 4. Consulta específica
    const consultaAtual = consultas?.find((c: any) => c.id === consulta_id);

    // 5. Exames de glicemia
    const { data: exames } = await supabaseAdmin
      .from("exames_glicemia")
      .select("*")
      .eq("paciente_id", paciente_id)
      .order("data_exame", { ascending: true });

    // 6. Arquivos da Base de Conhecimento (lista de nomes)
    const { data: arquivos } = await supabaseAdmin.storage
      .from("base-conhecimento")
      .list("", { limit: 100 });

    // 7. Calcular IG atual com base na DUM
    let igAtual = null;
    if (paciente.dum) {
      const dum = new Date(paciente.dum);
      const hoje = new Date();
      const diffMs = hoje.getTime() - dum.getTime();
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      igAtual = {
        semanas: Math.floor(diffDias / 7),
        dias: diffDias % 7,
        total_dias: diffDias,
      };
    }

    // 8. Laudos anteriores (se houver)
    const { data: laudosAnteriores } = await supabaseAdmin
      .from("laudos")
      .select("*")
      .eq("paciente_id", paciente_id)
      .neq("consulta_id", consulta_id)
      .order("created_at", { ascending: true });

    // Montar payload para o webhook
    const payload = {
      // Identificação da requisição
      timestamp: new Date().toISOString(),
      tipo_requisicao: "gerar_laudo",

      // Profissional
      profissional: {
        id: profissional.id,
        nome: profissional.nome,
        crm: profissional.crm,
        especialidade: profissional.especialidade,
        unidade_id: profissional.unidade_id,
      },

      // Paciente completo
      paciente: {
        ...paciente,
        ig_atual: igAtual,
      },

      // Consulta atual
      consulta_atual: consultaAtual,

      // Histórico de consultas
      historico_consultas: consultas,

      // Exames
      exames_glicemia: exames,

      // Laudos anteriores
      laudos_anteriores: laudosAnteriores,

      // Arquivos disponíveis na base de conhecimento
      arquivos_base_conhecimento: arquivos?.map((a: any) => ({
        nome: a.name,
        tamanho: a.metadata?.size,
        tipo: a.metadata?.mimetype,
      })),

      // Cenário clínico identificado
      cenario_clinico: consultaAtual?.cenario_clinico || paciente.status_ficha,
    };

    // Enviar ao webhook n8n
    const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: "Webhook URL não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Criar registro do laudo como "pendente"
    const { data: laudo, error: laudoError } = await supabaseAdmin
      .from("laudos")
      .insert({
        paciente_id,
        consulta_id,
        profissional_id: profissional.id,
        cenario_clinico: payload.cenario_clinico,
        status: "processando",
        metadata: payload,
      })
      .select()
      .single();

    if (laudoError) {
      return new Response(JSON.stringify({ error: "Erro ao criar laudo", details: laudoError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chamar webhook (síncrono — espera resposta)
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, laudo_id: laudo.id }),
    });

    if (!webhookResponse.ok) {
      // Atualizar status para erro
      await supabaseAdmin
        .from("laudos")
        .update({ status: "erro", metadata: { ...payload, erro: `Webhook retornou ${webhookResponse.status}` } })
        .eq("id", laudo.id);

      return new Response(JSON.stringify({ error: "Erro no webhook", status: webhookResponse.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado = await webhookResponse.json();

    // Atualizar laudo com o conteúdo retornado
    await supabaseAdmin
      .from("laudos")
      .update({
        conteudo_laudo: resultado.laudo || resultado.text || resultado.content || JSON.stringify(resultado),
        status: "gerado",
      })
      .eq("id", laudo.id);

    return new Response(JSON.stringify({
      success: true,
      laudo_id: laudo.id,
      conteudo: resultado.laudo || resultado.text || resultado.content || resultado,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro interno", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
