import { Download, FileSpreadsheet, FileText, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { humanizeMinutes } from "./utils/formatters";

interface Props {
  nome: string;
  cargo: string;
  instituicao: string;
  outrosContratantes: number;
  unidadesVinculadas: number;
  atualizadoHaMin: number | null;
  refreshing: boolean;
  cooldownSegundos: number;
  onRefresh: () => void;
  onExportCsv: () => void;
}

export default function PainelHeader({
  nome,
  cargo,
  instituicao,
  outrosContratantes,
  unidadesVinculadas,
  atualizadoHaMin,
  refreshing,
  cooldownSegundos,
  onRefresh,
  onExportCsv,
}: Props) {
  const { t } = useTranslation();
  const cooldown = cooldownSegundos > 0;
  const cooldownLabel = cooldown
    ? t('gestorGeral.painelHeader.cooldownAguarde', { min: Math.ceil(cooldownSegundos / 60) })
    : t('gestorGeral.painelHeader.cooldownAtualizar');

  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h1
            className="text-2xl font-semibold text-[#1E293B]"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            {t('gestorGeral.painelHeader.title')}
          </h1>
          <p className="mt-1 text-sm text-[#475569]">{t('gestorGeral.painelHeader.greeting', { nome: nome || t('gestorGeral.painelHeader.gestorFallback') })}</p>
          <p className="text-xs text-[#64748B]">
            {cargo}
            {instituicao && (
              <>
                {" — "}
                <span className="font-medium text-[#7E69AB]">{instituicao}</span>
                {outrosContratantes > 0 && (
                  <span className="text-[#94A3B8]"> {t('gestorGeral.painelHeader.outrasContratantes', { count: outrosContratantes })}</span>
                )}
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="bg-[#F1F0FB] text-[#7E69AB] border border-[#E8E0FF] hover:bg-[#F1F0FB]">
              {t('gestorGeral.painelHeader.unidadesVinculadas', { count: unidadesVinculadas })}
            </Badge>
            {atualizadoHaMin !== null && (
              <span className="text-xs text-[#94A3B8]">
                {t('gestorGeral.painelHeader.atualizado', { tempo: humanizeMinutes(atualizadoHaMin) })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={refreshing || cooldown}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    {t('gestorGeral.painelHeader.atualizarDados')}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{cooldownLabel}</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="bg-[#7E69AB] hover:bg-[#6B5896] text-white">
                <Download className="mr-2 h-4 w-4" />
                {t('gestorGeral.painelHeader.exportarVisaoAtual')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onExportCsv}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {t('gestorGeral.painelHeader.exportarCsv')}
              </DropdownMenuItem>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem disabled>
                        <FileText className="mr-2 h-4 w-4" />
                        {t('gestorGeral.painelHeader.exportarPdf')}
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{t('gestorGeral.painelHeader.emBreve')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
