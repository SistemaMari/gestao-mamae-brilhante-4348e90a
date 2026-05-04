import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { CalendarRange, Download, RotateCcw, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminFiltros } from "@/contexts/AdminFiltrosContext";
import { useAdminView } from "@/hooks/useAdminMetrics";
import type { GeoRow, UnidadeResumoRow } from "@/lib/adminMetrics";

const COR_PRIMARIA = "#7C4DBA";
const BADGE_BG = "#EDE5F7";
const BADGE_TXT = "#5A3690";

const TOOLTIP_EXPORT =
  "Aplicado apenas em arquivos exportados. Totais da tela refletem todos os períodos.";

function LabelExportOnly({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 cursor-help">
            {children}
            <Download className="h-3 w-3" style={{ color: COR_PRIMARIA }} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs">{TOOLTIP_EXPORT}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LabelComum({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-slate-600">{children}</span>
  );
}

export function BarraFiltrosGlobais() {
  const { pathname } = useLocation();
  const isPreview = pathname.startsWith("/vitrine");
  const isAdminRoute =
    pathname.startsWith("/admin") || pathname.startsWith("/vitrine/admin");
  const previewMode = isPreview;

  const { filtros, setFiltro, resetFiltros, filtrosAtivosCount } = useAdminFiltros();

  const distribuicao = useAdminView<GeoRow>("distribuicao_geografica", undefined, {
    previewMode,
    enabled: isAdminRoute,
  });
  const unidades = useAdminView<UnidadeResumoRow>("unidades_resumo", undefined, {
    previewMode,
    enabled: isAdminRoute,
  });

  const paises = useMemo(() => {
    const s = new Set<string>();
    (distribuicao.data ?? []).forEach((r) => r.pais && s.add(r.pais));
    return Array.from(s).sort();
  }, [distribuicao.data]);

  const estados = useMemo(() => {
    const s = new Set<string>();
    (distribuicao.data ?? [])
      .filter((r) => filtros.pais === "todos" || r.pais === filtros.pais)
      .forEach((r) => r.estado && s.add(r.estado));
    return Array.from(s).sort();
  }, [distribuicao.data, filtros.pais]);

  const cidades = useMemo(() => {
    const s = new Set<string>();
    (distribuicao.data ?? [])
      .filter(
        (r) =>
          (filtros.pais === "todos" || r.pais === filtros.pais) &&
          (filtros.estado === "todos" || r.estado === filtros.estado),
      )
      .forEach((r) => r.cidade && s.add(r.cidade));
    return Array.from(s).sort();
  }, [distribuicao.data, filtros.pais, filtros.estado]);

  const unidadesLista = useMemo(() => {
    return (unidades.data ?? [])
      .filter(
        (u) =>
          (filtros.pais === "todos" || u.pais === filtros.pais) &&
          (filtros.estado === "todos" || u.estado === filtros.estado) &&
          (filtros.cidade === "todos" || u.cidade === filtros.cidade),
      )
      .map((u) => ({ id: u.unidade_id, nome: u.nome }));
  }, [unidades.data, filtros.pais, filtros.estado, filtros.cidade]);

  if (!isAdminRoute) return null;

  const periodoLabel =
    filtros.periodo_inicio && filtros.periodo_fim
      ? `${filtros.periodo_inicio} → ${filtros.periodo_fim}`
      : "Selecionar período";

  return (
    <div
      className="border-b bg-white px-4 md:px-6 lg:px-8 py-3"
      style={{ borderColor: "#E2E8F0" }}
    >
      <div className="flex flex-wrap items-end gap-3">
        {/* Período */}
        <div className="flex flex-col gap-1">
          <LabelExportOnly>Período</LabelExportOnly>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 bg-white"
              >
                <CalendarRange className="h-4 w-4" />
                <span className="text-xs">{periodoLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Início</span>
                  <Input
                    type="date"
                    value={filtros.periodo_inicio ?? ""}
                    onChange={(e) =>
                      setFiltro("periodo_inicio", e.target.value || null)
                    }
                    className="h-8"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-600">Fim</span>
                  <Input
                    type="date"
                    value={filtros.periodo_fim ?? ""}
                    onChange={(e) =>
                      setFiltro("periodo_fim", e.target.value || null)
                    }
                    className="h-8"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* País */}
        <div className="flex flex-col gap-1">
          <LabelComum>País</LabelComum>
          <Select
            value={filtros.pais}
            onValueChange={(v) => setFiltro("pais", v)}
          >
            <SelectTrigger className="h-9 w-[160px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {paises.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Estado */}
        <div className="flex flex-col gap-1">
          <LabelComum>Estado</LabelComum>
          <Select
            value={filtros.estado}
            onValueChange={(v) => setFiltro("estado", v)}
          >
            <SelectTrigger className="h-9 w-[140px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {estados.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cidade */}
        <div className="flex flex-col gap-1">
          <LabelComum>Cidade</LabelComum>
          <Select
            value={filtros.cidade}
            onValueChange={(v) => setFiltro("cidade", v)}
          >
            <SelectTrigger className="h-9 w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {cidades.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tipo de conta */}
        <div className="flex flex-col gap-1">
          <LabelComum>Tipo de conta</LabelComum>
          <Select
            value={filtros.tipo_conta}
            onValueChange={(v) => setFiltro("tipo_conta", v as never)}
          >
            <SelectTrigger className="h-9 w-[160px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="consultorio">Consultório</SelectItem>
              <SelectItem value="institucional">Institucional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unidade — só quando institucional */}
        {filtros.tipo_conta === "institucional" && (
          <div className="flex flex-col gap-1">
            <LabelComum>Unidade</LabelComum>
            <Select
              value={filtros.unidade_id}
              onValueChange={(v) => setFiltro("unidade_id", v)}
            >
              <SelectTrigger className="h-9 w-[200px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {unidadesLista.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Momento diagnóstico */}
        <div className="flex flex-col gap-1">
          <LabelExportOnly>Momento diagnóstico</LabelExportOnly>
          <Select
            value={filtros.momento_diagnostico}
            onValueChange={(v) => setFiltro("momento_diagnostico", v as never)}
          >
            <SelectTrigger className="h-9 w-[180px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="retorno_1">Retorno 1</SelectItem>
              <SelectItem value="gtt">GTT (24-28 sem)</SelectItem>
              <SelectItem value="gtt_tardio">GTT tardio</SelectItem>
              <SelectItem value="overt">Diabete Overt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          {filtrosAtivosCount > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: BADGE_BG, color: BADGE_TXT }}
            >
              <Filter className="h-3 w-3" />
              {filtrosAtivosCount} ativo{filtrosAtivosCount > 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFiltros}
            className="h-9 gap-1 text-slate-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BarraFiltrosGlobais;
