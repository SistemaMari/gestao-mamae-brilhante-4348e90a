// Edge function descartável: cria ambiente de demonstração do Painel do Gestor Geral.
// 1 gestor geral + 4 unidades cobrindo os 4 status (ativa/atencao/inativa/nao_iniciada).
// Idempotente: se a conta/unidade/paciente já existir, atualiza datas e relacionamentos.
// Protegida por header x-seed-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-seed-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SEED_SECRET = "dramari-seed-2026";
const SENHA_GESTOR = "MariDemo2026!";
const SENHA_PROF = "MariDemo2026!";

// ---------- Helpers ----------

function gerarCpfValido(): string {
  const rand9 = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const calcDV = (digs: number[]) => {
    const peso = digs.length + 1;
    const soma = digs.reduce((acc, d, i) => acc + d * (peso - i), 0);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const dv1 = calcDV(rand9);
  const dv2 = calcDV([...rand9, dv1]);
  return [...rand9, dv1, dv2].join("");
}

function diasAtras(d: number): Date {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x;
}
const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().split("T")[0];
function rand(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Spec das 4 unidades ----------

interface UnidadeSpec {
  nome: string;
  criadaDiasAtras: number;
  status: "ativa" | "atencao" | "inativa" | "nao_iniciada";
  gestor?: { email: string; nome: string; crm: string };
  profissionais: { email: string; nome: string; crm: string }[];
  pacientes: number;
  laudos: number;
  exames: number;
  partos: number;
  // Janela (em dias atrás) para distribuir created_at de pacientes/laudos/etc.
  ultimaAtividadeAlvo: number; // dias atrás onde fica o registro mais recente
  janelaAtividadeMin: number;
  janelaAtividadeMax: number;
}

const SLUG = (s: string) =>
  s.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

const UNIDADES: UnidadeSpec[] = [
  {
    nome: "UBS Demo Pinheiros",
    criadaDiasAtras: 90,
    status: "ativa",
    gestor: { email: "gestor.pinheiros.demo@mari.health", nome: "Dra. Ana Pinheiros", crm: "CRM-SP G-10000" },
    profissionais: [
      { email: "prof.pinheiros1.demo@mari.health", nome: "Dra. Demo Pinheiros 1", crm: "CRM-SP D-10001" },
      { email: "prof.pinheiros2.demo@mari.health", nome: "Dra. Demo Pinheiros 2", crm: "CRM-SP D-10002" },
      { email: "prof.pinheiros3.demo@mari.health", nome: "Dra. Demo Pinheiros 3", crm: "CRM-SP D-10003" },
    ],
    pacientes: 40,
    laudos: 25,
    exames: 30,
    partos: 3,
    ultimaAtividadeAlvo: 2,
    janelaAtividadeMin: 3,
    janelaAtividadeMax: 60,
  },
  {
    nome: "UBS Demo Moema",
    criadaDiasAtras: 80,
    status: "atencao",
    gestor: { email: "gestor.moema.demo@mari.health", nome: "Dr. Bruno Moema", crm: "CRM-SP G-20000" },
    profissionais: [
      { email: "prof.moema1.demo@mari.health", nome: "Dra. Demo Moema 1", crm: "CRM-SP D-20001" },
      { email: "prof.moema2.demo@mari.health", nome: "Dra. Demo Moema 2", crm: "CRM-SP D-20002" },
    ],
    pacientes: 15,
    laudos: 10,
    exames: 12,
    partos: 1,
    ultimaAtividadeAlvo: 40,
    janelaAtividadeMin: 41,
    janelaAtividadeMax: 80,
  },
  {
    nome: "UBS Demo Lapa",
    criadaDiasAtras: 70,
    status: "inativa",
    gestor: { email: "gestor.lapa.demo@mari.health", nome: "Dra. Carla Lapa", crm: "CRM-SP G-30000" },
    profissionais: [
      { email: "prof.lapa1.demo@mari.health", nome: "Dra. Demo Lapa 1", crm: "CRM-SP D-30001" },
    ],
    pacientes: 8,
    laudos: 5,
    exames: 5,
    partos: 0,
    ultimaAtividadeAlvo: 75,
    janelaAtividadeMin: 76,
    janelaAtividadeMax: 90,
  },
  {
    nome: "UBS Demo Vila Nova",
    criadaDiasAtras: 30,
    status: "nao_iniciada",
    profissionais: [],
    pacientes: 0,
    laudos: 0,
    exames: 0,
    partos: 0,
    ultimaAtividadeAlvo: 0,
    janelaAtividadeMin: 0,
    janelaAtividadeMax: 0,
  },
];

const CENARIOS_LAUDO = ["cenario_1", "cenario_6", "cenario_6b", "cenario_2", "cenario_3"];
const VIA_PARTO = ["vaginal", "cesarea"];
const RN_CLASS = ["AIG", "GIG", "PIG"];

// ---------- Função principal ----------

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

  // Buscar plano inicial (FK obrigatória em profissionais.plano_id)
  const { data: planoInicial } = await supabase
    .from("planos").select("id").eq("slug", "inicial").maybeSingle();
  const planoInicialId = planoInicial?.id;
  if (!planoInicialId) {
    return new Response(
      JSON.stringify({ error: "plano 'inicial' não encontrado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }


  try {
    // ---------- 1. Gestor Geral ----------
    const gestorEmail = "gestorgeral.demo@mari.health";
    let gestorUserId: string;

    const { data: created } = await supabase.auth.admin.createUser({
      email: gestorEmail,
      password: SENHA_GESTOR,
      email_confirm: true,
      user_metadata: { nome: "Dr. Demo Gestor Geral" },
    });
    if (created?.user) {
      gestorUserId = created.user.id;
      log.push(`✓ Gestor geral criado: ${gestorEmail}`);
    } else {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const ex = list?.users?.find((u) => u.email === gestorEmail);
      if (!ex) throw new Error(`não foi possível criar/encontrar ${gestorEmail}`);
      gestorUserId = ex.id;
      await supabase.auth.admin.updateUserById(ex.id, { password: SENHA_GESTOR });
      log.push(`↻ Gestor geral já existia, senha resetada`);
    }

    let gestorGeralId: string;
    const { data: ggExist } = await supabase
      .from("gestores_gerais").select("id").eq("user_id", gestorUserId).maybeSingle();
    if (ggExist) {
      gestorGeralId = ggExist.id;
    } else {
      const { data: ggNew, error: ggErr } = await supabase
        .from("gestores_gerais")
        .insert({ user_id: gestorUserId, nome: "Dr. Demo Gestor Geral" })
        .select("id").single();
      if (ggErr) throw ggErr;
      gestorGeralId = ggNew!.id;
      log.push(`✓ gestores_gerais criado`);
    }

    // ---------- 2. Contratante Demo Health ----------
    let contratanteId: string;
    const { data: contratExist } = await supabase
      .from("contratantes").select("id").eq("nome", "Demo Health").maybeSingle();
    if (contratExist) {
      contratanteId = contratExist.id;
      log.push(`↻ Contratante Demo Health já existia`);
    } else {
      const { data: c, error: cErr } = await supabase
        .from("contratantes")
        .insert({
          nome: "Demo Health",
          cnpj: "11.222.333/0001-44",
          razao_social: "Demo Health Demonstração LTDA",
          contato_nome: "Dr. Demo Gestor Geral",
          contato_email: gestorEmail,
          contato_telefone: "(11) 99999-0000",
          status: "ativo",
          data_inicio_contrato: isoDate(diasAtras(90)),
        })
        .select("id").single();
      if (cErr) throw cErr;
      contratanteId = c!.id;
      log.push(`✓ Contratante Demo Health criado`);
    }

    // ---------- 2.1 Vínculo gestor_geral <-> contratante ----------
    const { data: ggcExist } = await supabase
      .from("gestores_gerais_contratantes")
      .select("gestor_geral_id")
      .eq("gestor_geral_id", gestorGeralId)
      .eq("contratante_id", contratanteId)
      .maybeSingle();
    if (!ggcExist) {
      await supabase
        .from("gestores_gerais_contratantes")
        .insert({ gestor_geral_id: gestorGeralId, contratante_id: contratanteId });
      log.push(`✓ Vínculo gestor_geral_contratante criado`);
    } else {
      log.push(`↻ Vínculo gestor_geral_contratante já existia`);
    }

    // ---------- 3. Para cada unidade ----------
    for (const u of UNIDADES) {
      log.push(`--- ${u.nome} (${u.status}) ---`);
      const criadaEm = diasAtras(u.criadaDiasAtras);

      // upsert unidade
      let unidadeId: string;
      const { data: uExist } = await supabase
        .from("unidades").select("id").eq("nome", u.nome).maybeSingle();
      if (uExist) {
        unidadeId = uExist.id;
        await supabase.from("unidades")
          .update({ created_at: iso(criadaEm) }).eq("id", unidadeId);
      } else {
        const { data: uNew, error: uErr } = await supabase
          .from("unidades")
          .insert({
            nome: u.nome,
            tipo: "ubs",
            cidade: "São Paulo",
            estado: "SP",
            pais: "Brasil",
            ativa: true,
            plano_status: "ativo",
            contratante_id: contratanteId,
          })
          .select("id").single();
        if (uErr) throw uErr;
        unidadeId = uNew!.id;
        await supabase.from("unidades")
          .update({ created_at: iso(criadaEm) }).eq("id", unidadeId);
      }

      // vínculo gestor geral ↔ unidade
      const { data: vinc } = await supabase
        .from("gestores_gerais_unidades").select("id")
        .eq("gestor_geral_id", gestorGeralId).eq("unidade_id", unidadeId).maybeSingle();
      if (!vinc) {
        await supabase.from("gestores_gerais_unidades")
          .insert({ gestor_geral_id: gestorGeralId, unidade_id: unidadeId });
      }

      // profissionais da unidade
      const profIds: string[] = [];
      for (const p of u.profissionais) {
        let userId: string;
        const { data: pCreated } = await supabase.auth.admin.createUser({
          email: p.email, password: SENHA_PROF, email_confirm: true,
          user_metadata: { nome: p.nome },
        });
        if (pCreated?.user) {
          userId = pCreated.user.id;
        } else {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const ex = list?.users?.find((x) => x.email === p.email);
          if (!ex) { log.push(`  ✗ não criou ${p.email}`); continue; }
          userId = ex.id;
          await supabase.auth.admin.updateUserById(ex.id, { password: SENHA_PROF });
        }

        const dadosProf = {
          user_id: userId,
          nome: p.nome,
          crm: p.crm,
          especialidade: "Ginecologia e Obstetrícia",
          plano: "free",
          plano_id: planoInicialId,
          plano_status: "ativo",
          laudos_limite: 200,
          laudos_usados: 0,
          cidade: "São Paulo",
          estado: "SP",
          unidade_id: unidadeId,
          perfil_institucional: "institucional" as const,
          acesso_revogado: false,
        };
        const { data: profEx } = await supabase
          .from("profissionais").select("id").eq("user_id", userId).maybeSingle();
        let profId: string;
        if (profEx) {
          await supabase.from("profissionais").update(dadosProf).eq("id", profEx.id);
          profId = profEx.id;
        } else {
          const { data: profNew, error: pErr } = await supabase
            .from("profissionais").insert(dadosProf).select("id").single();
          if (pErr) { log.push(`  ✗ profissional ${p.email}: ${pErr.message}`); continue; }
          profId = profNew!.id;
        }
        profIds.push(profId);
      }
      log.push(`  ${profIds.length} profissionais`);

      // ---------- gestor da unidade (perfil_institucional='gestor') ----------
      if (u.gestor) {
        const g = u.gestor;
        let gUserId: string;
        const { data: gCreated } = await supabase.auth.admin.createUser({
          email: g.email, password: SENHA_PROF, email_confirm: true,
          user_metadata: { nome: g.nome },
        });
        if (gCreated?.user) {
          gUserId = gCreated.user.id;
        } else {
          const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const ex = list?.users?.find((x) => x.email === g.email);
          if (ex) {
            gUserId = ex.id;
            await supabase.auth.admin.updateUserById(ex.id, { password: SENHA_PROF });
          } else {
            log.push(`  ✗ não criou gestor ${g.email}`);
            gUserId = "";
          }
        }
        if (gUserId) {
          const dadosGestor = {
            user_id: gUserId, nome: g.nome, crm: g.crm,
            especialidade: "Ginecologia e Obstetrícia",
            plano: "free", plano_id: planoInicialId, plano_status: "ativo",
            laudos_limite: 200, laudos_usados: 0,
            cidade: "São Paulo", estado: "SP",
            unidade_id: unidadeId,
            perfil_institucional: "gestor" as const,
            acesso_revogado: false,
          };
          const { data: gEx } = await supabase
            .from("profissionais").select("id").eq("user_id", gUserId).maybeSingle();
          if (gEx) {
            await supabase.from("profissionais").update(dadosGestor).eq("id", gEx.id);
          } else {
            await supabase.from("profissionais").insert(dadosGestor);
          }
          log.push(`  + gestor da unidade: ${g.nome}`);
        }
      }

      if (profIds.length === 0 && u.pacientes === 0) continue;

      // ---------- pacientes / atendimentos / laudos / exames / partos ----------
      // Idempotência: deletar tudo do "pool demo" da unidade e recriar.
      // Pacientes Demo são identificados por nome com prefixo "Demo {nome unidade}".
      const prefixoPaciente = `Demo ${u.nome.replace("UBS ", "")}`;

      const { data: pacExist } = await supabase
        .from("pacientes").select("id").eq("unidade_id", unidadeId)
        .ilike("nome", `${prefixoPaciente}%`);
      const pacExistIds = (pacExist ?? []).map((x) => x.id);

      if (pacExistIds.length > 0) {
        // limpar dependentes (não tem CASCADE nessas tabelas)
        await supabase.from("laudos").delete().in("paciente_id", pacExistIds);
        await supabase.from("exames_glicemia").delete().in("paciente_id", pacExistIds);
        await supabase.from("partos").delete().in("paciente_id", pacExistIds);
        await supabase.from("registros_atendimento").delete().in("paciente_id", pacExistIds);
        await supabase.from("consultas").delete().in("paciente_id", pacExistIds);
        await supabase.from("pacientes").delete().in("id", pacExistIds);
        log.push(`  ↻ ${pacExistIds.length} pacientes antigos removidos`);
      }

      if (u.pacientes === 0) continue;

      // Criar pacientes distribuídos
      const pacIds: { id: string; profId: string; createdAt: Date }[] = [];
      for (let i = 0; i < u.pacientes; i++) {
        const profId = profIds[i % profIds.length];
        const dias = rand(u.janelaAtividadeMin, u.janelaAtividadeMax);
        const created = diasAtras(dias);
        const dumDias = rand(60, 240); // gestante ativa nos últimos 280d
        const { data: pNew, error: pErr } = await supabase
          .from("pacientes")
          .insert({
            nome: `${prefixoPaciente} Paciente ${i + 1}`,
            profissional_id: profId,
            unidade_id: unidadeId,
            tipo_identificacao: "cpf",
            numero_identificacao: gerarCpfValido(),
            data_nascimento: "1992-06-10",
            cidade: "São Paulo", estado: "SP", pais: "Brasil",
            dum: isoDate(diasAtras(dumDias)),
            status_ficha: "concluido",
            is_rascunho: false,
          })
          .select("id").single();
        if (pErr || !pNew) { log.push(`  ✗ paciente: ${pErr?.message}`); continue; }
        await supabase.from("pacientes").update({ created_at: iso(created) }).eq("id", pNew.id);
        pacIds.push({ id: pNew.id, profId, createdAt: created });

        // 1 registro_atendimento ao criar
        await supabase.from("registros_atendimento").insert({
          paciente_id: pNew.id, profissional_id: profId, unidade_id: unidadeId,
          tipo_operacao: "criar_ficha",
          profissional_nome: u.profissionais[profIds.indexOf(profId)]?.nome ?? "Demo",
          profissional_crm: u.profissionais[profIds.indexOf(profId)]?.crm ?? null,
          profissional_especialidade: "Ginecologia e Obstetrícia",
        }).then(async ({ data }) => {
          // Update created_at do registro
          await supabase.from("registros_atendimento")
            .update({ created_at: iso(created) })
            .eq("paciente_id", pNew.id).eq("tipo_operacao", "criar_ficha");
        });
      }
      log.push(`  ${pacIds.length} pacientes`);

      // Laudos — distribuir, e cravar pelo menos 1 no `ultimaAtividadeAlvo`
      const datasLaudo: Date[] = [];
      for (let i = 0; i < u.laudos; i++) {
        const dias = i === 0
          ? u.ultimaAtividadeAlvo
          : rand(u.ultimaAtividadeAlvo + 1, u.janelaAtividadeMax);
        datasLaudo.push(diasAtras(dias));
      }

      for (let i = 0; i < u.laudos; i++) {
        const pac = pacIds[i % pacIds.length];
        const cenario = pick(CENARIOS_LAUDO);
        const dataLaudo = datasLaudo[i];

        const { data: cons, error: cErr } = await supabase
          .from("consultas").insert({
            paciente_id: pac.id, profissional_id: pac.profId,
            tipo: "consulta_1", numero_sequencial: 1,
            data: isoDate(dataLaudo),
            ig_semanas: rand(8, 32), ig_dias: rand(0, 6),
            cenario_clinico: cenario, status_gerado: "gerado",
            is_rascunho: false,
          }).select("id").single();
        if (cErr || !cons) continue;
        await supabase.from("consultas").update({ created_at: iso(dataLaudo) }).eq("id", cons.id);

        const { data: lNew } = await supabase.from("laudos").insert({
          paciente_id: pac.id, consulta_id: cons.id, profissional_id: pac.profId,
          conteudo_laudo: `Laudo demo — ${cenario}`,
          status: "concluido", cenario_clinico: cenario,
          metadata: { gerado_por: "seed-demo", origem: "demo-gestor-geral" },
        }).select("id").single();
        if (lNew) {
          await supabase.from("laudos")
            .update({ created_at: iso(dataLaudo), updated_at: iso(dataLaudo) })
            .eq("id", lNew.id);
        }

        // registro_atendimento do laudo
        await supabase.from("registros_atendimento").insert({
          paciente_id: pac.id, profissional_id: pac.profId, unidade_id: unidadeId,
          tipo_operacao: "gerar_laudo",
          recurso_id: lNew?.id ?? null, recurso_tipo: "laudo",
          profissional_nome: u.profissionais[profIds.indexOf(pac.profId)]?.nome ?? "Demo",
          profissional_crm: u.profissionais[profIds.indexOf(pac.profId)]?.crm ?? null,
          profissional_especialidade: "Ginecologia e Obstetrícia",
        });
        // o created_at default = now() — atualizar
        await supabase.from("registros_atendimento")
          .update({ created_at: iso(dataLaudo) })
          .eq("paciente_id", pac.id).eq("tipo_operacao", "gerar_laudo")
          .eq("recurso_id", lNew?.id ?? "");
      }
      log.push(`  ${u.laudos} laudos`);

      // Exames de glicemia
      for (let i = 0; i < u.exames; i++) {
        const pac = pacIds[i % pacIds.length];
        const dias = rand(u.ultimaAtividadeAlvo, u.janelaAtividadeMax);
        const dataExame = diasAtras(dias);
        const tipo = pick(["plasmatica", "gtt"]);
        const valor = tipo === "gtt" ? rand(110, 180) : rand(75, 105);
        const { data: ex } = await supabase.from("exames_glicemia").insert({
          paciente_id: pac.id, profissional_id: pac.profId,
          consulta_id: pac.id, // fallback — não há FK
          tipo_exame: tipo, valor_mgdl: valor,
          data_exame: isoDate(dataExame),
          ig_semanas_na_data: rand(8, 32), ig_dias_na_data: rand(0, 6),
        }).select("id").single();
        if (ex) {
          await supabase.from("exames_glicemia")
            .update({ created_at: iso(dataExame) }).eq("id", ex.id);
        }
      }
      if (u.exames > 0) log.push(`  ${u.exames} exames`);

      // Partos
      for (let i = 0; i < u.partos; i++) {
        const pac = pacIds[i % pacIds.length];
        const dias = rand(u.ultimaAtividadeAlvo, u.janelaAtividadeMax);
        const dataParto = diasAtras(dias);
        const { data: pt } = await supabase.from("partos").insert({
          paciente_id: pac.id, profissional_id: pac.profId, unidade_id: unidadeId,
          data_parto: isoDate(dataParto),
          via_parto: pick(VIA_PARTO),
          classificacao_rn: pick(RN_CLASS),
          peso_rn_g: rand(2500, 4200),
          ig_parto_semanas: rand(36, 41),
          ig_parto_dias: rand(0, 6),
          intercorrencia_materna: false,
          intercorrencia_neonatal: false,
          is_rascunho: false,
        }).select("id").single();
        if (pt) {
          await supabase.from("partos")
            .update({ created_at: iso(dataParto), updated_at: iso(dataParto) })
            .eq("id", pt.id);
        }
      }
      if (u.partos > 0) log.push(`  ${u.partos} partos`);
    }

    // ---------- 4. Refresh inicial da MV (sem CONCURRENTLY) ----------
    const { error: refreshErr } = await supabase.rpc("refresh_mv_metricas_unidade_seed");
    if (refreshErr) log.push(`⚠ refresh MV falhou: ${refreshErr.message}`);
    else log.push(`✓ MV refrescada`);

    return new Response(
      JSON.stringify({
        sucesso: true,
        gestor: { email: gestorEmail, senha: SENHA_GESTOR },
        senha_profissionais: SENHA_PROF,
        log,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e), log }, null, 2),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
