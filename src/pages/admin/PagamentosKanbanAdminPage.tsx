import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Archive, BadgeCheck, CalendarClock, CheckCircle2, Clock, Mail,
  MessageCircle, RefreshCw, Search, Wallet,
} from "lucide-react";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import { apenasDigitos } from "@/lib/whatsapp";
import type { ProfissionalConsultorio } from "@/components/admin/profissionais/DrawerProfissional";
import type { PagamentoConta } from "../../../supabase/functions/_shared/pagamentosConta";
import {
  COLUNAS_KANBAN, situacaoKanban, type ColunaKanban, type SituacaoKanban,
} from "../../../supabase/functions/_shared/kanbanPagamentos";
import { PREVIEW_KANBAN_HOJE, previewKanbanPagamentos, previewKanbanProfissionais } from "@/lib/previewKanbanPagamentos";

// Kanban de pagamentos e renovações (planos de consultório).
// Cada conta fica em UMA coluna, pela situação que pede ação primeiro
// (encerrado → atraso → renovar → vence em breve → quitado → em dia); o cartão
// mostra o mês do ano e as parcelas da compra atual. Parcelas vêm do Asaas
// (edge function kanban-pagamentos) — os cartões mudam de coluna sozinhos.

interface PedidoAberto { profissional_id: string | null }

interface CartaoKanban {
  p: ProfissionalConsultorio;
  s: SituacaoKanban;
  falhaAsaas: boolean;
}

const ESTILO_COLUNA: Record<ColunaKanban, { icon: typeof Clock; cor: string; fundo: string; borda: string }> = {
  em_dia: { icon: CheckCircle2, cor: "text-[#2F7E98]", fundo: "bg-[#F1FAFB]", borda: "border-[#CCE8EE]" },
  vence_em_breve: { icon: Clock, cor: "text-amber-700", fundo: "bg-amber-50", borda: "border-amber-200" },
  atraso: { icon: AlertTriangle, cor: "text-red-700", fundo: "bg-red-50", borda: "border-red-200" },
  quitado: { icon: BadgeCheck, cor: "text-emerald-700", fundo: "bg-emerald-50", borda: "border-emerald-200" },
  renovar: { icon: CalendarClock, cor: "text-[#5B3A8E]", fundo: "bg-[#F5F0FF]", borda: "border-[#D6BCFA]" },
  encerrado: { icon: Archive, cor: "text-slate-600", fundo: "bg-slate-50", borda: "border-slate-200" },
};

const COR_PARCELA: Record<string, string> = {
  pago: "bg-emerald-500",
  vencido: "bg-red-500",
  a_vencer: "bg-white border border-slate-400",
  em_analise: "bg-amber-400",
};

