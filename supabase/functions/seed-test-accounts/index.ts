// Edge function descartável: cria 6 contas de teste + unidade + dados fictícios.
// Idempotente: se a conta já existir, pula. Protegida por header x-seed-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-seed-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEED_SECRET = Deno.env.get("SEED_SECRET") ?? "";
const SENHA_PADRAO = "Teste@2026";

interface ContaSpec {
  email: string;
  nome: string;
  perfil: "consultorio_pro" | "consultorio_free" | "institucional" | "institucional2" | "gestor" | "gestor_geral" | "admin";
}

const CONTAS: ContaSpec[] = [
  { email: "consultorio@teste.dramari", nome: "Dra. Consultório Pro", perfil: "consultorio_pro" },
  { email: "consultorio.free@teste.dramari", nome: "Dra. Consultório Free", perfil: "consultorio_free" },
  { email: "institucional@teste.dramari", nome: "Dr. Institucional Teste", perfil: "institucional" },
  { email: "institucional2@teste.dramari", nome: "Dra. Institucional Dois", perfil: "institucional2" },
  { email: "gestor@teste.dramari", nome: "Dr. Gestor Unidade", perfil: "gestor" },
  { email: "gestorgeral@teste.dramari", nome: "Dr. Gestor Geral", perfil: "gestor_geral" },
  { email: "admin@teste.dramari", nome: "Admin Teste", perfil: "admin" },
];

const LAUDO_TEM_DMG = `# Laudo Diagnóstico — DMG

**Paciente**: Paciente A Teste
**Data**: ${new Date().toISOString().split("T")[0]}

## Bloco 1 — Conclusão Diagnóstica

A paciente **TEM** Diabete Mellitus Gestacional (DMG).

## Bloco 2 — Justificativa

Glicemia de jejum de 98 mg/dL na primeira consulta, acima do ponto de corte de 92 mg/dL preconizado pelos critérios IADPSG/OMS para diagnóstico de DMG no primeiro trimestre.

## Bloco 3 — Conduta

- Iniciar orientação nutricional com nutricionista
- Iniciar automonitorização glicêmica (perfil de 4 pontos)
- Reavaliação em 2 semanas para definir necessidade de insulinoterapia
- Manter acompanhamento pré-natal de alto risco
`;

