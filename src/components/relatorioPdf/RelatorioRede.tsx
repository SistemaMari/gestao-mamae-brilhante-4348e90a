// Relatório em PDF do consolidado da rede (gestor geral, botão "Exportar PDF").
import type {
  Alerta,
  ConsolidadorGargalos,
  ConsolidadorOperacao,
  ConsolidadorPerfilClinico,
  KpisPayload,
  RankingUnidade,
  TendenciaPonto,
  TopDestaquesPayload,
  VisaoGeralRow,
} from "@/hooks/usePainelDataGestorGeral";
import type { LinhaCuidadoResposta } from "@/lib/linhaCuidado";
import { INDICADORES_META, type LinhaCuidadoPorUnidade, type MetasRede } from "@/lib/metas";
import { dataBr, dias, ig, leituraFaixa, num, pct, periodoTexto, plural, NOME_INDICADOR_META } from "@/lib/relatorioPdf/formatos";
import { resumoRede } from "@/lib/relatorioPdf/resumo";
import {
  ApendiceGargalos,
  celulaMeta,
  NotaMetodologica,
  SecaoGargalos,
  SecaoLinhaCuidado,
  SecaoTendencia,
  type GestanteApendice,
} from "./blocosComuns";
import {
  Bloco,
  CabecalhoPagina,
  Capa,
  Cartao,
  COR,
  Documento,
  FONTE_TITULO,
  Grade,
  Kpi,
  Nota,
  Pilula,
  ReguaFaixa,
  Secao,
  Subtitulo,
  TabelaEmBlocos,
  type Tom,
} from "./primitivos";

export interface DadosRelatorioRede {
  redeNome: string;
  unidadesNomes: string[];
  periodo: { inicio: string; fim: string };
  operacao: ConsolidadorOperacao | null;
  perfil: ConsolidadorPerfilClinico | null;
  kpis: KpisPayload | null;
  linhaCuidado: LinhaCuidadoResposta | null;
  metas: MetasRede | null;
  porUnidade: LinhaCuidadoPorUnidade[];
  visaoGeral: VisaoGeralRow[];
  ranking: RankingUnidade[];
  alertas: Alerta[];
  destaques: TopDestaquesPayload | null;
  gargalos: ConsolidadorGargalos | null;
  tendencia: TendenciaPonto[];
  apendice: {
    sem_gj_primeira_consulta: GestanteApendice[];
    atrasadas_gtt: GestanteApendice[];
    confirmadas_sem_retorno: GestanteApendice[];
  };
  limiteApendice: number;
}

const FAIXA: [number, number] = [7, 18];

const STATUS: Record<string, { texto: string; tom: Tom }> = {
  ativa: { texto: "Ativa", tom: "bom" },
  atencao: { texto: "Atenção", tom: "alerta" },
  inativa: { texto: "Inativa", tom: "ruim" },
  nao_iniciada: { texto: "Não iniciada", tom: "neutro" },
};

function variacaoPct(v: number | null | undefined): { texto: string; tom: Tom } | null {
  if (v == null) return null;
  const r = Math.round(v * 10) / 10;
  if (r === 0) return { texto: "igual ao período anterior", tom: "neutro" };
  return { texto: `${r > 0 ? "+" : "−"}${Math.abs(r).toLocaleString("pt-BR")}% vs. período anterior`, tom: "neutro" };
}