function linkWhatsapp(telefone: string | null | undefined): string | null {
  const d = apenasDigitos(telefone ?? "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith("55") && d.length > 11 ? d : `55${d}`}`;
}

export default function PagamentosKanbanAdminPage() {
  const { t, i18n } = useTranslation();
  const isPreview = useLocation().pathname.startsWith("/vitrine");
  const [busca, setBusca] = useState("");
  const [forma, setForma] = useState("todas");

  const fmtData = (d: string | null | undefined) =>
    d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
  const fmtValor = (v: number) =>
    v.toLocaleString(i18n.language, { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const profsQ = useQuery({
    queryKey: ["profissionais-consultorio"],
    enabled: !isPreview,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-profissionais-consultorio",
        { body: { acao: "listar_profissionais_consultorio" } },
      );
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return (data?.profissionais ?? []) as ProfissionalConsultorio[];
    },
  });

  const pagamentosQ = useQuery({
    queryKey: ["admin-kanban-pagamentos"],
    enabled: !isPreview,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("kanban-pagamentos", { body: { acao: "listar" } });
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return data as { hoje: string; pagamentos: Record<string, PagamentoConta[]>; falhas: string[] };
    },
  });

  const pedidosQ = useQuery({
    queryKey: ["admin-pedidos-nao-renovacao-abertos"],
    enabled: !isPreview,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_nao_renovacao")
        .select("profissional_id")
        .is("desfeito_em", null);
      if (error) throw error;
      return (data ?? []) as PedidoAberto[];
    },
  });

  const profs = isPreview ? previewKanbanProfissionais : profsQ.data;
  const dadosPagamentos = useMemo(
    () => (isPreview
      ? { hoje: PREVIEW_KANBAN_HOJE, pagamentos: previewKanbanPagamentos, falhas: [] as string[] }
      : pagamentosQ.data),
    [isPreview, pagamentosQ.data],
  );
  const pedidos = useMemo(() => (isPreview ? [] : pedidosQ.data), [isPreview, pedidosQ.data]);

  const cartoes = useMemo<CartaoKanban[]>(() => {
    if (!profs || !dadosPagamentos) return [];
    const comPedido = new Set((pedidos ?? []).map((x) => x.profissional_id).filter(Boolean));
    const falhas = new Set(dadosPagamentos.falhas);
    return profs.map((p) => ({
      p,
      falhaAsaas: falhas.has(p.id),
      s: situacaoKanban(
        { ...p, pedido_nao_renovar: comPedido.has(p.id) },
        dadosPagamentos.pagamentos[p.id] ?? [],
        dadosPagamentos.hoje,
      ),
    }));
  }, [profs, dadosPagamentos, pedidos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return cartoes.filter(({ p, s }) => {
      if (q && !`${p.nome} ${p.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (forma === "todas") return true;
      if (forma === "pix_boleto") return s.forma === "PIX" || s.forma === "BOLETO" || s.forma === "UNDEFINED";
      return s.forma === forma;
    });
  }, [cartoes, busca, forma]);

  const porColuna = useMemo(() => {
    const m = new Map<ColunaKanban, CartaoKanban[]>(COLUNAS_KANBAN.map((c) => [c, []]));
    for (const c of filtrados) m.get(c.s.coluna)!.push(c);
    // Mais urgente no topo de cada coluna.
    m.get("atraso")!.sort((a, b) => (b.s.diasAtraso ?? 0) - (a.s.diasAtraso ?? 0));
    m.get("renovar")!.sort((a, b) => (a.s.diasParaVencer ?? 0) - (b.s.diasParaVencer ?? 0));
    m.get("vence_em_breve")!.sort((a, b) => (a.s.proximoVencimento ?? "").localeCompare(b.s.proximoVencimento ?? ""));
    // Ordem alfabética sem o "Dr./Dra." na frente.
    const semTitulo = (n: string) => n.replace(/^dr(a)?\.?\s+/i, "");
    for (const c of ["em_dia", "quitado", "encerrado"] as ColunaKanban[]) {
      m.get(c)!.sort((a, b) => semTitulo(a.p.nome).localeCompare(semTitulo(b.p.nome), i18n.language));
    }
    return m;
  }, [filtrados, i18n.language]);

  // Resumo para o comercial/financeiro.
  const resumo = useMemo(() => {
    let valorAtraso = 0;
    let aReceber30 = 0;
    const hoje = dadosPagamentos?.hoje ?? "";
    const limite = hoje ? new Date(new Date(`${hoje}T12:00:00Z`).getTime() + 30 * 86400000).toISOString().slice(0, 10) : "";
    for (const { s } of cartoes) {
      if (s.coluna === "encerrado") continue;
      for (const parc of s.parcelas) {
        if (parc.situacao === "vencido") valorAtraso += parc.valor;
        if (parc.situacao === "a_vencer" && parc.vencimento && parc.vencimento <= limite) aReceber30 += parc.valor;
      }
    }
    return {
      valorAtraso,
      aReceber30,
      emAtraso: cartoes.filter((c) => c.s.coluna === "atraso").length,
      renovar: cartoes.filter((c) => c.s.coluna === "renovar").length,
    };
  }, [cartoes, dadosPagamentos]);

  const carregando = !isPreview && (profsQ.isLoading || pagamentosQ.isLoading || pedidosQ.isLoading);
  const erro = !isPreview && (profsQ.isError || pagamentosQ.isError || pedidosQ.isError);

  const nomeForma = (f: string | null) => {
    if (f === "CREDIT_CARD") return t("admin.pagamentosKanban.forma.cartao");
    if (f === "PIX") return t("admin.pagamentosKanban.forma.pix");
    if (f === "BOLETO") return t("admin.pagamentosKanban.forma.boleto");
    if (f === "UNDEFINED") return t("admin.pagamentosKanban.forma.aEscolher");
    return null;
  };

  const tags = ({ s, falhaAsaas }: CartaoKanban) => {
    const lista: Array<{ texto: string; classe: string }> = [];
    const n = s.parcelas.length;
    if (s.coluna === "atraso") {
      const vencida = s.parcelas.find((x) => x.situacao === "vencido");
      lista.push({
        texto: vencida
          ? t("admin.pagamentosKanban.tag.atraso", { parcela: vencida.numero, count: s.diasAtraso ?? 0 })
          : t("admin.pagamentosKanban.tag.inadimplente"),
        classe: "bg-red-100 text-red-700",
      });
    }
    if (s.coluna === "vence_em_breve" && s.proximoVencimento) {
      lista.push({ texto: t("admin.pagamentosKanban.tag.vence", { data: fmtData(s.proximoVencimento) }), classe: "bg-amber-100 text-amber-800" });
    }
    if (s.coluna === "quitado") {
      lista.push({
        texto: n === 1 ? t("admin.pagamentosKanban.tag.aVista") : t("admin.pagamentosKanban.tag.quitado", { n }),
        classe: "bg-emerald-100 text-emerald-700",
      });
    }
    if (s.coluna === "renovar" && s.fimDoCiclo) {
      lista.push({ texto: t("admin.pagamentosKanban.tag.renovar", { data: fmtData(s.fimDoCiclo), count: s.diasParaVencer ?? 0 }), classe: "bg-[#EDE7FB] text-[#5B3A8E]" });
    }
    if (s.coluna === "encerrado" && s.motivoEncerrado) {
      lista.push({
        texto: s.motivoEncerrado === "vencido"
          ? t("admin.pagamentosKanban.tag.vencido", { data: fmtData(s.fimDoCiclo) })
          : t(`admin.pagamentosKanban.tag.${s.motivoEncerrado}`),
        classe: "bg-slate-100 text-slate-600",
      });
    }
    if (s.pedidoNaoRenovar) lista.push({ texto: t("admin.pagamentosKanban.tag.naoRenova"), classe: "bg-red-50 text-red-700" });
    if (falhaAsaas) lista.push({ texto: t("admin.pagamentosKanban.tag.falhaAsaas"), classe: "bg-amber-50 text-amber-800" });
    else if (s.semCobrancas && s.coluna !== "encerrado") lista.push({ texto: t("admin.pagamentosKanban.tag.semCobrancas"), classe: "bg-slate-100 text-slate-600" });
    return lista;
  };

  const Cartao = ({ c }: { c: CartaoKanban }) => {
    const { p, s } = c;
    const wa = linkWhatsapp(p.telefone);
    const formaTxt = nomeForma(s.forma);
    const parcelado = s.parcelas.length > 1;
    return (
      <div className={`rounded-xl border bg-white p-3 shadow-sm ${s.coluna === "atraso" ? "border-red-300" : "border-[#E2E8F0]"}`}>
        <p className="truncate font-[Sora] text-sm font-semibold text-[#1E293B]" title={p.nome}>{p.nome}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[p.plano_nome, formaTxt && (parcelado ? `${formaTxt} ${s.parcelas.length}x` : formaTxt)].filter(Boolean).join(" · ")}
        </p>
        {s.mes != null && s.coluna !== "encerrado" && (
          <p className="text-xs text-muted-foreground">{t("admin.pagamentosKanban.mesDe", { mes: s.mes })}</p>
        )}
        {parcelado && (
          <div className="mt-2 flex flex-wrap gap-1" aria-label={t("admin.pagamentosKanban.parcelasPagas", { pagas: s.pagas, total: s.parcelas.length })}>
            {s.parcelas.map((x) => (
              <span
                key={`${x.numero}-${x.vencimento}`}
                title={`${t("admin.pagamentosKanban.parcela", { n: x.numero })} · ${fmtData(x.vencimento)} · ${t(`admin.pagamentosKanban.situacao.${x.situacao}`)}`}
                className={`h-2.5 w-2.5 rounded-full ${COR_PARCELA[x.situacao] ?? "bg-slate-300"}`}
              />
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1">
          {tags(c).map((tg) => (
            <span key={tg.texto} className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${tg.classe}`}>{tg.texto}</span>
          ))}
        </div>
        {(wa || p.email) && (
          <div className="mt-2 flex items-center gap-3 border-t border-[#F1F5F9] pt-2 text-xs">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[#1EBE5A] hover:underline">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} className="inline-flex min-w-0 items-center gap-1 text-[#5B3A8E] hover:underline">
                <Mail className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{p.email}</span>
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">{t("admin.pagamentosKanban.titulo")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("admin.pagamentosKanban.subtitulo")}</p>
        </div>
        {!isPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { profsQ.refetch(); pagamentosQ.refetch(); pedidosQ.refetch(); }}
            disabled={pagamentosQ.isFetching}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${pagamentosQ.isFetching ? "animate-spin" : ""}`} />
            {t("admin.pagamentosKanban.atualizar")}
          </Button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica icon={<AlertTriangle className="h-5 w-5" />} label={t("admin.pagamentosKanban.kpiValorAtraso")} value={fmtValor(resumo.valorAtraso)} detalhe={t("admin.pagamentosKanban.kpiContas", { count: resumo.emAtraso })} color="bg-red-100 text-red-700" />
        <Metrica icon={<Wallet className="h-5 w-5" />} label={t("admin.pagamentosKanban.kpiAReceber")} value={fmtValor(resumo.aReceber30)} color="bg-emerald-100 text-emerald-700" />
        <Metrica icon={<CalendarClock className="h-5 w-5" />} label={t("admin.pagamentosKanban.kpiRenovar")} value={resumo.renovar} color="bg-[#EDE7FB] text-[#5B3A8E]" />
        <Metrica icon={<CheckCircle2 className="h-5 w-5" />} label={t("admin.pagamentosKanban.kpiContasAtivas")} value={cartoes.filter((c) => c.s.coluna !== "encerrado").length} color="bg-[#E0F2F7] text-[#2F7E98]" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t("admin.pagamentosKanban.buscar")} className="pl-9" />
        </div>
        <Select value={forma} onValueChange={setForma}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">{t("admin.pagamentosKanban.filtro.todas")}</SelectItem>
            <SelectItem value="CREDIT_CARD">{t("admin.pagamentosKanban.forma.cartao")}</SelectItem>
            <SelectItem value="pix_boleto">{t("admin.pagamentosKanban.filtro.pixBoleto")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {erro && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{t("admin.pagamentosKanban.erro")}</p>}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max gap-4">
          {COLUNAS_KANBAN.map((col) => {
            const est = ESTILO_COLUNA[col];
            const Icone = est.icon;
            const lista = porColuna.get(col) ?? [];
            return (
              <section key={col} className={`flex w-[270px] shrink-0 flex-col rounded-2xl border ${est.borda} ${est.fundo} p-3`}>
                <header className="mb-1 flex items-center gap-2">
                  <Icone className={`h-4 w-4 ${est.cor}`} />
                  <h2 className={`font-[Sora] text-sm font-semibold ${est.cor}`}>{t(`admin.pagamentosKanban.coluna.${col}`)}</h2>
                  <span className="ml-auto rounded-full bg-white px-2 text-xs font-medium text-muted-foreground">{carregando ? "…" : lista.length}</span>
                </header>
                <p className="mb-3 text-[11px] leading-snug text-muted-foreground">{t(`admin.pagamentosKanban.ajuda.${col}`)}</p>
                <div className="flex flex-col gap-2">
                  {carregando && [0, 1].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                  {!carregando && lista.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-3 text-center text-xs text-muted-foreground">
                      {t("admin.pagamentosKanban.vazio")}
                    </p>
                  )}
                  {lista.map((c) => <Cartao key={c.p.id} c={c} />)}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${COR_PARCELA.pago}`} /> {t("admin.pagamentosKanban.situacao.pago")}</span>
        <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${COR_PARCELA.vencido}`} /> {t("admin.pagamentosKanban.situacao.vencido")}</span>
        <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${COR_PARCELA.a_vencer}`} /> {t("admin.pagamentosKanban.situacao.a_vencer")}</span>
      </div>
    </div>
  );
}

function Metrica({ icon, label, value, detalhe, color }: {
  icon: React.ReactNode; label: string; value: string | number; detalhe?: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs leading-tight text-muted-foreground">{label}</p>
        <p className="whitespace-nowrap font-[Sora] text-lg font-semibold text-[#2A1B47] xl:text-xl">{value}</p>
        {detalhe && <p className="text-[11px] text-muted-foreground">{detalhe}</p>}
      </div>
    </div>
  );
}
