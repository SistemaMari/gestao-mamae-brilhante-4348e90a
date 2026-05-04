// Edge Function: admin-metrics
// Prompt 23A — exposição segura das views materializadas do dashboard admin.
// - Valida JWT em código (verify_jwt = false no config)
// - Valida que o usuário é admin (via tabela `admins`)
// - Whitelist do parâmetro `view` (8 nomes permitidos)
// - Loga toda chamada em admin_access_log
// - Cache-Control: 300s para views horárias, 60s para alertas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Mapeia o slug recebido pra nome real da MV. Whitelist rígida.
const VIEW_MAP: Record<string, { table: string; cacheSeconds: number }> = {
  resumo_global:                  { table: "mv_admin_resumo_global",                  cacheSeconds: 300 },
  distribuicao_geografica:        { table: "mv_admin_distribuicao_geografica",        cacheSeconds: 300 },
  top_cidades:                    { table: "mv_admin_top_cidades",                    cacheSeconds: 300 },
  unidades_resumo:                { table: "mv_admin_unidades_resumo",                cacheSeconds: 300 },
  profissionais_por_plano:        { table: "mv_admin_profissionais_por_plano",        cacheSeconds: 300 },
  evolucao_mensal_planos:         { table: "mv_admin_evolucao_mensal_planos",         cacheSeconds: 300 },
  evolucao_mensal_profissionais:  { table: "mv_admin_evolucao_mensal_profissionais",  cacheSeconds: 300 },
  alertas_operacionais:           { table: "mv_admin_alertas_operacionais",           cacheSeconds: 60  },
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface LogEntry {
  admin_id: string;
  view_consultada: string;
  pais_filtro: string | null;
  ip: string | null;
  user_agent: string | null;
  status_code: number;
}

async function logAccess(entry: LogEntry): Promise<void> {
  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    await admin.from("admin_access_log").insert(entry);
  } catch (err) {
    console.error("[admin-metrics] falha ao registrar log:", err);
  }
}

function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  // 1. Auth header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: missing bearer token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 2. Valida JWT — exige token com `sub` (usuário real, não anon)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  let userId: string | null = null;
  try {
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: invalid or anonymous token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    userId = userData.user.id;
  } catch (err) {
    console.error("[admin-metrics] getUser threw:", err);
    return new Response(
      JSON.stringify({ error: "Unauthorized: token verification failed" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 3. Parse params
  const url = new URL(req.url);
  let viewParam = url.searchParams.get("view");
  let paisFilter = url.searchParams.get("pais");
  if (!viewParam && (req.method === "POST")) {
    try {
      const body = await req.json();
      viewParam = body?.view ?? null;
      paisFilter = body?.pais ?? paisFilter;
    } catch { /* ignore */ }
  }

  // 4. Whitelist do parâmetro view
  const viewConfig = viewParam ? VIEW_MAP[viewParam] : undefined;
  if (!viewParam || !viewConfig) {
    return new Response(
      JSON.stringify({
        error: "Bad Request: invalid view",
        allowed: Object.keys(VIEW_MAP),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 5. Resolve admin (tabela `admins` por user_id)
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: adminRow, error: adminErr } = await adminClient
    .from("admins")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminErr) {
    console.error("[admin-metrics] erro ao consultar admins:", adminErr);
    return new Response(
      JSON.stringify({ error: "Internal error checking admin role" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!adminRow) {
    // Logamos com profissional_id se existir (FK exige profissional). Se não existir, pulamos log.
    const { data: profRow } = await adminClient
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (profRow?.id) {
      await logAccess({
        admin_id: profRow.id,
        view_consultada: viewParam,
        pais_filtro: paisFilter,
        ip,
        user_agent: userAgent,
        status_code: 403,
      });
    }
    return new Response(
      JSON.stringify({ error: "Forbidden: admin role required" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // FK de admin_access_log aponta pra profissionais(id), então buscamos o profissional do admin
  const { data: profRow } = await adminClient
    .from("profissionais")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  const adminProfissionalId = profRow?.id ?? null;

  // 6. Lê a MV (service_role tem acesso, REVOKE foi feito apenas pra authenticated/anon)
  let query = adminClient.from(viewConfig.table).select("*");
  if (paisFilter && (viewParam === "distribuicao_geografica")) {
    query = query.eq("pais", paisFilter);
  }
  const { data: rows, error: queryErr } = await query;

  if (queryErr) {
    console.error("[admin-metrics] erro lendo MV:", queryErr);
    if (adminProfissionalId) {
      await logAccess({
        admin_id: adminProfissionalId,
        view_consultada: viewParam,
        pais_filtro: paisFilter,
        ip,
        user_agent: userAgent,
        status_code: 500,
      });
    }
    return new Response(
      JSON.stringify({ error: "Failed to read materialized view", detail: queryErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // 7. Log de sucesso
  if (adminProfissionalId) {
    await logAccess({
      admin_id: adminProfissionalId,
      view_consultada: viewParam,
      pais_filtro: paisFilter,
      ip,
      user_agent: userAgent,
      status_code: 200,
    });
  }

  return new Response(
    JSON.stringify({ view: viewParam, rows, count: rows?.length ?? 0 }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${viewConfig.cacheSeconds}`,
      },
    },
  );
});
