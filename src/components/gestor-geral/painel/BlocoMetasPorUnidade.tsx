import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { RefreshCw, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TooltipInfo from "@/components/gestor-geral/TooltipInfo";
import { IconeSituacao } from "@/components/gestao/SeloMeta";
import { useFormatarMeta, useTextoSituacao } from "@/hooks/useTextosMeta";
import { useLinhaCuidadoPorUnidade, useMetasRedes } from "@/hooks/useMetasRede";
import {
  BASE_MINIMA_META,
  CFG_META,
  INDICADORES_META,
  avaliarIndicador,
  resumoMetas,
  temMetas,
  type IndicadorMeta,
  type MetasRede,
} from "@/lib/metas";

/** "Metas por unidade": cada unidade × indicador, comparada com a meta da rede dela. */
export default function BlocoMetasPorUnidade() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const base = pathname.startsWith("/vitrine") ? "/vitrine/consolidar" : "/consolidar";
  const q = useLinhaCuidadoPorUnidade();
  const linhas = q.data ?? [];
  const metasQ = useMetasRedes(linhas.map((l) => l.contratante_id));
  const metasPorRede = metasQ.data ?? {};
  const formatar = useFormatarMeta();
  const textoSituacao = useTextoSituacao();

  const redes = Array.from(new Set(linhas.map((l) => l.contratante_id ?? "")));
  // Uma rede só: a meta vai no cabeçalho da coluna; várias: em cada célula.
  const metasUnicas: MetasRede | null = redes.length === 1 ? metasPorRede[redes[0]] ?? {} : null;
  const algumaMeta = Object.values(metasPorRede).some(temMetas);

  const textoMeta = (ind: IndicadorMeta, v: number) =>
    t(CFG_META[ind].sentido === "maximo" ? "gestao.metas.metaMaxCurta" : "gestao.metas.metaMinCurta", { valor: formatar(ind, v) });

  const carregando = q.isLoading || metasQ.isLoading;

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Target className="h-4 w-4 text-[#7E69AB]" aria-hidden />
          <h2 className="text-base font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
            {t("gestao.metas.porUnidadeTitulo")}
          </h2>
          <TooltipInfo text={t("gestao.metas.porUnidadeTip", { n: BASE_MINIMA_META })} />
        </div>
        <p className="text-xs text-[#64748B] mt-0.5">{t("gestao.metas.porUnidadeSubtitulo")}</p>
      </div>

      {q.isError || metasQ.isError ? (
        <div className="p-5">
          <p className="text-sm text-[#991B1B]">{t("gestao.metas.porUnidadeErro")}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => { q.refetch(); metasQ.refetch(); }}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            {t("gestorGeral.blocoRanking.reload")}
          </Button>
        </div>
      ) : carregando ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </div>
      ) : linhas.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#64748B]">{t("gestorGeral.blocoRanking.empty")}</div>
      ) : !algumaMeta ? (
        <div className="p-6 text-center text-sm text-[#64748B]">
          {t("gestao.metas.porUnidadeSemMetas")}{" "}
          <Link to={`${base}/configuracoes`} className="font-medium text-[#7E69AB] hover:underline">
            {t("gestao.metas.irParaConfiguracoes")}
          </Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#E8E0FF] hover:bg-[#E8E0FF] [&>th]:font-semibold [&>th]:text-[#1E293B]">
                  <TableHead>{t("gestorGeral.blocoRanking.colUnidade")}</TableHead>
                  {INDICADORES_META.map(({ chave }) => (
                    <TableHead key={chave} className="min-w-[120px]">
                      <span className="inline-flex items-center gap-1">
                        {t(`gestao.metas.curto_${chave}`)}
                        <TooltipInfo text={t(`gestao.metas.desc_${chave}`)} />
                      </span>
                      {metasUnicas?.[chave] != null && (
                        <span className="block text-[11px] font-normal text-[#475569]">{textoMeta(chave, metasUnicas[chave]!)}</span>
                      )}
                    </TableHead>
                  ))}
                  <TableHead>{t("gestao.metas.colResumo")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const metas = metasPorRede[l.contratante_id ?? ""] ?? {};
                  const r = resumoMetas(l.atual, metas);
                  return (
                    <TableRow key={l.unidade_id}>
                      <TableCell className="font-medium text-[#1E293B]">{l.unidade_nome}</TableCell>
                      {INDICADORES_META.map(({ chave }) => {
                        const av = avaliarIndicador(l.atual, chave, metas);
                        const sit = textoSituacao(chave, av.situacao);
                        const fraco = av.situacao === "poucos_dados" || av.situacao === "sem_dados" || av.situacao === "sem_meta";
                        return (
                          <TableCell key={chave}>
                            <span className="inline-flex items-center gap-1.5" title={sit ?? undefined}>
                              <IconeSituacao situacao={av.situacao} />
                              <span className={`tabular-nums ${fraco ? "text-[#94A3B8]" : "text-[#1E293B]"}`}>
                                {av.valor == null ? "—" : formatar(chave, av.valor)}
                              </span>
                              {sit && <span className="sr-only">{sit}</span>}
                            </span>
                            {!metasUnicas && av.meta != null && (
                              <span className="block text-[11px] text-[#94A3B8]">{textoMeta(chave, av.meta)}</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-sm text-[#475569]">
                        {r.definidas === 0
                          ? "—"
                          : r.avaliadas === 0
                            ? t("gestao.metas.poucosDados")
                            : t("gestao.metas.resumo", { atingidas: r.atingidas, avaliadas: r.avaliadas })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-[11px] text-[#64748B]">
            <span className="inline-flex items-center gap-1"><IconeSituacao situacao="atingida" className="h-3.5 w-3.5" />{t("gestao.metas.atingida")}</span>
            <span className="inline-flex items-center gap-1"><IconeSituacao situacao="nao_atingida" className="h-3.5 w-3.5" />{t("gestao.metas.legendaNaoAtingida")}</span>
            <span className="inline-flex items-center gap-1"><IconeSituacao situacao="poucos_dados" className="h-3.5 w-3.5" />{t("gestao.metas.legendaPoucosDados", { n: BASE_MINIMA_META })}</span>
          </div>
        </>
      )}
    </div>
  );
}