const LAUDO_NAO_TEM_DMG = `# Laudo Diagnóstico — DMG

**Paciente**: Paciente B Teste
**Data**: ${new Date().toISOString().split("T")[0]}

## Bloco 1 — Conclusão Diagnóstica

A paciente **NÃO TEM** Diabete Mellitus Gestacional (DMG).

## Bloco 2 — Justificativa

TOTG 75g realizado entre 24-28 semanas com valores normais: jejum 78 mg/dL, 1h 145 mg/dL, 2h 110 mg/dL — todos abaixo dos pontos de corte IADPSG.

## Bloco 3 — Conduta

- Manter pré-natal de risco habitual
- Reforçar hábitos alimentares saudáveis
- Não há indicação de monitorização glicêmica adicional
`;

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
  const ids: Record<string, string> = {};

  // 1. Criar usuários
  for (const c of CONTAS) {
    // Tentar criar; se já existir, buscar
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: c.email,
      password: SENHA_PADRAO,
      email_confirm: true,
      user_metadata: { nome: c.nome },
    });

    if (created?.user) {
      ids[c.perfil] = created.user.id;
      log.push(`✓ Criado: ${c.email}`);
    } else {
      // Já existe — buscar por listagem
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => u.email === c.email);
      if (existing) {
        ids[c.perfil] = existing.id;
        // Resetar senha para o padrão
        await supabase.auth.admin.updateUserById(existing.id, { password: SENHA_PADRAO });
        log.push(`↻ Já existia, senha resetada: ${c.email}`);
      } else {
        log.push(`✗ Erro: ${c.email} — ${createErr?.message}`);
      }
    }
  }

  // 2. Unidade fictícia (idempotente por nome)
  let unidadeId: string;
  const { data: unidadeExist } = await supabase
    .from("unidades")
    .select("id")
    .eq("nome", "Hospital Teste DMG")
    .maybeSingle();

  if (unidadeExist) {
    unidadeId = unidadeExist.id;
    log.push(`↻ Unidade já existia: Hospital Teste DMG`);
  } else {
    const { data: novaUnidade, error: uErr } = await supabase
      .from("unidades")
      .insert({
        nome: "Hospital Teste DMG",
        tipo: "hospital",
        cidade: "São Paulo",
        estado: "SP",
        pais: "Brasil",
        ativa: true,
        plano_status: "ativo",
      })
      .select("id")
      .single();
    if (uErr || !novaUnidade) {
      return new Response(JSON.stringify({ error: "unidade_fail", detail: uErr, log }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    unidadeId = novaUnidade.id;
    log.push(`✓ Unidade criada: Hospital Teste DMG`);
  }

  // 3. Profissionais (consultorio pro, consultorio free, institucional, gestor)
  // Helper upsert profissional por user_id
  const upsertProf = async (userId: string, dados: Record<string, unknown>) => {
    const { data: exist } = await supabase
      .from("profissionais")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (exist) {
      await supabase.from("profissionais").update(dados).eq("id", exist.id);
      return exist.id as string;
    }
    const { data: novo, error: insErr } = await supabase
      .from("profissionais")
      .insert({ user_id: userId, ...dados })
      .select("id")
      .single();
    if (insErr || !novo) {
      throw new Error(`profissionais insert falhou para ${userId}: ${JSON.stringify(insErr)}`);
    }
    return novo.id as string;
  };

  const profProId = await upsertProf(ids.consultorio_pro, {
    nome: "Dra. Consultório Pro",
    crm: "CRM-SP 123456",
    especialidade: "Ginecologia e Obstetrícia",
    plano: "pro",
    plano_status: "ativo",
    laudos_limite: 100,
    laudos_usados: 1,
    cidade: "São Paulo",
    estado: "SP",
    unidade_id: null,
    perfil_institucional: null,
  });
  log.push(`✓ Profissional Consultório Pro: ${profProId}`);

  const profFreeId = await upsertProf(ids.consultorio_free, {
    nome: "Dra. Consultório Free",
    crm: "CRM-SP 654321",
    especialidade: "Endocrinologia",
    plano: "free",
    plano_status: "ativo",
    laudos_limite: 3,
    laudos_usados: 0,
    cidade: "São Paulo",
    estado: "SP",
    unidade_id: null,
    perfil_institucional: null,
  });
  log.push(`✓ Profissional Consultório Free: ${profFreeId}`);

  const profInstId = await upsertProf(ids.institucional, {
    nome: "Dr. Institucional Teste",
    crm: "CRM-SP 222222",
    especialidade: "Ginecologia e Obstetrícia",
    plano: "pro",
    plano_status: "ativo",
    laudos_limite: 100,
    laudos_usados: 0,
    cidade: "São Paulo",
    estado: "SP",
    unidade_id: unidadeId,
    perfil_institucional: "institucional",
  });
  log.push(`✓ Profissional Institucional: ${profInstId}`);

  const profInst2Id = await upsertProf(ids.institucional2, {
    nome: "Dra. Institucional Dois",
    crm: "CRM-SP 444444",
    especialidade: "Endocrinologia",
    plano: "free",
    plano_id: "6df9eecf-82f1-44e5-9637-5f62052d02c8",
    plano_status: "ativo",
    laudos_limite: 100,
    laudos_usados: 0,
    cidade: "São Paulo",
    estado: "SP",
    unidade_id: unidadeId,
    perfil_institucional: "institucional",
  });
  log.push(`✓ Profissional Institucional 2: ${profInst2Id}`);

  const profGestorId = await upsertProf(ids.gestor, {
    nome: "Dr. Gestor Unidade",
    crm: "CRM-SP 333333",
    especialidade: "Ginecologia e Obstetrícia",
    plano: "pro",
    plano_status: "ativo",
    laudos_limite: 100,
    laudos_usados: 0,
    cidade: "São Paulo",
    estado: "SP",
    unidade_id: unidadeId,
    perfil_institucional: "gestor",
  });
  log.push(`✓ Profissional Gestor: ${profGestorId}`);

  // 4. Gestor geral
  const { data: ggExist } = await supabase
    .from("gestores_gerais")
    .select("id")
    .eq("user_id", ids.gestor_geral)
    .maybeSingle();
  let gestorGeralId: string;
  if (ggExist) {
    gestorGeralId = ggExist.id;
    log.push(`↻ Gestor geral já existia`);
  } else {
    const { data: ggNovo } = await supabase
      .from("gestores_gerais")
      .insert({ user_id: ids.gestor_geral, nome: "Dr. Gestor Geral" })
      .select("id")
      .single();
    gestorGeralId = ggNovo!.id;
    log.push(`✓ Gestor geral criado`);
  }

  // Vínculo gestor geral ↔ unidade (idempotente)
  const { data: vincExist } = await supabase
    .from("gestores_gerais_unidades")
    .select("id")
    .eq("gestor_geral_id", gestorGeralId)
    .eq("unidade_id", unidadeId)
    .maybeSingle();
  if (!vincExist) {
    await supabase
      .from("gestores_gerais_unidades")
      .insert({ gestor_geral_id: gestorGeralId, unidade_id: unidadeId });
    log.push(`✓ Vínculo gestor geral ↔ unidade`);
  }

  // 5. Admin
  const { data: adminExist } = await supabase
    .from("admins")
    .select("id")
    .eq("user_id", ids.admin)
    .maybeSingle();
  if (!adminExist) {
    await supabase.from("admins").insert({ user_id: ids.admin, nome: "Admin Teste" });
    log.push(`✓ Admin criado`);
  } else {
    log.push(`↻ Admin já existia`);
  }

  // 6. Pacientes + consultas + laudos (apenas se ainda não existirem por nome)
  const criarPacienteCompleto = async (config: {
    nome: string;
    profissionalId: string;
    unidadeIdPaciente: string | null;
    statusFicha: string;
    cenario: string | null;
    laudoConteudo: string | null;
    glicemia: number | null;
  }) => {
    const { data: pExist } = await supabase
      .from("pacientes")
      .select("id")
      .eq("nome", config.nome)
      .eq("profissional_id", config.profissionalId)
      .maybeSingle();
    if (pExist) return pExist.id;

    const { data: novoPac } = await supabase
      .from("pacientes")
      .insert({
        nome: config.nome,
        profissional_id: config.profissionalId,
        unidade_id: config.unidadeIdPaciente,
        status_ficha: config.statusFicha,
        cidade: "São Paulo",
        estado: "SP",
        pais: "Brasil",
        data_nascimento: "1990-05-15",
        is_rascunho: false,
      })
      .select("id")
      .single();
    if (!novoPac) return null;

    if (config.laudoConteudo && config.cenario) {
      const { data: consulta } = await supabase
        .from("consultas")
        .insert({
          paciente_id: novoPac.id,
          profissional_id: config.profissionalId,
          tipo: "consulta_1",
          numero_sequencial: 1,
          data: new Date().toISOString().split("T")[0],
          ig_semanas: 12,
          ig_dias: 3,
          cenario_clinico: config.cenario,
          status_gerado: "gerado",
          is_rascunho: false,
        })
        .select("id")
        .single();

      if (consulta && config.glicemia) {
        await supabase.from("exames_glicemia").insert({
          consulta_id: consulta.id,
          paciente_id: novoPac.id,
          profissional_id: config.profissionalId,
          valor_mgdl: config.glicemia,
          tipo_exame: "plasmatica",
          data_exame: new Date().toISOString().split("T")[0],
          ig_semanas_na_data: 12,
          ig_dias_na_data: 3,
        });
      }

      if (consulta) {
        await supabase.from("laudos").insert({
          paciente_id: novoPac.id,
          consulta_id: consulta.id,
          profissional_id: config.profissionalId,
          conteudo_laudo: config.laudoConteudo,
          status: "concluido",
          cenario_clinico: config.cenario,
          metadata: { gerado_por: "seed", versao_prompt: "v5.2" },
        });
      }
    }

    return novoPac.id;
  };

  await criarPacienteCompleto({
    nome: "Paciente A Teste",
    profissionalId: profInstId,
    unidadeIdPaciente: unidadeId,
    statusFicha: "concluido",
    cenario: "ficha_a_gj_alterada",
    laudoConteudo: LAUDO_TEM_DMG,
    glicemia: 98,
  });
  log.push(`✓ Paciente A (TEM DMG) — unidade`);

  await criarPacienteCompleto({
    nome: "Paciente B Teste",
    profissionalId: profInstId,
    unidadeIdPaciente: unidadeId,
    statusFicha: "concluido",
    cenario: "ficha_b_totg_normal",
    laudoConteudo: LAUDO_NAO_TEM_DMG,
    glicemia: 78,
  });
  log.push(`✓ Paciente B (NÃO TEM DMG) — unidade`);

  await criarPacienteCompleto({
    nome: "Paciente C Teste",
    profissionalId: profInstId,
    unidadeIdPaciente: unidadeId,
    statusFicha: "aguardando_gj",
    cenario: null,
    laudoConteudo: null,
    glicemia: null,
  });
  log.push(`✓ Paciente C (rascunho) — unidade`);

  await criarPacienteCompleto({
    nome: "Maria Consultório Teste",
    profissionalId: profProId,
    unidadeIdPaciente: null,
    statusFicha: "concluido",
    cenario: "ficha_a_gj_alterada",
    laudoConteudo: LAUDO_TEM_DMG.replace("Paciente A Teste", "Maria Consultório Teste"),
    glicemia: 95,
  });
  log.push(`✓ Paciente Maria — consultório pro`);

  return new Response(
    JSON.stringify(
      {
        sucesso: true,
        senha_padrao: SENHA_PADRAO,
        contas: CONTAS.map((c) => ({ email: c.email, perfil: c.perfil })),
        log,
      },
      null,
      2,
    ),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