export default function RelatorioRede(d: DadosRelatorioRede) {
  const lc = d.linhaCuidado?.atual ?? null;
  const periodoTxt = periodoTexto(d.periodo);
  const contagens = {
    sem_gj_primeira_consulta: d.gargalos?.sem_gj_primeira_consulta.count ?? 0,
    atrasadas_gtt: d.gargalos?.atrasadas_gtt.count ?? 0,
    confirmadas_sem_retorno: d.gargalos?.confirmadas_sem_retorno.count ?? 0,
  };
  const taxa = lc?.funil.taxa_diagnostico_pct ?? d.perfil?.taxa_dmg_positivo_pct ?? null;
  const resumo = resumoRede({
    redeNome: d.redeNome,
    totalUnidades: d.unidadesNomes.length,
    gestantesAtivas: d.operacao?.gestantes_ativas ?? 0,
    laudosPeriodo: d.operacao?.laudos_emitidos ?? 0,
    linhaCuidado: lc,
    metas: d.metas,
    gargalos: contagens,
    maisDiagnostica: d.destaques?.mais ?? null,
    alertas: d.alertas.length,
    faixa: FAIXA,
  });

  // Tabela por unidade: visão geral + ranking + linha de cuidado da unidade.
  const rankPorId = new Map(d.ranking.map((r) => [r.unidade_id, r]));
  const lcPorId = new Map(d.porUnidade.map((u) => [u.unidade_id, u.atual]));
  const unidades = [...d.visaoGeral].sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome, "pt-BR"));
  const metasDefinidas = INDICADORES_META.filter((c) => d.metas?.[c.chave] != null);

  let n = 0;
  const prox = () => ++n;

  return (
    <Documento>
      <CabecalhoPagina titulo="Relatório consolidado da rede" contexto={`${d.redeNome} · ${periodoTxt}`} />
      <Capa
        sobretitulo="Relatório consolidado da rede"
        titulo={d.redeNome}
        linhas={[
          `Período: ${periodoTxt}`,
          `${num(d.unidadesNomes.length)} ${plural(d.unidadesNomes.length, "unidade", "unidades")}: ${d.unidadesNomes.join(", ")}`,
        ]}
        resumo={resumo}
      >
        <Grade colunas={4}>
          <Kpi
            rotulo="Gestantes ativas (hoje)"
            valor={num(d.operacao?.gestantes_ativas)}
            variacao={variacaoPct(d.kpis?.variacao_periodo_anterior.pacientes_ativos_pct)}
          />
          <Kpi
            rotulo="Laudos no período"
            valor={num(d.operacao?.laudos_emitidos)}
            variacao={variacaoPct(d.kpis?.variacao_periodo_anterior.laudos_emitidos_pct)}
          />
          <Kpi rotulo="Taxa de diagnóstico" valor={pct(taxa)} detalhe={`Faixa esperada: ${FAIXA[0]}–${FAIXA[1]}%`} destaque />
          <Kpi rotulo="Perda de seguimento" valor={pct(lc?.funil.perda_seguimento_pct)} detalhe="Gestantes com diabetes que pararam de vir" />
        </Grade>
      </Capa>

      <Secao numero={prox()} titulo="Operação da rede" descricao="Volume de trabalho somado de todas as unidades do relatório." />
      <Bloco>
        <Grade colunas={5}>
          <Kpi rotulo="Gestantes ativas" valor={num(d.operacao?.gestantes_ativas)} detalhe="Situação de hoje" />
          <Kpi rotulo="Laudos emitidos" valor={num(d.operacao?.laudos_emitidos)} detalhe="No período" />
          <Kpi rotulo="Exames realizados" valor={num(d.operacao?.exames_realizados)} detalhe="Glicemias e curvas" />
          <Kpi rotulo="Partos registrados" valor={num(d.operacao?.partos_registrados)} detalhe="No período" />
          <Kpi rotulo="Profissionais ativos" valor={num(d.operacao?.profissionais_ativos)} detalhe="Com acesso ativo" />
        </Grade>
      </Bloco>

      <Secao numero={prox()} titulo="Perfil clínico da rede" descricao="Diagnósticos de diabetes entre as gestantes rastreadas e o momento do diagnóstico." />
      <Bloco>
        <Grade colunas={3}>
          <div style={{ gridColumn: "span 2" }}>
            <Cartao destaque>
              <div style={{ fontSize: 10.5, color: COR.muted, fontWeight: 600 }}>Taxa de diagnóstico (DMG + diabetes prévio)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                <span style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 30, color: COR.texto }}>{pct(taxa)}</span>
                <span style={{ fontSize: 11, color: COR.corpo }}>
                  {num(lc?.funil.diagnosticadas ?? d.perfil?.total_diagnosticos_no_calculo)} de {num(lc?.funil.rastreadas ?? d.perfil?.gestantes_rastreadas)} gestantes rastreadas
                  {d.perfil?.total_overt ? ` (inclui ${num(d.perfil.total_overt)} overt)` : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                <span style={{ fontSize: 10.5, color: COR.corpo }}>{leituraFaixa(taxa, FAIXA[0], FAIXA[1])}</span>
                {d.kpis?.variacao_periodo_anterior.taxa_dmg_positivo_delta != null && (
                  <Pilula
                    tom="neutro"
                    texto={`${d.kpis.variacao_periodo_anterior.taxa_dmg_positivo_delta >= 0 ? "+" : "−"}${Math.abs(d.kpis.variacao_periodo_anterior.taxa_dmg_positivo_delta).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p. vs. período anterior`}
                  />
                )}
              </div>
              <ReguaFaixa valor={taxa} min={FAIXA[0]} max={FAIXA[1]} />
            </Cartao>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Kpi
              rotulo="IG média ao diagnóstico"
              valor={d.perfil?.ig_media_diagnostico ? ig(d.perfil.ig_media_diagnostico.total_dias) : "—"}
              detalhe="Idade gestacional quando o diabetes foi confirmado"
            />
            <Kpi
              rotulo="Tempo médio de acompanhamento"
              valor={d.perfil?.tempo_medio_fechamento_dias == null ? "—" : dias(Math.round(d.perfil.tempo_medio_fechamento_dias))}
              detalhe="Da última menstruação até o encerramento (parto ou outro motivo)"
            />
          </div>
        </Grade>
      </Bloco>

      {d.linhaCuidado && (
        <SecaoLinhaCuidado
          numero={prox()}
          atual={d.linhaCuidado.atual}
          anterior={d.linhaCuidado.anterior}
          metas={d.metas}
          notaMetas={'Metas definidas pela gestão da rede, valendo para todas as unidades. Com menos de 5 gestantes na conta, o indicador fica como "poucos dados".'}
        />
      )}

      <Secao numero={prox()} titulo="Unidades lado a lado" descricao="Os principais números de cada unidade no período. Status pela última atividade registrada." />
      <TabelaEmBlocos
        porBloco={16}
        colunas={[
          { titulo: "Unidade" },
          { titulo: "Gestor" },
          { titulo: "Ativas", alinhar: "right", semQuebra: true },
          { titulo: "Laudos", alinhar: "right", semQuebra: true },
          { titulo: "Taxa diag.", alinhar: "right", semQuebra: true },
          { titulo: "Perda seg.", alinhar: "right", semQuebra: true },
          { titulo: "Perfil compl.", alinhar: "right", semQuebra: true },
          { titulo: "Status", semQuebra: true },
          { titulo: "Última ativ.", semQuebra: true },
        ]}
        linhas={unidades.map((u) => {
          const r = rankPorId.get(u.unidade_id);
          const l = lcPorId.get(u.unidade_id);
          const st = STATUS[r?.status_operacional ?? ""] ?? null;
          return [
            <strong key="n" style={{ color: COR.texto }}>{u.unidade_nome}</strong>,
            u.gestor_nome || "—",
            num(u.pacientes_ativos),
            num(u.laudos_emitidos),
            pct(u.taxa_dmg_positivo_pct),
            pct(l?.funil.perda_seguimento_pct),
            pct(l?.adesao.perfil_completo_pct),
            st ? <Pilula key="s" texto={st.texto} tom={st.tom} /> : "—",
            r?.ultima_atividade ? dataBr(r.ultima_atividade) : "—",
          ];
        })}
        vazio="Nenhuma unidade no filtro."
      />

      {metasDefinidas.length > 0 && d.porUnidade.length > 0 && (
        <>
          <Secao
            numero={prox()}
            titulo="Metas por unidade"
            descricao="Cada unidade comparada com a meta da rede no período. ✓ atingida · ✗ fora da meta · i poucos dados (menos de 5 gestantes na conta)."
          />
          <TabelaEmBlocos
            porBloco={16}
            colunas={[
              { titulo: "Unidade", largura: 110 },
              ...metasDefinidas.map((c) => ({
                titulo: `${NOME_INDICADOR_META[c.chave]} (${c.sentido === "minimo" ? "mín." : "máx."} ${c.unidade === "pct" ? pct(d.metas?.[c.chave]) : dias(d.metas?.[c.chave])})`,
                alinhar: "center" as const,
              })),
              { titulo: "Atingidas", alinhar: "right" },
            ]}
            linhas={[...d.porUnidade]
              .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome, "pt-BR"))
              .map((u) => {
                const cels = metasDefinidas.map((c) => celulaMeta(u.atual, c.chave, d.metas));
                const avaliadas = cels.filter((c) => c.situacao === "atingida" || c.situacao === "nao_atingida").length;
                const atingidas = cels.filter((c) => c.situacao === "atingida").length;
                return [
                  <strong key="n" style={{ color: COR.texto }}>{u.unidade_nome}</strong>,
                  ...cels.map((c, i) => (
                    <span key={i} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                      <Pilula texto={c.marca} tom={c.tom} />
                      <span style={{ fontSize: 10 }}>{c.valor}</span>
                    </span>
                  )),
                  avaliadas > 0 ? `${atingidas} de ${avaliadas}` : "—",
                ];
              })}
          />
        </>
      )}

      <Secao numero={prox()} titulo="Destaques e alertas" descricao="Quem mais e menos diagnosticou no período e os alertas operacionais de hoje." />
      <Bloco>
        <Grade colunas={2}>
          <Cartao style={{ background: "#F0FDF4", borderColor: "#BBF7D0" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: COR.verde }}>Diagnostica mais</div>
            <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 16, marginTop: 4 }}>{d.destaques?.mais?.unidade_nome ?? "—"}</div>
            <div style={{ fontSize: 10.5, color: COR.corpo }}>
              {d.destaques?.mais ? `${num(d.destaques.mais.diagnosticos)} ${plural(d.destaques.mais.diagnosticos, "diagnóstico", "diagnósticos")}` : "Sem dados"}
            </div>
          </Cartao>
          <Cartao style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: COR.ambar }}>Diagnostica menos</div>
            <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 16, marginTop: 4 }}>{d.destaques?.menos?.unidade_nome ?? "—"}</div>
            <div style={{ fontSize: 10.5, color: COR.corpo }}>
              {d.destaques?.menos ? `${num(d.destaques.menos.diagnosticos)} ${plural(d.destaques.menos.diagnosticos, "diagnóstico", "diagnósticos")}` : "Sem dados"}
            </div>
          </Cartao>
        </Grade>
      </Bloco>
      <Bloco>
        <Cartao>
          <Subtitulo>Alertas operacionais</Subtitulo>
          {d.alertas.length === 0 ? (
            <Nota>Nenhum alerta no momento.</Nota>
          ) : (
            d.alertas.map((a) => (
              <div key={a.alerta_id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", borderBottom: `1px solid ${COR.borda}` }}>
                <Pilula texto={a.severidade === "alta" ? "Alta" : "Média"} tom={a.severidade === "alta" ? "ruim" : "alerta"} />
                <div style={{ fontSize: 10.5, color: COR.corpo, lineHeight: 1.45 }}>
                  <strong style={{ color: COR.texto }}>{a.unidade_nome}</strong> — {a.mensagem}
                </div>
              </div>
            ))
          )}
        </Cartao>
      </Bloco>

      <SecaoGargalos numero={prox()} contagens={contagens} onde="da rede" />

      <SecaoTendencia
        numero={prox()}
        dados={d.tendencia}
        descricao="Gestantes acompanhadas e diagnósticos de diabetes na rede, nos últimos 12 meses."
      />

      <ApendiceGargalos
        numero={prox()}
        comUnidade
        limite={d.limiteApendice}
        grupos={[
          { titulo: "Sem glicemia de jejum na 1ª consulta", cor: "#CA8A04", total: contagens.sem_gj_primeira_consulta, lista: d.apendice.sem_gj_primeira_consulta },
          { titulo: "Curva glicêmica (GTT 75g) em atraso", cor: "#EA580C", total: contagens.atrasadas_gtt, lista: d.apendice.atrasadas_gtt },
          { titulo: "Diabetes confirmado sem retorno", cor: "#DC2626", total: contagens.confirmadas_sem_retorno, lista: d.apendice.confirmadas_sem_retorno },
        ]}
      />

      <NotaMetodologica
        numero={prox()}
        extra={[
          "Status da unidade: ativa (atividade recente), atenção (sem atividade há mais de 30 dias), inativa (mais de 60 dias) ou não iniciada (nunca registrou atendimento).",
        ]}
      />
    </Documento>
  );
}
