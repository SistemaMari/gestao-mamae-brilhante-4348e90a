import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { unidade_id, email_convidado, convidado_por } = await req.json();

    if (!unidade_id || !email_convidado || !convidado_por) {
      return new Response(JSON.stringify({ status: "erro", mensagem: "Campos obrigatórios faltando." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Check if email is already linked to this unit
    const { data: existing } = await supabaseAdmin
      .from("profissionais")
      .select("id")
      .eq("unidade_id", unidade_id)
      .ilike("nome", "%") // just to query, we need email from auth
      .limit(1000);

    // Check via auth users
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email_convidado.toLowerCase());
    
    if (authUser) {
      const { data: prof } = await supabaseAdmin
        .from("profissionais")
        .select("id, unidade_id")
        .eq("user_id", authUser.id)
        .maybeSingle();
      
      if (prof && prof.unidade_id === unidade_id) {
        return new Response(JSON.stringify({ status: "ja_vinculado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Check pending invite
    const { data: pendingInvite } = await supabaseAdmin
      .from("convites")
      .select("id")
      .eq("unidade_id", unidade_id)
      .eq("email_convidado", email_convidado.toLowerCase())
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (pendingInvite) {
      return new Response(JSON.stringify({ status: "convite_pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Generate token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();

    // 4. Insert invite
    const { error: insertError } = await supabaseAdmin.from("convites").insert({
      unidade_id,
      email_convidado: email_convidado.toLowerCase(),
      token,
      status: "pendente",
      convidado_por,
    });

    if (insertError) {
      return new Response(JSON.stringify({ status: "erro", mensagem: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Get unit name for the email
    const { data: unidade } = await supabaseAdmin
      .from("unidades")
      .select("nome")
      .eq("id", unidade_id)
      .single();

    // Email sending placeholder - developer will integrate actual email service
    console.log(`[CONVITE] Email would be sent to ${email_convidado} with token ${token} for unit ${unidade?.nome}`);

    return new Response(JSON.stringify({ status: "enviado", token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ status: "erro", mensagem: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
