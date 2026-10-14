// Relatório em PDF do painel do gestor de unidade (botão "Exportar PDF").
import type { DadosEquipe } from "@/lib/fetchDadosEquipe";
import type { LinhaCuidadoResposta } from "@/lib/linhaCuidado";
import type { MetasRede } from "@/lib/metas";
import type { PainelGargalos, PainelOperacao, PainelPerfilClinico, PainelTendencia } from "@/lib/painelEstrategicoTypes";
import { ig, leituraFaixa, num, pct, periodoTexto, plural } from "@/lib/relatorioPdf/formatos";
import { resumoUnidade } from "@/lib/relatorioPdf/resumo";
import {
  ApendiceGargalos,
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
  Grade,
  Kpi,
  LinhaBarra,
  Nota,
  ReguaFaixa,
  Secao,
  Subtitulo,
  Tabela,
} from "./primitivos";

export interface DadosRelatorioUnidade {
  unidadeNome: string;
  periodo: { inicio: string; fim: string } | null;
  operacao: PainelOperacao;
  perfil: PainelPerfilClinico;
  gargalos: PainelGargalos;
  tendencia: PainelTendencia;
  linhaCuidado: LinhaCuidadoResposta | null;
  metas: MetasRede | null;
  notaMetas: string | null;
  equipe: DadosEquipe | null;
  apendice: {
    sem_gj_primeira_consulta: GestanteApendice[];
    atrasadas_gtt: GestanteApendice[];
    confirmadas_sem_retorno: GestanteApendice[];
  };
  limiteApendice: number;
}

