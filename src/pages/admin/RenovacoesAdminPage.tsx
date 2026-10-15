import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CalendarClock, MessageCircle, Undo2, UserX, XCircle } from "lucide-react";
import { FALLBACK_GENERICO, extrairErroEdge } from "@/lib/mensagensUnicidade";
import { apenasDigitos } from "@/lib/whatsapp";
import type { ProfissionalConsultorio } from "@/components/admin/profissionais/DrawerProfissional";
import {
  DIAS_AVISO_RENOVACAO, fimDoCiclo, diasParaVencer,
} from "../../../supabase/functions/_shared/renovacao";

// Renovações do plano de consultório (a MARI é anuidade e não renova sozinha):
// quem vence nos próximos 60 dias (para o comercial entrar em contato), quem
// pediu para não renovar (e em que mês de uso) e quem venceu sem renovar.

interface Pedido {
  id: string;
  profissional_id: string | null;
  nome: string | null;
  email: string | null;
  plano_nome: string | null;
  ciclo_fim: string | null;
  mes_de_uso: number | null;
  dentro_garantia: boolean;
  motivo: string | null;
  comentario: string | null;
  criado_em: string;
  desfeito_em: string | null;
  desfeito_motivo: string | null;
}

function linkWhatsapp(telefone: string | null | undefined): string | null {
  const d = apenasDigitos(telefone ?? "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.startsWith("55") && d.length > 11 ? d : `55${d}`}`;
}

export default function RenovacoesAdminPage() {
  const { t, i18n } = useTranslation();
  const [aba, setAba] = useState("vencendo");
  const fmt = (d: string | Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString(i18n.language, { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

  const profsQ = useQuery({
    queryKey: ["profissionais-consultorio"],
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

  const pedidosQ = useQuery({
    queryKey: ["admin-pedidos-nao-renovacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_nao_renovacao")
        .select("id, profissional_id, nome, email, plano_nome, ciclo_fim, mes_de_uso, dentro_garantia, motivo, comentario, criado_em, desfeito_em, desfeito_motivo")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Pedido[];
    },
  });

  const profs = useMemo(() => profsQ.data ?? [], [profsQ.data]);
  const pedidos = useMemo(() => pedidosQ.data ?? [], [pedidosQ.data]);

  const pedidoAbertoPorProf = useMemo(() => {
    const m = new Map<string, Pedido>();
    for (const p of pedidos) if (p.profissional_id && !p.desfeito_em) m.set(p.profissional_id, p);
    return m;
  }, [pedidos]);

  const { vencendo, vencidos } = useMemo(() => {
    const agora = new Date();
    const vencendo: Array<{ p: ProfissionalConsultorio; fim: Date; dias: number }> = [];
    const vencidos: Array<{ p: ProfissionalConsultorio; fim: Date }> = [];
    for (const p of profs) {
      if (p.acesso_revogado) continue;
      const fim = fimDoCiclo(p);
      const dias = diasParaVencer(p, agora);
      if (!fim || dias === null) continue;
      if (dias >= 0 && dias <= DIAS_AVISO_RENOVACAO && p.plano_status === "ativo") vencendo.push({ p, fim, dias });
      else if (dias < 0) vencidos.push({ p, fim });
    }
    vencendo.sort((a, b) => a.dias - b.dias);
    vencidos.sort((a, b) => b.fim.getTime() - a.fim.getTime());
    return { vencendo, vencidos };
  }, [profs]);

  const abertos = pedidos.filter((p) => !p.desfeito_em);
  const reembolsos = abertos.filter((p) => p.dentro_garantia).length;
  const carregando = profsQ.isLoading || pedidosQ.isLoading;
  const erro = profsQ.isError || pedidosQ.isError;

  const cabecalho = (cols: string[]) => (
    <TableHeader>
      <TableRow className="hover:bg-[#5B3A8E]">
        {cols.map((h, i) => (
          <TableHead key={i} className="bg-[#5B3A8E] font-[Sora] text-white">{h}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
  const estado = (cols: number, vazio: boolean, textoVazio: string) => (
    <>
      {carregando && [0, 1, 2].map((i) => (
        <TableRow key={i}><TableCell colSpan={cols}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
      ))}
      {!carregando && erro && (
        <TableRow><TableCell colSpan={cols} className="text-center text-destructive">{t("admin.renovacoes.erro")}</TableCell></TableRow>
      )}
      {!carregando && !erro && vazio && (
        <TableRow><TableCell colSpan={cols} className="text-center text-muted-foreground">{textoVazio}</TableCell></TableRow>
      )}
    </>
  );
  const contato = (email: string | null | undefined, telefone?: string | null) => {
    const wa = linkWhatsapp(telefone);
    return (
      <div className="text-sm">
        <div>{email ?? "—"}</div>
        {wa && (
          <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#1EBE5A] hover:underline">
            <MessageCircle className="h-3 w-3" /> {telefone}
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">{t("admin.renovacoes.titulo")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.renovacoes.subtitulo")}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica icon={<CalendarClock className="h-5 w-5" />} label={t("admin.renovacoes.kpiVencendo")} value={vencendo.length} color="bg-amber-100 text-amber-800" />
        <Metrica icon={<UserX className="h-5 w-5" />} label={t("admin.renovacoes.kpiNaoRenovam")} value={abertos.length} color="bg-red-100 text-red-700" />
        <Metrica icon={<Undo2 className="h-5 w-5" />} label={t("admin.renovacoes.kpiReembolso")} value={reembolsos} color="bg-orange-100 text-orange-700" />
        <Metrica icon={<XCircle className="h-5 w-5" />} label={t("admin.renovacoes.kpiVencidos")} value={vencidos.length} color="bg-slate-100 text-slate-700" />
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="vencendo">{t("admin.renovacoes.abaVencendo")} ({vencendo.length})</TabsTrigger>
          <TabsTrigger value="pedidos">{t("admin.renovacoes.abaPedidos")} ({pedidos.length})</TabsTrigger>
          <TabsTrigger value="vencidos">{t("admin.renovacoes.abaVencidos")} ({vencidos.length})</TabsTrigger>
        </TabsList>

        {/* Vencem nos próximos 60 dias */}
        <TabsContent value="vencendo" className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("admin.renovacoes.ajudaVencendo")}</p>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              {cabecalho([t("common.name"), t("admin.renovacoes.contato"), t("admin.renovacoes.plano"), t("admin.renovacoes.venceEm"), t("admin.renovacoes.ultimoAcesso"), t("admin.renovacoes.situacao")])}
              <TableBody>
                {estado(6, vencendo.length === 0, t("admin.renovacoes.vazioVencendo"))}
                {vencendo.map(({ p, fim, dias }, idx) => {
                  const pedido = pedidoAbertoPorProf.get(p.id);
                  return (
                    <TableRow key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{contato(p.email, p.telefone)}</TableCell>
                      <TableCell>{p.plano_nome ?? "—"}</TableCell>
                      <TableCell>
                        <div>{fmt(fim)}</div>
                        <div className="text-xs text-muted-foreground">{t("admin.renovacoes.emDias", { count: dias })}</div>
                      </TableCell>
                      <TableCell className="text-sm">{fmt(p.ultimo_login)}</TableCell>
                      <TableCell>
                        {pedido
                          ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t("admin.renovacoes.pediuNaoRenovar", { mes: pedido.mes_de_uso ?? "?" })}</Badge>
                          : <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{t("admin.renovacoes.semResposta")}</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Pediram para não renovar */}
        <TabsContent value="pedidos" className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("admin.renovacoes.ajudaPedidos")}</p>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              {cabecalho([t("common.name"), t("admin.renovacoes.plano"), t("admin.renovacoes.pedidoEm"), t("admin.renovacoes.mesDeUso"), t("admin.renovacoes.motivo"), t("admin.renovacoes.acessoAte"), t("admin.renovacoes.situacao")])}
              <TableBody>
                {estado(7, pedidos.length === 0, t("admin.renovacoes.vazioPedidos"))}
                {pedidos.map((p, idx) => (
                  <TableRow key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}>
                    <TableCell>
                      <div className="font-medium">{p.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{p.email ?? ""}</div>
                    </TableCell>
                    <TableCell>{p.plano_nome ?? "—"}</TableCell>
                    <TableCell>{fmt(p.criado_em)}</TableCell>
                    <TableCell>{p.mes_de_uso ? t("admin.renovacoes.mesDe12", { mes: p.mes_de_uso }) : "—"}</TableCell>
                    <TableCell className="max-w-[260px] text-sm">
                      <div>{p.motivo ?? t("admin.renovacoes.semMotivo")}</div>
                      {p.comentario && <div className="mt-0.5 text-xs italic text-muted-foreground">“{p.comentario}”</div>}
                    </TableCell>
                    <TableCell>{fmt(p.ciclo_fim)}</TableCell>
                    <TableCell className="space-y-1">
                      {p.desfeito_em
                        ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            {p.desfeito_motivo === "renovou" ? t("admin.renovacoes.renovouDepois") : t("admin.renovacoes.desistiu")}
                          </Badge>
                        : <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t("admin.renovacoes.emAberto")}</Badge>}
                      {p.dentro_garantia && !p.desfeito_em && (
                        <div><Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{t("admin.renovacoes.reembolso7")}</Badge></div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Venceram sem renovar */}
        <TabsContent value="vencidos" className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("admin.renovacoes.ajudaVencidos")}</p>
          <div className="overflow-hidden rounded-lg border">
            <Table>
              {cabecalho([t("common.name"), t("admin.renovacoes.contato"), t("admin.renovacoes.plano"), t("admin.renovacoes.venceuEm"), t("admin.renovacoes.comoSaiu")])}
              <TableBody>
                {estado(5, vencidos.length === 0, t("admin.renovacoes.vazioVencidos"))}
                {vencidos.map(({ p, fim }, idx) => {
                  // Pedido feito para este mesmo ano (ciclo_fim ~ fim do ciclo vencido).
                  const pedido = pedidos.find((x) => x.profissional_id === p.id && x.desfeito_motivo !== "renovou"
                    && x.ciclo_fim && Math.abs(new Date(x.ciclo_fim).getTime() - fim.getTime()) < 2 * 86400000);
                  const como = p.plano_status === "cancelado"
                    ? t("admin.renovacoes.saiuCancelado")
                    : pedido && !pedido.desfeito_em
                      ? t("admin.renovacoes.saiuPediu", { mes: pedido.mes_de_uso ?? "?" })
                      : t("admin.renovacoes.saiuSoNaoRenovou");
                  return (
                    <TableRow key={p.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#F5F3FA]"}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{contato(p.email, p.telefone)}</TableCell>
                      <TableCell>{p.plano_nome ?? "—"}</TableCell>
                      <TableCell>{fmt(fim)}</TableCell>
                      <TableCell className="text-sm">{como}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metrica({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string | number; color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white p-4">
      <div className={`grid h-10 w-10 place-items-center rounded-full ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs leading-tight text-muted-foreground">{label}</p>
        <p className="truncate font-[Sora] text-xl font-semibold text-[#2A1B47]">{value}</p>
      </div>
    </div>
  );
}
