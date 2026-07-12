import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, Search, Users, UserCheck, Clock, DollarSign } from "lucide-react";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import ModalCadastrarProfissionalConsultorio from "@/components/admin/profissionais/ModalCadastrarProfissionalConsultorio";
import DrawerProfissional, {
  type ProfissionalConsultorio,
} from "@/components/admin/profissionais/DrawerProfissional";

type AtivField = "ultimo_laudo" | "ultimo_login";
type Periodo = "todos" | "hoje" | "7d" | "30d" | "mais30" | "nunca";
type StatusPgto = "todos" | "ativo" | "atrasado" | "sem";

function fmtData(d: string | null, locale: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function dentroPeriodo(d: string | null, periodo: Periodo): boolean {
  if (periodo === "todos") return true;
  if (periodo === "nunca") return !d;
  if (!d) return false;
  const dt = new Date(d).getTime();
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  if (periodo === "hoje") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return dt >= today.getTime();
  }
  if (periodo === "7d") return dt >= now - 7 * day;
  if (periodo === "30d") return dt >= now - 30 * day;
  if (periodo === "mais30") return dt < now - 30 * day;
  return true;
}

export default function ProfissionaisConsultorioPage() {
  const { t, i18n } = useTranslation();
  const [busca, setBusca] = useState("");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<StatusPgto>("todos");
  const [ativField, setAtivField] = useState<AtivField>("ultimo_laudo");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [openCadastrar, setOpenCadastrar] = useState(false);
  const [drawer, setDrawer] = useState<ProfissionalConsultorio | null>(null);

  const { data: planosOpt = [] } = useQuery({
    queryKey: ["planos-ativos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("planos")
        .select("id, nome, ativo, ordem")
        .eq("ativo", true)
        .order("ordem");
      return data ?? [];
    },
  });

  const { data: profissionais = [], isLoading, isError } = useQuery({
    queryKey: ["profissionais-consultorio"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "gerenciar-profissionais-consultorio",
        { body: { acao: "listar_profissionais_consultorio" } }
      );
      if (error) {
        await extrairErroEdge(error);
        throw new Error(FALLBACK_GENERICO);
      }
      return (data?.profissionais ?? []) as ProfissionalConsultorio[];
    },
  });

  // Mantém drawer sincronizado com refetch
  const drawerAtual = drawer
    ? profissionais.find((p) => p.id === drawer.id) ?? drawer
    : null;

  const metricas = useMemo(() => {
    const total = profissionais.length;
    const ativos = profissionais.filter((p) => !p.acesso_revogado && !p.convite_pendente).length;
    const pendentes = profissionais.filter((p) => p.convite_pendente).length;
    const mrr = profissionais
      .filter((p) => p.plano_status === "ativo" && !p.acesso_revogado)
      .reduce((s, p) => s + Number(p.plano_preco ?? 0), 0);
    return { total, ativos, pendentes, mrr };
  }, [profissionais]);

  const linhas = useMemo(() => {
    let r = [...profissionais];
    if (filtroPlano !== "todos") r = r.filter((p) => p.plano_id === filtroPlano);
    if (filtroStatus !== "todos") {
      r = r.filter((p) => {
        if (filtroStatus === "ativo") return p.plano_status === "ativo" && p.asaas_subscription_id;
        if (filtroStatus === "atrasado") return p.plano_status === "inadimplente";
        if (filtroStatus === "sem") return !p.asaas_subscription_id;
        return true;
      });
    }
    if (periodo !== "todos") {
      r = r.filter((p) => dentroPeriodo(p[ativField], periodo));
    }
    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      r = r.filter((p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.crm ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [profissionais, filtroPlano, filtroStatus, ativField, periodo, busca]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">{t("admin.profissionaisConsultorio.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.profissionaisConsultorio.subtitle")}
        </p>
      </header>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={<Users className="h-5 w-5" />} label={t("admin.profissionaisConsultorio.totalProfessionals")} value={metricas.total} color="bg-slate-100 text-slate-700" />
        <MetricCard icon={<UserCheck className="h-5 w-5" />} label={t("admin.profissionaisConsultorio.totalActive")} value={metricas.ativos} color="bg-green-100 text-green-700" />
        <MetricCard icon={<Clock className="h-5 w-5" />} label={t("admin.profissionaisConsultorio.pendingInvites")} value={metricas.pendentes} color="bg-amber-100 text-amber-800" />
        <MetricCard icon={<DollarSign className="h-5 w-5" />} label={t("admin.profissionaisConsultorio.estimatedMrr")} value={`R$ ${metricas.mrr.toFixed(2)}`} color="bg-[#EFE7FB] text-[#5B3A8E]" />
      </div>

      {/* Filtros + cadastrar */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.profissionaisConsultorio.plan")}</label>
            <Select value={filtroPlano} onValueChange={setFiltroPlano}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("admin.profissionaisConsultorio.allPlans")}</SelectItem>
                {planosOpt.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.profissionaisConsultorio.paymentStatus")}</label>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as StatusPgto)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("common.all")}</SelectItem>
                <SelectItem value="ativo">{t("admin.profissionaisConsultorio.statusActive")}</SelectItem>
                <SelectItem value="atrasado">{t("admin.profissionaisConsultorio.statusLate")}</SelectItem>
                <SelectItem value="sem">{t("admin.profissionaisConsultorio.statusNone")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.profissionaisConsultorio.activity")}</label>
            <ToggleGroup type="single" value={ativField} onValueChange={(v) => v && setAtivField(v as AtivField)} className="border rounded-md">
              <ToggleGroupItem value="ultimo_laudo" className="px-3">{t("admin.profissionaisConsultorio.lastReport")}</ToggleGroupItem>
              <ToggleGroupItem value="ultimo_login" className="px-3">{t("admin.profissionaisConsultorio.lastLogin")}</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("admin.profissionaisConsultorio.period")}</label>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">{t("common.all")}</SelectItem>
                <SelectItem value="hoje">{t("admin.profissionaisConsultorio.periodToday")}</SelectItem>
                <SelectItem value="7d">{t("admin.profissionaisConsultorio.period7d")}</SelectItem>
                <SelectItem value="30d">{t("admin.profissionaisConsultorio.period30d")}</SelectItem>
                <SelectItem value="mais30">{t("admin.profissionaisConsultorio.periodMore30")}</SelectItem>
                <SelectItem value="nunca">{t("admin.profissionaisConsultorio.periodNever")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("common.search")}</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("admin.profissionaisConsultorio.searchPlaceholder")}
                className="pl-8 w-[260px]"
              />
            </div>
          </div>
        </div>
        <Button onClick={() => setOpenCadastrar(true)} className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]">
          <Plus className="mr-2 h-4 w-4" /> {t("admin.profissionaisConsultorio.register")}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {isLoading ? t("common.loading") : t("admin.profissionaisConsultorio.count", { count: linhas.length })}
      </p>

      {/* Tabela */}
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-[#5B3A8E]">
              {[
                t("common.name"),
                t("common.email"),
                t("admin.profissionaisConsultorio.plan"),
                t("admin.profissionaisConsultorio.paymentStatus"),
                t("admin.profissionaisConsultorio.lastReport"),
                t("admin.profissionaisConsultorio.lastLogin"),
                t("common.actions"),
              ].map((h, i) => (
                <TableHead key={i} className={`bg-[#5B3A8E] font-[Sora] text-white ${i === 6 ? "text-right" : ""}`}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && [0, 1, 2].map((i) => (
              <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {!isLoading && isError && (
              <TableRow><TableCell colSpan={7} className="text-center text-destructive">{t("admin.profissionaisConsultorio.loadError")}</TableCell></TableRow>
            )}
            {!isLoading && !isError && linhas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("admin.profissionaisConsultorio.noProfessionals")}</TableCell></TableRow>
            )}
            {linhas.map((p, idx) => {
              const statusPgto = p.plano_status === "inadimplente"
                ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t("admin.profissionaisConsultorio.statusLate")}</Badge>
                : p.asaas_subscription_id
                  ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{t("admin.profissionaisConsultorio.statusActive")}</Badge>
                  : <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{t("admin.profissionaisConsultorio.statusNone")}</Badge>;
              return (
                <TableRow
                  key={p.id}
                  className={`cursor-pointer ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"} ${p.acesso_revogado ? "opacity-60" : ""}`}
                  onClick={() => setDrawer(p)}
                >
                  <TableCell className="font-medium">
                    {p.nome}
                    {p.acesso_revogado && <span className="ml-2 text-red-600" title={t("admin.profissionaisConsultorio.accessRevoked")}>⊘</span>}
                    {!p.acesso_revogado && p.convite_pendente && <span className="ml-2 text-amber-600" title={t("admin.profissionaisConsultorio.invitePending")}>⏳</span>}
                  </TableCell>
                  <TableCell className="text-sm">{p.email ?? "—"}</TableCell>
                  <TableCell>{p.plano_nome ?? "—"}</TableCell>
                  <TableCell>{statusPgto}</TableCell>
                  <TableCell>{fmtData(p.ultimo_laudo, i18n.language)}</TableCell>
                  <TableCell>{fmtData(p.ultimo_login, i18n.language)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setDrawer(p)}>{t("admin.profissionaisConsultorio.viewDetails")}</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ModalCadastrarProfissionalConsultorio open={openCadastrar} onOpenChange={setOpenCadastrar} />
      <DrawerProfissional profissional={drawerAtual} onClose={() => setDrawer(null)} />
    </div>
  );
}

function MetricCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-full grid place-items-center ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="font-[Sora] text-xl font-semibold text-[#2A1B47] truncate">{value}</p>
      </div>
    </div>
  );
}