export default function RelatorioUnidade(d: DadosRelatorioUnidade) {
  const lc = d.linhaCuidado?.atual ?? null;
  const faixa: [number, number] = [d.perfil.benchmark_min_pct ?? 7, d.perfil.benchmark_max_pct ?? 18];
  const laudosPeriodo = d.operacao.laudos_periodo ?? d.operacao.laudos_30d;
  const contagens = {
    sem_gj_primeira_consulta: d.gargalos.sem_gj_primeira_consulta.count,
    atrasadas_gtt: d.gargalos.atrasadas_gtt.count,
    confirmadas_sem_retorno: d.gargalos.confirmadas_sem_retorno.count,
  };
  const periodoTxt = periodoTexto(d.periodo);
  const resumo = resumoUnidade({
    unidadeNome: d.unidadeNome,
    gestantesAtivas: d.operacao.gestantes_ativas,
    laudosPeriodo,
    linhaCuidado: lc,
    metas: d.metas,
    gargalos: contagens,
    faixa,
  });
  const taxa = lc?.funil.taxa_diagnostico_pct ?? d.perfil.prevalencia_pct;
  const distribuicao = [...(d.operacao.distribuicao_profissionais ?? [])].sort(
    (a, b) => b.total_pacientes_ativos - a.total_pacientes_ativos,
  );
  const maxDistrib = Math.max(1, ...distribuicao.map((p) => p.total_pacientes_ativos));
  let n = 0;
  const prox = () => ++n;

  return (
    <Documento>
      <CabecalhoPagina titulo="Relatório do painel da unidade" contexto={`${d.unidadeNome}${periodoTxt ? ` · ${periodoTxt}` : ""}`} />
      <Capa
        sobretitulo="Relatório do painel da unidade"
        titulo={d.unidadeNome}
        linhas={[periodoTxt ? `Período: ${periodoTxt}` : "Período: últimos 30 dias", "Gestantes ativas e pendências: situação de hoje"]}
        resumo={resumo}
      >
        <Grade colunas={4}>
          <Kpi rotulo="Gestantes ativas (hoje)" valor={num(d.operacao.gestantes_ativas)} detalhe="Em acompanhamento, sem encerradas" />
          <Kpi rotulo="Laudos no período" valor={num(laudosPeriodo)} detalhe="Emitidos pela equipe da unidade" />
          <Kpi rotulo="Taxa de diagnóstico" valor={pct(taxa)} detalhe={`Faixa esperada: ${faixa[0]}–${faixa[1]}%`} destaque />
          <Kpi
            rotulo="Perda de seguimento"
            valor={pct(lc?.funil.perda_seguimento_pct)}
            detalhe="Gestantes com diabetes que pararam de vir"
          />
        </Grade>
      </Capa>

      <Secao numero={prox()} titulo="Operação da unidade" descricao="Volume de trabalho da unidade e como as gestantes ativas se distribuem pela equipe." />
      <Bloco>
        <Grade colunas={3}>
          <Kpi rotulo="Gestantes ativas" valor={num(d.operacao.gestantes_ativas)} detalhe="Situação de hoje" />
          <Kpi rotulo="Laudos no período" valor={num(laudosPeriodo)} detalhe={periodoTxt || "Últimos 30 dias"} />
          <Kpi
            rotulo="Profissionais com gestantes"
            valor={num(distribuicao.filter((p) => p.total_pacientes_ativos > 0).length)}
            detalhe="Com ao menos 1 gestante ativa"
          />
        </Grade>
      </Bloco>
      {distribuicao.length > 0 && (
        <Bloco>
          <Cartao>
            <Subtitulo nota="Gestantes ativas por profissional responsável.">Distribuição da carteira</Subtitulo>
            {distribuicao.slice(0, 14).map((p) => (
              <LinhaBarra
                key={p.profissional_id}
                rotulo={p.nome}
                valor={num(p.total_pacientes_ativos)}
                pct={(p.total_pacientes_ativos / maxDistrib) * 100}
                largRotulo={210}
              />
            ))}
            {distribuicao.length > 14 && <Nota>+ {distribuicao.length - 14} profissionais com menos gestantes.</Nota>}
          </Cartao>
        </Bloco>
      )}

      <Secao
        numero={prox()}
        titulo="Perfil clínico"
        descricao="Quantas gestantes rastreadas tiveram diabetes confirmado e em que momento da gestação."
      />
      <Bloco>
        <Grade colunas={3}>
          <div style={{ gridColumn: "span 2" }}>
            <Cartao destaque>
              <div style={{ fontSize: 10.5, color: COR.muted, fontWeight: 600 }}>Taxa de diagnóstico (DMG + diabetes prévio)</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 30, color: COR.texto }}>{pct(taxa)}</span>
                <span style={{ fontSize: 11, color: COR.corpo }}>
                  {num(lc?.funil.diagnosticadas ?? d.perfil.total_dmg_confirmadas)} de {num(lc?.funil.rastreadas ?? d.perfil.total_acompanhadas)}{" "}
                  {plural(lc?.funil.rastreadas ?? d.perfil.total_acompanhadas, "gestante rastreada", "gestantes rastreadas")}
                  {d.perfil.total_overt ? ` (inclui ${num(d.perfil.total_overt)} overt)` : ""}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: COR.corpo, marginTop: 2 }}>{leituraFaixa(taxa, faixa[0], faixa[1])}</div>
              <ReguaFaixa valor={taxa} min={faixa[0]} max={faixa[1]} />
            </Cartao>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Kpi
              rotulo="IG média ao diagnóstico"
              valor={ig(d.perfil.ig_media_diagnostico_dias)}
              detalhe="Idade gestacional quando o diabetes foi confirmado"
            />
            <Kpi
              rotulo="DMG em gestação anterior"
              valor={pct(d.perfil.dmg_anterior_pct)}
              detalhe={`${num(d.perfil.dmg_anterior)} gestantes com histórico`}
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
          notaMetas={d.notaMetas}
        />
      )}

      <SecaoGargalos numero={prox()} contagens={contagens} onde="da unidade" />

      <SecaoTendencia
        numero={prox()}
        dados={d.tendencia}
        descricao="Gestantes acompanhadas e diagnósticos de diabetes, mês a mês."
      />

      {d.equipe && <SecaoEquipe numero={prox()} equipe={d.equipe} />}

      <ApendiceGargalos
        numero={prox()}
        limite={d.limiteApendice}
        grupos={[
          { titulo: "Sem glicemia de jejum na 1ª consulta", cor: "#CA8A04", total: contagens.sem_gj_primeira_consulta, lista: d.apendice.sem_gj_primeira_consulta },
          { titulo: "Curva glicêmica (GTT 75g) em atraso", cor: "#EA580C", total: contagens.atrasadas_gtt, lista: d.apendice.atrasadas_gtt },
          { titulo: "Diabetes confirmado sem retorno", cor: "#DC2626", total: contagens.confirmadas_sem_retorno, lista: d.apendice.confirmadas_sem_retorno },
        ]}
      />

      <NotaMetodologica numero={prox()} />
    </Documento>
  );
}

