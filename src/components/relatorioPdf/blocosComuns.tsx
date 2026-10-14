// Seções do relatório em PDF usadas pelos dois relatórios (unidade e rede).
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from "recharts";
import type { LinhaCuidadoBloco, MotivoEncerramentoLC } from "@/lib/linhaCuidado";
import { faixasComPct } from "@/lib/linhaCuidado";
import { INDICADORES_META, CFG_META, avaliarIndicador, type MetasRede } from "@/lib/metas";
import {
  dias,
  num,
  pct,
  plural,
  seloMeta,
  variacao,
  NOME_INDICADOR_META,
  valorIndicadorTexto,
} from "@/lib/relatorioPdf/formatos";
import {
  Bloco,
  Cartao,
  CartaoGargalo,
  COR,
  FONTE_TITULO,
  Grade,
  Kpi,
  LinhaBarra,
  Nota,
  Pilula,
  Secao,
  Subtitulo,
  Tabela,
  TabelaEmBlocos,
  type Tom,
} from "./primitivos";

const ROTULO_DESFECHO: Record<"em_acompanhamento" | MotivoEncerramentoLC, string> = {
  em_acompanhamento: "Em acompanhamento",
  insulinizacao: "Encaminhada para insulina",
  parto: "Parto",
  aborto: "Aborto",
  nao_retornou: "Não retornou",
  outro: "Outro motivo",
};

const ROTULO_IDADE = {
  menos_20: "Menos de 20 anos",
  de_20_34: "20 a 34 anos",
  de_35_39: "35 a 39 anos",
  mais_40: "40 anos ou mais",
  sem_info: "Sem data de nascimento",
} as const;

function LinhaIndicador({
  titulo,
  explicacao,
  valor,
  base,
  barraPct,
  variacaoTxt,
  selo,
}: {
  titulo: string;
  explicacao: string;
  valor: string;
  base: string;
  barraPct?: number | null;
  variacaoTxt?: { texto: string; tom: Tom } | null;
  selo?: { texto: string; tom: Tom; meta: string } | null;
}) {
  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${COR.borda}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: COR.texto }}>{titulo}</div>
          <div style={{ fontSize: 9.5, color: COR.muted, marginTop: 2, lineHeight: 1.4 }}>{explicacao}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONTE_TITULO, fontWeight: 700, fontSize: 18, color: COR.texto }}>{valor}</div>
          <div style={{ fontSize: 9.5, color: COR.muted }}>{base}</div>
        </div>
      </div>
      {barraPct != null && (
        <div style={{ height: 8, borderRadius: 4, background: COR.lilasClaro, marginTop: 6, overflow: "hidden" }}>
          <div style={{ width: `${Math.max(0, Math.min(100, barraPct))}%`, height: "100%", background: COR.lilas, borderRadius: 4 }} />
        </div>
      )}
      {(variacaoTxt || selo) && (
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
          {variacaoTxt && <Pilula texto={variacaoTxt.texto} tom={variacaoTxt.tom} />}
          {selo && <Pilula texto={selo.texto} tom={selo.tom} />}
          {selo && <span style={{ fontSize: 9.5, color: COR.muted }}>{selo.meta}</span>}
        </div>
      )}
    </div>
  );
}

