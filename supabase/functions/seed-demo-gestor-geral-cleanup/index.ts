// Edge function descartável: remove todo o ambiente de demonstração criado pela
// seed-demo-gestor-geral. Identifica artefatos pelo prefixo "Demo " e pelos
// emails @mari.health da seed.
// Protegida por header x-seed-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-seed-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEED_SECRET = "dramari-seed-2026";

const EMAILS_DEMO = [
  "gestorgeral.demo@mari.health",
  "prof.pinheiros1.demo@mari.health",
  "prof.pinheiros2.demo@mari.health",
  "prof.pinheiros3.demo@mari.health",
  "prof.moema1.demo@mari.health",
  "prof.moema2.demo@mari.health",
  "prof.lapa1.demo@mari.health",
];

const UNIDADES_DEMO = [
  "UBS Demo Pinheiros",
  "UBS Demo Moema",
  "UBS Demo Lapa",
  "UBS Demo Vila Nova",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.headers.get("x-seed-secret") !== SEED_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const log: string[] = [];

  try {
    // 1. Encontrar unidades demo
    const { data: unidades } = await supabase
      .from("unidades").select("id, nome").in("nome", UNIDADES_DEMO);
    const unidadeIds = (unidades ?? []).map((u) => u.id);
    log.push(`Unidades demo: ${unidadeIds.length}`);

    if (unidadeIds.length > 0) {
      // 2. Pacientes dessas unidades com prefixo "Demo "
      const { data: pacs } = await supabase
        .from("pacientes").select("id").in("unidade_id", unidadeIds)
        .ilike("nome", "Demo %");
      const pacIds = (pacs ?? []).map((p) => p.id);
      log.push(`Pacientes demo: ${pacIds.length}`);

      if (pacIds.length > 0) {
        await supabase.from("laudos").delete().in("paciente_id", pacIds);
        await supabase.from("exames_glicemia").delete().in("paciente_id", pacIds);
        await supabase.from("partos").delete().in("paciente_id", pacIds);
        await supabase.from("registros_atendimento").delete().in("paciente_id", pacIds);
        await supabase.from("consultas").delete().in("paciente_id", pacIds);
        await supabase.from("pacientes").delete().in("id", pacIds);
        log.push(`✓ pacientes + dependentes removidos`);
      }

      // 3. Profissionais das unidades demo
      const { data: profs } = await supabase
        .from("profissionais").select("id, user_id").in("unidade_id", unidadeIds);
      const profIds = (profs ?? []).map((p) => p.id);
      if (profIds.length > 0) {
        await supabase.from("profissionais").delete().in("id", profIds);
        log.push(`✓ ${profIds.length} profissionais removidos`);
      }

      // 4. Vínculos gestor geral ↔ unidade
      await supabase.from("gestores_gerais_unidades").delete().in("unidade_id", unidadeIds);

      // 5. Unidades
      await supabase.from("unidades").delete().in("id", unidadeIds);
      log.push(`✓ ${unidadeIds.length} unidades removidas`);
    }

    // 6. Gestor geral demo
    const { data: gestorList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const usersDemo = (gestorList?.users ?? []).filter((u) => EMAILS_DEMO.includes(u.email ?? ""));
    for (const u of usersDemo) {
      // remover registros profissionais residuais
      await supabase.from("profissionais").delete().eq("user_id", u.id);
      await supabase.from("gestores_gerais").delete().eq("user_id", u.id);
      await supabase.from("user_roles").delete().eq("user_id", u.id);
      await supabase.auth.admin.deleteUser(u.id);
    }
    log.push(`✓ ${usersDemo.length} usuários demo deletados`);

    // 7. Contratante Demo Health
    await supabase.from("contratantes").delete().eq("nome", "Demo Health");
    log.push(`✓ contratante Demo Health removido`);

    // 8. Refresh MV
    await supabase.rpc("refresh_mv_metricas_unidade_seed");

    return new Response(
      JSON.stringify({ sucesso: true, log }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e), log }, null, 2),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
