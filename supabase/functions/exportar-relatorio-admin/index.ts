// Edge Function: exportar-relatorio-admin
// Gera relatórios administrativos AGREGADOS (xlsx ou pdf), salva no bucket
// privado `exportacoes-admin` e devolve uma signed URL de 1h.
//
// Privacidade: nenhuma query desta função retorna dados individuais de pacientes.
// Apenas contagens, médias e distribuições populacionais.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const FORMATOS_VALIDOS = new Set(["xlsx", "pdf"]);
const CONTEUDOS_VALIDOS = new Set([
  "usuarios",
  "diagnosticos",
  "completo",
  "profissionais_por_estado",
  "dmg_por_estado",
  "dmg_por_cidade",
  "metricas_por_unidade",
  "funil_tratamento",
  "desfechos_perinatais",
]);

interface Filtros {
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
  pais?: string | null;
  estado?: string | null;
  cidade?: string | null;
  tipo_conta?: "consultorio" | "institucional" | null;
  unidade_id?: string | null;
  momento_diagnostico?: "retorno_1" | "gtt" | "gtt_tardio" | "overt" | null;
}

interface Body {
  formato: "xlsx" | "pdf";
  conteudo: string;
  filtros?: Filtros;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function slugify(s: string | null | undefined) {
  if (!s) return "global";
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 30);
}

function formatPeriodoLabel(f: Filtros) {
  if (f.periodo_inicio && f.periodo_fim) {
    return `${f.periodo_inicio}_a_${f.periodo_fim}`;
  }
  return "todoperiodo";
}

function nomeArquivo(conteudo: string, formato: string, f: Filtros) {
  const partes = [
    "relatorio_admin",
    slugify(conteudo),
    slugify(f.estado) !== "global" ? slugify(f.estado) : null,
    slugify(f.cidade) !== "global" ? slugify(f.cidade) : null,
    formatPeriodoLabel(f),
  ].filter(Boolean);
  return `${partes.join("_")}.${formato}`;
}

// ---------- Coleta de dados agregados ----------

async function coletarDados(
  admin: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient>,
  conteudo: string,
  filtros: Filtros,
) {
  // A RPC valida is_admin(auth.uid()), então precisa rodar no contexto do
  // JWT do admin (userClient), não com service_role (auth.uid() = null).
  const { data: metricas, error: errMetricas } = await userClient.rpc(
    "metricas_diagnosticos_admin",
  );
  if (errMetricas) throw errMetricas;

  // Aplica filtros básicos lado-cliente quando fizer sentido (ex: estado).
  let regional = (metricas as any)?.regional ?? {};
  if (filtros.estado) {
    regional = {
      ...regional,
      por_estado: (regional.por_estado ?? []).filter(
        (r: any) => r.estado === filtros.estado,
      ),
      por_cidade: (regional.por_cidade ?? []).filter(
        (r: any) => r.estado === filtros.estado,
      ),
      por_unidade: (regional.por_unidade ?? []).filter(
        (r: any) => r.estado === filtros.estado,
      ),
    };
  }
  if (filtros.cidade) {
    regional = {
      ...regional,
      por_cidade: (regional.por_cidade ?? []).filter(
        (r: any) => r.cidade === filtros.cidade,
      ),
    };
  }

  // Profissionais por plano (MV admin)
  const { data: planos } = await admin
    .from("mv_admin_profissionais_por_plano" as any)
    .select("*");

  // Resumo global (MV admin)
  const { data: resumoGlobal } = await admin
    .from("mv_admin_resumo_global" as any)
    .select("*")
    .maybeSingle();

  // Distribuição geográfica de profissionais
  const { data: distGeo } = await admin
    .from("mv_admin_distribuicao_geografica" as any)
    .select("*");

  // Top cidades
  const { data: topCidades } = await admin
    .from("mv_admin_top_cidades" as any)
    .select("*");

  // Unidades
  const { data: unidades } = await admin
    .from("mv_admin_unidades_resumo" as any)
    .select("*");

  return {
    metricas,
    regional,
    planos: planos ?? [],
    resumoGlobal: resumoGlobal ?? null,
    distGeo: distGeo ?? [],
    topCidades: topCidades ?? [],
    unidades: unidades ?? [],
  };
}