/** Seção "Linha de cuidado": funil, perda de seguimento, adesão, tempos, perfil das gestantes e metas. */
export function SecaoLinhaCuidado({
  numero,
  atual,
  anterior,
  metas,
  notaMetas,
}: {
  numero: number;
  atual: LinhaCuidadoBloco;
  anterior: LinhaCuidadoBloco | null;
  metas: MetasRede | null | undefined;
  notaMetas?: string | null;
}) {
  const { funil, adesao, tempos, perfil_gestantes: pg, criterios } = atual;
  const ant = anterior;
  const topo = Math.max(funil.rastreadas, 1);
  const diag = Math.max(funil.diagnosticadas, 1);
  const desfechos: Array<"em_acompanhamento" | MotivoEncerramentoLC> = [
    "em_acompanhamento",
    "insulinizacao",
    "parto",
    "aborto",
    "nao_retornou",
    "outro",
  ];
  const valorDesfecho = (d: (typeof desfechos)[number]) =>
    d === "em_acompanhamento" ? funil.em_acompanhamento : funil.encerradas?.[d] ?? 0;
  const faixas = faixasComPct(pg.faixas_idade);
  const temMetas = !!metas && INDICADORES_META.some((c) => metas[c.chave] != null);

  return (
    <>
      <Secao
        numero={numero}
        titulo="Linha de cuidado"
        descricao="Gestantes rastreadas no período e o que aconteceu com elas até hoje. As setas comparam com o período anterior de mesmo tamanho."
      />
      <Bloco>
        <Grade colunas={4}>
          <Kpi
            rotulo="Gestantes rastreadas"
            valor={num(funil.rastreadas)}
            detalhe="Fizeram glicemia de jejum ou curva glicêmica no período"
            variacao={ant ? variacao(funil.rastreadas, ant.funil.rastreadas, "contagem", "bom_subir") : null}
          />
          <Kpi
            rotulo="Com diabetes confirmado"
            valor={num(funil.diagnosticadas)}
            detalhe={`${pct(funil.taxa_diagnostico_pct)} das rastreadas (DMG + diabetes prévio)`}
            variacao={ant ? variacao(funil.diagnosticadas, ant.funil.diagnosticadas, "contagem", "neutro") : null}
          />
          <Kpi
            destaque
            rotulo="Perda de seguimento"
            valor={pct(funil.perda_seguimento_pct)}
            detalhe={`${num(funil.encerradas?.nao_retornou ?? 0)} de ${num(funil.diagnosticadas)} gestantes com diabetes pararam de vir`}
            variacao={ant ? variacao(funil.perda_seguimento_pct, ant.funil.perda_seguimento_pct, "pct", "ruim_subir") : null}
            selo={seloMeta(atual, "perda_seguimento_pct", metas)}
          />
          <Kpi
            rotulo="Diagnóstico antes de 28 semanas"
            valor={pct(tempos.diag_antes_28s_pct)}
            detalhe={`${num(tempos.diag_antes_28s)} de ${num(tempos.diag_com_ig)} diagnósticos`}
            variacao={ant ? variacao(tempos.diag_antes_28s_pct, ant.tempos.diag_antes_28s_pct, "pct", "bom_subir") : null}
            selo={seloMeta(atual, "diag_antes_28s_pct", metas)}
          />
        </Grade>
      </Bloco>
      <Bloco>
        <Cartao>
          <Subtitulo nota="Do rastreio ao diagnóstico, e a situação de hoje de quem teve diabetes confirmado.">
            Funil da linha de cuidado
          </Subtitulo>
          <LinhaBarra rotulo="Rastreadas" valor={num(funil.rastreadas)} pct={(funil.rastreadas / topo) * 100} />
          <LinhaBarra
            rotulo="Diabetes confirmado"
            valor={`${num(funil.diagnosticadas)} · ${pct(funil.taxa_diagnostico_pct)}`}
            pct={(funil.diagnosticadas / topo) * 100}
            cor={COR.roxo}
          />
          <div style={{ fontSize: 9.5, fontWeight: 700, color: COR.muted, letterSpacing: 0.6, margin: "10px 0 2px", textTransform: "uppercase" }}>
            Situação hoje das gestantes com diabetes
          </div>
          {desfechos.map((d) => {
            const n = valorDesfecho(d);
            return (
              <LinhaBarra
                key={d}
                rotulo={ROTULO_DESFECHO[d]}
                valor={funil.diagnosticadas > 0 ? `${num(n)} · ${pct((n / diag) * 100)}` : num(n)}
                pct={(n / diag) * 100}
                cor={d === "nao_retornou" ? "#F87171" : d === "em_acompanhamento" ? COR.lilas : COR.roxo}
              />
            );
          })}
        </Cartao>
      </Bloco>
      <Bloco>
        <Grade colunas={2}>
          <Cartao>
            <Subtitulo nota={`Entre as ${num(adesao.diagnosticadas)} gestantes com diabetes do período.`}>
              Adesão ao perfil glicêmico
            </Subtitulo>
            <LinhaIndicador
              titulo="Entregaram perfil completo"
              explicacao={`Pelo menos ${criterios.perfil_min_dias} dias com medições de glicose feitas em casa.`}
              valor={pct(adesao.perfil_completo_pct)}
              base={`${num(adesao.com_perfil_completo)} de ${num(adesao.diagnosticadas)}`}
              barraPct={adesao.perfil_completo_pct}
              variacaoTxt={ant ? variacao(adesao.perfil_completo_pct, ant.adesao.perfil_completo_pct, "pct", "bom_subir") : null}
              selo={seloMeta(atual, "perfil_completo_pct", metas)}
            />
            <LinhaIndicador
              titulo="Último perfil dentro do alvo"
              explicacao={`${criterios.meta_pct}% ou mais das medições no alvo glicêmico, no perfil mais recente.`}
              valor={pct(adesao.ultimo_na_meta_pct)}
              base={`${num(adesao.ultimo_na_meta)} de ${num(adesao.com_perfil)} que entregaram`}
              barraPct={adesao.ultimo_na_meta_pct}
              variacaoTxt={ant ? variacao(adesao.ultimo_na_meta_pct, ant.adesao.ultimo_na_meta_pct, "pct", "bom_subir") : null}
              selo={seloMeta(atual, "ultimo_na_meta_pct", metas)}
            />
          </Cartao>
          <Cartao>
            <Subtitulo nota="Medianas, em dias: metade das gestantes levou menos que isso.">Tempos da linha de cuidado</Subtitulo>
            <LinhaIndicador
              titulo="Glicemia de jejum → curva glicêmica"
              explicacao="Do 1º exame (jejum) à curva glicêmica (GTT), para quem fez os dois."
              valor={dias(tempos.gj_gtt_mediana_dias)}
              base={`base: ${num(tempos.gj_gtt_n)} ${plural(tempos.gj_gtt_n, "gestante", "gestantes")}`}
              variacaoTxt={ant ? variacao(tempos.gj_gtt_mediana_dias, ant.tempos.gj_gtt_mediana_dias, "dias", "ruim_subir") : null}
              selo={seloMeta(atual, "gj_gtt_mediana_dias", metas)}
            />
            <LinhaIndicador
              titulo="Diagnóstico → 1º perfil glicêmico"
              explicacao="Do diabetes confirmado ao início das medições em casa."
              valor={dias(tempos.diag_perfil_mediana_dias)}
              base={`base: ${num(tempos.diag_perfil_n)} ${plural(tempos.diag_perfil_n, "gestante", "gestantes")}`}
              variacaoTxt={ant ? variacao(tempos.diag_perfil_mediana_dias, ant.tempos.diag_perfil_mediana_dias, "dias", "ruim_subir") : null}
            />
            <LinhaIndicador
              titulo="Diagnóstico → encaminhamento para insulina"
              explicacao="Do diabetes confirmado ao encaminhamento, para quem precisou de insulina."
              valor={dias(tempos.diag_insulina_mediana_dias)}
              base={`base: ${num(tempos.diag_insulina_n)} ${plural(tempos.diag_insulina_n, "gestante", "gestantes")}`}
              variacaoTxt={ant ? variacao(tempos.diag_insulina_mediana_dias, ant.tempos.diag_insulina_mediana_dias, "dias", "ruim_subir") : null}
            />
          </Cartao>
        </Grade>
      </Bloco>
      <Bloco>
        <Cartao>
          <Subtitulo nota={`${num(pg.atendidas)} ${plural(pg.atendidas, "gestante atendida", "gestantes atendidas")} no período.`}>
            Perfil das gestantes atendidas
          </Subtitulo>
          {faixas.map((fx) => (
            <LinhaBarra key={fx.faixa} rotulo={ROTULO_IDADE[fx.faixa]} valor={`${num(fx.n)} · ${pct(fx.pct)}`} pct={fx.pct} largRotulo={140} />
          ))}
          <div style={{ marginTop: 8, fontSize: 11, color: COR.corpo }}>
            <strong style={{ fontFamily: FONTE_TITULO }}>{pct(pg.dmg_anterior_pct)}</strong> tiveram diabetes gestacional em gravidez
            anterior ({num(pg.dmg_anterior)} de {num(pg.atendidas)}).
          </div>
        </Cartao>
      </Bloco>
      {temMetas && (
        <Bloco>
          <Cartao>
          <Subtitulo nota={notaMetas ?? "Metas definidas pela gestão da rede. Com menos de 5 gestantes na conta, o indicador fica como \"poucos dados\"."}>
            Metas da rede
          </Subtitulo>
          <Tabela
            colunas={[
              { titulo: "Indicador" },
              { titulo: "Meta", alinhar: "right", semQuebra: true },
              { titulo: "Resultado", alinhar: "right", semQuebra: true },
              { titulo: "Situação", semQuebra: true },
            ]}
            linhas={INDICADORES_META.filter((c) => metas?.[c.chave] != null).map((c) => {
              const s = seloMeta(atual, c.chave, metas);
              return [
                NOME_INDICADOR_META[c.chave],
                `${c.sentido === "minimo" ? "mín." : "máx."} ${c.unidade === "pct" ? pct(metas?.[c.chave]) : dias(metas?.[c.chave])}`,
                valorIndicadorTexto(atual, c.chave),
                s ? <Pilula texto={s.texto} tom={s.tom} /> : "—",
              ];
            })}
          />
          </Cartao>
        </Bloco>
      )}
      {criterios.provisorio && (
        <Bloco>
          <Nota>
            Critério provisório, a validar pelas médicas: perfil completo = pelo menos {criterios.perfil_min_dias} dias com medição; dentro do
            alvo = {criterios.meta_pct}% ou mais das medições no alvo glicêmico.
          </Nota>
        </Bloco>
      )}
    </>
  );
}