function SecaoEquipe({ numero, equipe }: { numero: number; equipe: DadosEquipe }) {
  const composicao = new Map<string, number>();
  for (const p of equipe.profissionaisEquipe) {
    const chave = p.especialidade || p.perfil_clinico || "Não informada";
    composicao.set(chave, (composicao.get(chave) ?? 0) + 1);
  }
  const comp = [...composicao.entries()].sort((a, b) => b[1] - a[1]);
  const totalComp = Math.max(1, comp.reduce((s, [, v]) => s + v, 0));
  const perf = [...equipe.performance].sort((a, b) => b.laudos - a.laudos || b.pacientes - a.pacientes);
  return (
    <>
      <Secao numero={numero} titulo="Equipe" descricao="Quem atende na unidade, convites em aberto e produção de cada profissional." />
      <Bloco>
        <Grade colunas={4}>
          <Kpi rotulo="Profissionais ativos" valor={num(equipe.totalAtivos)} />
          <Kpi rotulo="Convites pendentes" valor={num(equipe.totalPendentes)} detalhe="Aguardando aceite" />
          <Kpi rotulo="Convites expirados" valor={num(equipe.totalExpirados)} detalhe="Podem ser reenviados" />
          <Kpi rotulo="Laudos da equipe" valor={num(equipe.totalLaudos)} detalhe="Total histórico" />
        </Grade>
      </Bloco>
      <Bloco>
        <Grade colunas={2}>
          <Cartao>
            <Subtitulo nota="Especialidade de quem atende na unidade.">Composição clínica</Subtitulo>
            {comp.length === 0 ? (
              <Nota>Sem profissionais cadastrados.</Nota>
            ) : (
              comp.map(([nome, v]) => (
                <LinhaBarra key={nome} rotulo={nome} valor={num(v)} pct={(v / totalComp) * 100} largRotulo={130} />
              ))
            )}
          </Cartao>
          <Cartao>
            <Subtitulo nota="Média de dias entre a 1ª consulta e o 1º laudo, nos últimos 90 dias.">Fluxo de atendimento</Subtitulo>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 22, color: COR.texto }}>
              {equipe.tempoMedioDias == null ? "—" : `${num(Math.round(equipe.tempoMedioDias * 10) / 10)} dias`}
            </div>
            <div style={{ fontSize: 10, color: COR.muted, marginTop: 2 }}>Tempo médio até o 1º laudo</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: COR.texto, marginTop: 10 }}>Profissionais sobrecarregados</div>
            {equipe.sobrecarregados.length === 0 ? (
              <Nota>Ninguém com mais que o dobro da média de gestantes.</Nota>
            ) : (
              equipe.sobrecarregados.map((s) => (
                <div key={s.nome} style={{ fontSize: 10.5, color: COR.corpo, marginTop: 3 }}>
                  {s.nome} — {num(s.pacientes)} gestantes
                </div>
              ))
            )}
          </Cartao>
        </Grade>
      </Bloco>
      {perf.length > 0 && (
        <Bloco>
          <Cartao>
            <Subtitulo>Produção por profissional</Subtitulo>
            <Tabela
              colunas={[{ titulo: "Profissional" }, { titulo: "Laudos", alinhar: "right" }, { titulo: "Gestantes", alinhar: "right" }]}
              linhas={perf.slice(0, 18).map((p) => [p.nome, num(p.laudos), num(p.pacientes)])}
            />
            {perf.length > 18 && <Nota>+ {perf.length - 18} profissionais.</Nota>}
          </Cartao>
        </Bloco>
      )}
    </>
  );
}