function temDados(d: Awaited<ReturnType<typeof coletarDados>>, conteudo: string) {
  const m: any = d.metricas;
  if (!m) return false;
  const totalGest = m?.resumo?.total_gestantes ?? 0;
  const totalProf = d.resumoGlobal?.total_profissionais ?? 0;
  if (conteudo === "diagnosticos") return totalGest > 0;
  if (conteudo === "usuarios") return totalProf > 0;
  return totalGest > 0 || totalProf > 0;
}

// ---------- Geração XLSX ----------

function gerarXlsx(
  d: Awaited<ReturnType<typeof coletarDados>>,
  conteudo: string,
  filtros: Filtros,
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const m: any = d.metricas ?? {};

  // Aba Resumo
  const resumoRows: any[][] = [
    ["Métrica", "Valor", "Percentual"],
    ["Total de gestantes", m?.resumo?.total_gestantes ?? 0, ""],
    [
      "DMG confirmado",
      m?.resumo?.dmg ?? 0,
      m?.resumo?.total_gestantes
        ? `${(((m.resumo.dmg ?? 0) / m.resumo.total_gestantes) * 100).toFixed(1)}%`
        : "",
    ],
    [
      "Diabete Overt",
      m?.resumo?.overt ?? 0,
      m?.resumo?.total_gestantes
        ? `${(((m.resumo.overt ?? 0) / m.resumo.total_gestantes) * 100).toFixed(1)}%`
        : "",
    ],
    ["DMG + Overt", m?.resumo?.dmg_overt_total ?? 0, ""],
    ["Taxa de controle global", "", `${m?.resumo?.taxa_controle_global ?? 0}%`],
    ["", "", ""],
    ["Total profissionais", d.resumoGlobal?.total_profissionais ?? 0, ""],
    ["Profissionais ativos (30d)", d.resumoGlobal?.profissionais_ativos_30d ?? 0, ""],
    ["Total unidades", d.resumoGlobal?.total_unidades ?? 0, ""],
    ["Total pacientes", d.resumoGlobal?.total_pacientes ?? 0, ""],
    ["", "", ""],
    ["Filtros aplicados", "", ""],
    ["Período início", filtros.periodo_inicio ?? "—", ""],
    ["Período fim", filtros.periodo_fim ?? "—", ""],
    ["País", filtros.pais ?? "—", ""],
    ["Estado", filtros.estado ?? "—", ""],
    ["Cidade", filtros.cidade ?? "—", ""],
    ["Tipo de conta", filtros.tipo_conta ?? "—", ""],
    ["Unidade", filtros.unidade_id ?? "—", ""],
    ["Momento diagnóstico", filtros.momento_diagnostico ?? "—", ""],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 16 }];
  wsResumo["!freeze"] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const incluiUsuarios =
    conteudo === "usuarios" ||
    conteudo === "completo" ||
    conteudo === "profissionais_por_estado";
  const incluiDiag =
    conteudo === "diagnosticos" ||
    conteudo === "completo" ||
    conteudo === "dmg_por_estado" ||
    conteudo === "dmg_por_cidade" ||
    conteudo === "metricas_por_unidade" ||
    conteudo === "funil_tratamento" ||
    conteudo === "desfechos_perinatais";

  if (incluiUsuarios) {
    const profRows: any[][] = [["Estado", "Cidade", "Profissionais"]];
    for (const r of d.distGeo) {
      profRows.push([(r as any).estado ?? "—", (r as any).cidade ?? "—", (r as any).total ?? 0]);
    }
    const wsProf = XLSX.utils.aoa_to_sheet(profRows);
    wsProf["!cols"] = [{ wch: 14 }, { wch: 26 }, { wch: 16 }];
    wsProf["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsProf, "Profissionais");

    const planoRows: any[][] = [["Plano", "Profissionais"]];
    for (const r of d.planos) {
      planoRows.push([(r as any).plano_slug ?? "—", (r as any).total ?? 0]);
    }
    const wsPlano = XLSX.utils.aoa_to_sheet(planoRows);
    wsPlano["!cols"] = [{ wch: 18 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsPlano, "Planos");

    const uniRows: any[][] = [
      ["Unidade", "Estado", "Cidade", "Profissionais", "Pacientes"],
    ];
    for (const u of d.unidades) {
      uniRows.push([
        (u as any).nome ?? "—",
        (u as any).estado ?? "—",
        (u as any).cidade ?? "—",
        (u as any).profissionais ?? 0,
        (u as any).pacientes ?? 0,
      ]);
    }
    const wsUni = XLSX.utils.aoa_to_sheet(uniRows);
    wsUni["!cols"] = [
      { wch: 30 },
      { wch: 12 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
    ];
    wsUni["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsUni, "Unidades");
  }

  if (incluiDiag) {
    const momento = m?.momento_diagnostico ?? {};
    const diagRows: any[][] = [
      ["Momento", "Pacientes", "IG média (semanas)"],
      ["Retorno 1", momento.retorno1 ?? 0, momento.ig_retorno1 ?? "—"],
      ["GTT (24-28 sem)", momento.gtt_janela ?? 0, momento.ig_gtt_janela ?? "—"],
      [
        "GTT tardio (após 28 sem)",
        momento.gtt_tardio ?? 0,
        momento.ig_gtt_tardio ?? "—",
      ],
      ["Diabete Overt", m?.resumo?.overt ?? 0, "—"],
      ["", "", ""],
      ["DMG por estado", "", ""],
      ["Estado", "Gestantes", "DMG / Taxa"],
    ];
    for (const r of d.regional?.por_estado ?? []) {
      diagRows.push([
        r.estado,
        r.gestantes,
        `${r.dmg} (${r.taxa_dmg}%)`,
      ]);
    }
    diagRows.push(["", "", ""]);
    diagRows.push(["DMG por cidade (top)", "", ""]);
    diagRows.push(["Cidade", "Estado", "DMG / Taxa"]);
    for (const r of d.regional?.por_cidade ?? []) {
      diagRows.push([r.cidade, r.estado, `${r.dmg} (${r.taxa_dmg}%)`]);
    }
    const wsDiag = XLSX.utils.aoa_to_sheet(diagRows);
    wsDiag["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 22 }];
    wsDiag["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsDiag, "Diagnósticos");

    const tratRows: any[][] = [
      ["Etapa do funil", "Pacientes"],
      ...((m?.funil ?? []) as any[]).map((f: any) => [f.etapa, f.valor]),
      ["", ""],
      ["Tratamento — síntese", ""],
      ["Só dieta", m?.tratamento?.so_dieta ?? 0],
      ["Insulina inicial OK", m?.tratamento?.insulina_inicial_ok ?? 0],
      ["Encaminhar endócrino (Cenário 7)", m?.tratamento?.cenario7 ?? 0],
    ];
    const wsTrat = XLSX.utils.aoa_to_sheet(tratRows);
    wsTrat["!cols"] = [{ wch: 36 }, { wch: 16 }];
    wsTrat["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsTrat, "Tratamento");

    const des = m?.desfechos ?? {};
    const desRows: any[][] = [
      ["Indicador", "Valor"],
      ["Partos registrados", des.partos_total ?? 0],
      ["Via vaginal", des.via_vaginal ?? 0],
      ["Cesárea", des.via_cesarea ?? 0],
      ["RN AIG", des.rn_aig ?? 0],
      ["RN GIG", des.rn_gig ?? 0],
      ["RN PIG", des.rn_pig ?? 0],
      ["Peso médio (g)", des.peso_medio_g ?? "—"],
      [
        "IG parto média (sem)",
        des.ig_parto_media ? Number(des.ig_parto_media).toFixed(1) : "—",
      ],
      ["Intercorrências maternas", des.interc_maternas ?? 0],
      ["Intercorrências neonatais", des.interc_neonatais ?? 0],
    ];
    const wsDes = XLSX.utils.aoa_to_sheet(desRows);
    wsDes["!cols"] = [{ wch: 30 }, { wch: 18 }];
    wsDes["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsDes, "Desfechos");
  }

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

// ---------- Geração PDF ----------

async function gerarPdf(
  d: Awaited<ReturnType<typeof coletarDados>>,
  conteudo: string,
  filtros: Filtros,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const corCabec = rgb(45 / 255, 43 / 255, 85 / 255); // #2D2B55
  const corDestaque = rgb(155 / 255, 135 / 255, 245 / 255); // #9b87f5
  const corTexto = rgb(0.15, 0.15, 0.18);

  const m: any = d.metricas ?? {};

  let page = pdf.addPage([595.28, 841.89]); // A4
  const margin = 48;
  let y = page.getHeight() - margin;

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: any; x?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const font = opts.bold ? helvBold : helv;
    const color = opts.color ?? corTexto;
    const x = opts.x ?? margin;
    if (y < margin + size + 4) {
      page = pdf.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
    page.drawText(text, { x, y, size, font, color });
    y -= size + 4;
  };

  const drawTitle = (text: string) => {
    drawText(text, { size: 16, bold: true, color: corCabec });
    y -= 4;
  };
  const drawH2 = (text: string) => {
    y -= 4;
    drawText(text, { size: 12, bold: true, color: corDestaque });
  };

  // Capa
  drawTitle("Relatório Administrativo — MARI DMG Diagnóstica");
  drawText(`Gerado em ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`, {
    size: 9,
  });
  drawText(`Conteúdo: ${conteudo} • Formato: PDF`, { size: 9 });
  y -= 6;
  drawH2("Filtros aplicados");
  drawText(`Período: ${filtros.periodo_inicio ?? "—"} a ${filtros.periodo_fim ?? "—"}`);
  drawText(
    `Local: ${filtros.pais ?? "—"} / ${filtros.estado ?? "—"} / ${filtros.cidade ?? "—"}`,
  );
  drawText(
    `Tipo conta: ${filtros.tipo_conta ?? "—"} • Unidade: ${filtros.unidade_id ?? "—"}`,
  );
  drawText(`Momento diagnóstico: ${filtros.momento_diagnostico ?? "—"}`);

  // Resumo
  drawH2("Resumo executivo");
  const resumo = m?.resumo ?? {};
  drawText(`Total de gestantes: ${resumo.total_gestantes ?? 0}`);
  drawText(`DMG confirmado: ${resumo.dmg ?? 0}`);
  drawText(`Diabete Overt: ${resumo.overt ?? 0}`);
  drawText(`DMG + Overt: ${resumo.dmg_overt_total ?? 0}`);
  drawText(`Taxa de controle global: ${resumo.taxa_controle_global ?? 0}%`);
  drawText(`Total profissionais: ${d.resumoGlobal?.total_profissionais ?? 0}`);
  drawText(`Ativos (30d): ${d.resumoGlobal?.profissionais_ativos_30d ?? 0}`);
  drawText(`Unidades: ${d.resumoGlobal?.total_unidades ?? 0}`);

  // Momento
  drawH2("Momento do diagnóstico");
  const momento = m?.momento_diagnostico ?? {};
  drawText(`Retorno 1: ${momento.retorno1 ?? 0} (IG média ${momento.ig_retorno1 ?? "—"})`);
  drawText(
    `GTT janela: ${momento.gtt_janela ?? 0} (IG média ${momento.ig_gtt_janela ?? "—"})`,
  );
  drawText(
    `GTT tardio: ${momento.gtt_tardio ?? 0} (IG média ${momento.ig_gtt_tardio ?? "—"})`,
  );

  // Funil
  drawH2("Funil de tratamento");
  for (const f of (m?.funil ?? []) as any[]) {
    drawText(`• ${f.etapa}: ${f.valor}`);
  }

  // Regional
  drawH2("DMG por estado");
  for (const r of (d.regional?.por_estado ?? []).slice(0, 30)) {
    drawText(`${r.estado}: ${r.gestantes} gestantes • ${r.dmg} DMG (${r.taxa_dmg}%)`);
  }

  drawH2("DMG por cidade (top 20)");
  for (const r of (d.regional?.por_cidade ?? []).slice(0, 20)) {
    drawText(
      `${r.cidade}/${r.estado}: ${r.gestantes} gestantes • ${r.dmg} DMG (${r.taxa_dmg}%)`,
    );
  }

  // Desfechos
  drawH2("Desfechos perinatais");
  const des = m?.desfechos ?? {};
  drawText(`Partos: ${des.partos_total ?? 0}`);
  drawText(`Vaginal: ${des.via_vaginal ?? 0} • Cesárea: ${des.via_cesarea ?? 0}`);
  drawText(`AIG: ${des.rn_aig ?? 0} • GIG: ${des.rn_gig ?? 0} • PIG: ${des.rn_pig ?? 0}`);
  drawText(`Peso médio RN: ${des.peso_medio_g ?? "—"} g`);
  drawText(
    `IG média no parto: ${des.ig_parto_media ? Number(des.ig_parto_media).toFixed(1) : "—"} sem`,
  );
  drawText(`Intercorrências maternas: ${des.interc_maternas ?? 0}`);
  drawText(`Intercorrências neonatais: ${des.interc_neonatais ?? 0}`);

  // Rodapé na última página
  y = margin;
  page.drawText(
    "Dados anonimizados — gerado pelo sistema MARI DMG Diagnóstica.",
    { x: margin, y, size: 8, font: helv, color: rgb(0.45, 0.45, 0.5) },
  );

  return await pdf.save();
}

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }

    // Cliente que respeita o JWT do usuário (para validar identidade)
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }
    const userId = userData.user.id;

    // Cliente service_role para queries agregadas + storage
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: adminRow } = await admin
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!adminRow) {
      return jsonResponse({ error: "Acesso não autorizado." }, 401);
    }

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const formato = body?.formato;
    const conteudo = body?.conteudo;
    const filtros: Filtros = body?.filtros ?? {};

    if (!formato || !FORMATOS_VALIDOS.has(formato)) {
      return jsonResponse({ error: "Formato deve ser xlsx ou pdf." }, 400);
    }
    if (!conteudo || !CONTEUDOS_VALIDOS.has(conteudo)) {
      return jsonResponse({ error: "Tipo de conteúdo não reconhecido." }, 400);
    }

    const dados = await coletarDados(admin, userClient, conteudo, filtros);
    if (!temDados(dados, conteudo)) {
      return jsonResponse({
        status: "vazio",
        mensagem: "Nenhum dado encontrado para os filtros aplicados.",
      });
    }

    let bytes: Uint8Array;
    try {
      bytes =
        formato === "xlsx"
          ? gerarXlsx(dados, conteudo, filtros)
          : await gerarPdf(dados, conteudo, filtros);
    } catch (e) {
      console.error("Erro ao gerar arquivo:", e);
      return jsonResponse({ error: "Erro ao gerar relatório. Tente novamente." }, 500);
    }

    const nome = nomeArquivo(conteudo, formato, filtros);
    const path = `exportacoes/${userId}/${Date.now()}_${nome}`;
    const contentType =
      formato === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";

    const { error: upErr } = await admin.storage
      .from("exportacoes-admin")
      .upload(path, bytes, { contentType, upsert: false });
    if (upErr) {
      console.error("Erro upload:", upErr);
      return jsonResponse({ error: "Erro ao salvar arquivo." }, 500);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("exportacoes-admin")
      .createSignedUrl(path, 60 * 60); // 1h
    if (signErr || !signed?.signedUrl) {
      console.error("Erro signed URL:", signErr);
      return jsonResponse({ error: "Erro ao gerar link." }, 500);
    }

    return jsonResponse({
      status: "sucesso",
      arquivo_url: signed.signedUrl,
      arquivo_nome: nome,
    });
  } catch (e) {
    console.error("Falha inesperada:", e);
    return jsonResponse({ error: "Erro ao gerar relatório. Tente novamente." }, 500);
  }
});