export interface ContagemGargalos {
  sem_gj_primeira_consulta: number;
  atrasadas_gtt: number;
  confirmadas_sem_retorno: number;
}

export function SecaoGargalos({ numero, contagens, onde }: { numero: number; contagens: ContagemGargalos; onde: string }) {
  return (
    <>
      <Secao
        numero={numero}
        titulo="Pendências de hoje"
        descricao={`Gestantes ${onde} paradas em algum ponto do rastreio — situação no dia do relatório (não depende do período). A lista com os nomes está no apêndice.`}
      />
      <Bloco>
        <Grade colunas={3}>
          <CartaoGargalo
            titulo="Sem glicemia de jejum na 1ª consulta"
            descricao="Já foram atendidas, mas ainda não têm a glicemia de jejum registrada."
            valor={contagens.sem_gj_primeira_consulta}
            cor="#CA8A04"
            fundo="#FEFCE8"
          />
          <CartaoGargalo
            titulo="Curva glicêmica (GTT 75g) em atraso"
            descricao="Com 28 semanas ou mais e ainda sem a curva glicêmica registrada."
            valor={contagens.atrasadas_gtt}
            cor="#EA580C"
            fundo="#FFF7ED"
          />
          <CartaoGargalo
            titulo="Diabetes confirmado sem retorno"
            descricao="Diagnosticadas e sem nenhum atendimento registrado há mais de 14 dias."
            valor={contagens.confirmadas_sem_retorno}
            cor="#DC2626"
            fundo="#FEF2F2"
          />
        </Grade>
      </Bloco>
    </>
  );
}

