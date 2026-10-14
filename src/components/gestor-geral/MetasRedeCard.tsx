import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import { useMetasRedes, useSalvarMetasRede, type AlteracaoMeta } from "@/hooks/useMetasRede";
import { INDICADORES_META, lerValorMeta, type IndicadorMeta, type MetasRede } from "@/lib/metas";

type Textos = Record<IndicadorMeta, string>;

const paraTexto = (metas: MetasRede | undefined, locale: string): Textos =>
  Object.fromEntries(
    INDICADORES_META.map(({ chave }) => [
      chave,
      metas?.[chave] == null ? "" : Number(metas[chave]).toLocaleString(locale, { maximumFractionDigits: 1, useGrouping: false }),
    ]),
  ) as Textos;

/** Card "Metas da rede" (Configurações do gestor geral): uma meta opcional por indicador, por rede. */
export default function MetasRedeCard() {
  const { t, i18n } = useTranslation();
  const isVitrine = useLocation().pathname.startsWith("/vitrine");
  const { redes } = useFiltrosGestorGeral();
  const [redeEscolhida, setRedeEscolhida] = useState<string | null>(null);
  const redeId = redeEscolhida ?? redes[0]?.id ?? null;
  const metasQ = useMetasRedes(redes.map((r) => r.id));
  const salvar = useSalvarMetasRede();
  const atuais = useMemo(() => (redeId ? metasQ.data?.[redeId] : undefined) ?? {}, [metasQ.data, redeId]);
  const [textos, setTextos] = useState<Textos>(() => paraTexto(undefined, i18n.language));

  // Recarrega os campos ao trocar de rede ou quando as metas chegam do banco.
  useEffect(() => {
    setTextos(paraTexto(atuais, i18n.language));
  }, [atuais, i18n.language]);

  const lidos = INDICADORES_META.map((c) => ({ cfg: c, ...lerValorMeta(textos[c.chave] ?? "", c.chave) }));
  const temErro = lidos.some((l) => l.erro);
  const alteracoes: AlteracaoMeta[] = lidos
    .filter((l) => !l.erro && (l.valor ?? null) !== (atuais[l.cfg.chave] ?? null))
    .map((l) => ({ indicador: l.cfg.chave, valor: l.valor }));

  const onSalvar = async () => {
    if (!redeId || temErro || alteracoes.length === 0) return;
    try {
      await salvar.mutateAsync({ redeId, alteracoes });
      toast({
        title: t("gestao.metas.salvoTitulo"),
        description: isVitrine ? t("gestao.metas.vitrineAviso") : t("gestao.metas.salvoDesc"),
      });
    } catch (e) {
      console.error("Erro ao salvar metas da rede:", e);
      toast({ title: t("gestao.metas.erroSalvar"), variant: "destructive" });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <Target className="h-5 w-5 text-[#7E69AB] mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">{t("gestao.metas.cardTitulo")}</p>
          <p className="text-xs text-[#64748B]">{t("gestao.metas.cardSubtitulo")}</p>
        </div>
      </div>

      {redes.length === 0 ? (
        <p className="text-sm text-[#64748B]">{t("gestao.metas.semRedes")}</p>
      ) : (
        <>
          {redes.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#64748B]">{t("gestao.metas.rede")}</span>
              <Select value={redeId ?? ""} onValueChange={(v) => setRedeEscolhida(v)}>
                <SelectTrigger className="h-9 w-full sm:w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {redes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {metasQ.isError ? (
            <p className="text-sm text-[#991B1B]">{t("gestao.metas.loadError")}</p>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {lidos.map(({ cfg, erro }) => {
                const id = `meta-${cfg.chave}`;
                return (
                  <div key={cfg.chave} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={id} className="text-sm font-medium text-[#1E293B]">
                          {t(`gestao.metas.nome_${cfg.chave}`)}
                        </label>
                        <span className="rounded-full bg-[#F1F0FB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7E69AB]">
                          {t(cfg.sentido === "minimo" ? "gestao.metas.tipoMinimo" : "gestao.metas.tipoMaximo")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#64748B]">{t(`gestao.metas.desc_${cfg.chave}`)}</p>
                    </div>
                    <div className="shrink-0 sm:w-40">
                      <div className="flex items-center gap-2">
                        <Input
                          id={id}
                          inputMode="decimal"
                          value={textos[cfg.chave] ?? ""}
                          placeholder={t("gestao.metas.semMeta")}
                          disabled={metasQ.isLoading || salvar.isPending}
                          onChange={(e) => setTextos((s) => ({ ...s, [cfg.chave]: e.target.value }))}
                          aria-invalid={!!erro}
                          className="h-9"
                        />
                        <span className="w-8 shrink-0 text-xs text-[#64748B]">
                          {cfg.unidade === "pct" ? "%" : t("gestao.metas.unidadeDias")}
                        </span>
                      </div>
                      {erro && (
                        <p className="mt-1 text-[11px] text-[#B45309]">
                          {erro === "faixa"
                            ? t("gestao.metas.erroFaixa", { min: cfg.min, max: cfg.max })
                            : t("gestao.metas.erroInvalido")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
            <p className="text-[11px] text-[#94A3B8]">{t("gestao.metas.rodapeCard")}</p>
            <Button
              size="sm"
              onClick={onSalvar}
              disabled={!redeId || temErro || alteracoes.length === 0 || salvar.isPending || metasQ.isLoading}
              className="bg-[#7E69AB] hover:bg-[#6B5A96]"
            >
              {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {salvar.isPending ? t("gestao.metas.salvando") : t("gestao.metas.salvar")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