export interface PontoTendencia {
  mes_label: string;
  total_gestantes: number;
  total_dmg_confirmadas: number;
  prevalencia_pct?: number | null;
}

export function SecaoTendencia({
  numero,
  dados,
  descricao,
}: {
  numero: number;
  dados: PontoTendencia[];
  descricao: string;
}) {
  return (
    <>
      <Secao numero={numero} titulo="Tendência" descricao={descricao} />
      <Bloco>
        <Cartao>
          {dados.length === 0 ? (
            <Nota>Sem dados para o período.</Nota>
          ) : (
            <LineChart width={706} height={220} data={dados} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="mes_label" stroke="#64748B" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
              <YAxis stroke="#64748B" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} allowDecimals={false} />
              <Legend wrapperStyle={{ fontSize: 10.5 }} />
              <Line type="monotone" dataKey="total_gestantes" name="Gestantes acompanhadas" stroke={COR.lilas} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="total_dmg_confirmadas" name="Diabetes confirmado" stroke={COR.roxo} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
            </LineChart>
          )}
        </Cartao>
      </Bloco>
      {dados.length > 0 && (
        <Bloco>
          <Tabela
            colunas={[
              { titulo: "Mês" },
              ...dados.map((d) => ({ titulo: d.mes_label, alinhar: "right" as const })),
            ]}
            linhas={[
              ["Gestantes", ...dados.map((d) => num(d.total_gestantes))],
              ["Diabetes", ...dados.map((d) => num(d.total_dmg_confirmadas))],
              ...(dados.some((d) => d.prevalencia_pct != null)
                ? [["Taxa", ...dados.map((d) => pct(d.prevalencia_pct))]]
                : []),
            ]}
          />
        </Bloco>
      )}
    </>
  );
}

export interface GestanteApendice {
  nome: string;
  unidade?: string | null;
  ig: string;
  ultima: string;
  profissional: string;
}

export function ApendiceGargalos({
  numero,
  grupos,
  comUnidade,
  limite,
}: {
  numero: number | string;
  grupos: Array<{ titulo: string; cor: string; total: number; lista: GestanteApendice[] }>;
  comUnidade?: boolean;
  limite: number;
}) {
  return (
    <>
      <Secao
        numero={numero}
        titulo="Apêndice — gestantes nas pendências"
        descricao={`Situação no dia do relatório. Até ${limite} gestantes por pendência, das mais antigas para as mais recentes.`}
      />
      {grupos.map((g) => (
        <GrupoApendice key={g.titulo} grupo={g} comUnidade={comUnidade} />
      ))}
    </>
  );
}

function GrupoApendice({
  grupo,
  comUnidade,
}: {
  grupo: { titulo: string; cor: string; total: number; lista: GestanteApendice[] };
  comUnidade?: boolean;
}) {
  const colunas = [
    { titulo: "Gestante" },
    ...(comUnidade ? [{ titulo: "Unidade" }] : []),
    { titulo: "IG hoje", largura: 80, semQuebra: true },
    { titulo: "Última consulta", largura: 96, semQuebra: true },
    { titulo: "Profissional" },
  ];
  const linhas = grupo.lista.map((p) => [p.nome, ...(comUnidade ? [p.unidade ?? "—"] : []), p.ig, p.ultima, p.profissional]);
  return (
    <>
      <Bloco manterComProximo>
        <div style={{ fontFamily: FONTE_TITULO, fontWeight: 600, fontSize: 12.5, color: grupo.cor, paddingTop: 6 }}>
          {grupo.titulo} ({num(grupo.total)})
          {grupo.lista.length > 0 && grupo.total > grupo.lista.length && (
            <span style={{ fontWeight: 400, fontSize: 10, color: COR.muted }}> — mostrando {num(grupo.lista.length)}</span>
          )}
        </div>
      </Bloco>
      <TabelaEmBlocos
        colunas={colunas}
        linhas={linhas}
        vazio={grupo.total > 0 ? "Lista nominal indisponível no momento — veja no painel." : "Nenhuma gestante nesta pendência."}
      />
    </>
  );
}

export function NotaMetodologica({ numero, extra }: { numero: number | string; extra?: string[] }) {
  const itens = [
    "Taxa de diagnóstico: gestantes com diabetes confirmado (DMG ou diabetes que já existia antes da gravidez, o overt) entre as gestantes rastreadas no período. A faixa esperada para a população geral é de 7% a 18% (Febrasgo).",
    "Rastreadas: gestantes com glicemia de jejum ou curva glicêmica (GTT 75g) registrada no período.",
    "Perda de seguimento: gestantes com diabetes do período cujo acompanhamento foi encerrado como \"não retornou\".",
    "Gestantes ativas e pendências mostram a situação no dia em que o relatório foi gerado; os demais números seguem o período escolhido.",
    "Insulina encerra o acompanhamento pela MARI: a gestante segue no serviço que cuida da insulina.",
    ...(extra ?? []),
  ];
  return (
    <>
      <Secao numero={numero} titulo="Como ler este relatório" />
      <Bloco>
        <Cartao style={{ background: COR.fundo }}>
          {itens.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 10.5, color: COR.corpo, lineHeight: 1.55, marginTop: i ? 4 : 0 }}>
              <span style={{ color: COR.lilas, fontWeight: 700 }}>•</span>
              <span>{t}</span>
            </div>
          ))}
        </Cartao>
      </Bloco>
    </>
  );
}

/** Situação de um indicador com meta para a matriz "metas por unidade". */
export function celulaMeta(bloco: LinhaCuidadoBloco, chave: (typeof INDICADORES_META)[number]["chave"], metas: MetasRede | null | undefined) {
  const r = avaliarIndicador(bloco, chave, metas);
  const valor = CFG_META[chave].unidade === "pct" ? pct(r.valor) : dias(r.valor);
  const tom: Tom = r.situacao === "atingida" ? "bom" : r.situacao === "nao_atingida" ? "alerta" : "neutro";
  const marca = r.situacao === "atingida" ? "✓" : r.situacao === "nao_atingida" ? "✗" : "i";
  return { valor, tom, marca, situacao: r.situacao };
}
