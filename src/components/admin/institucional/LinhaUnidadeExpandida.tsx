import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  unidadeId: string;
  unidadeNome: string;
  cnes: string | null;
  plano: string | null;
  gestorEmail: string | null;
  createdAt: string;
  contratanteId: string | null;
  contratanteNome: string | null;
  contratanteAtivo: boolean;
  onTransferir?: () => void;
}

export default function LinhaUnidadeExpandida({
  unidadeId, cnes, plano, gestorEmail, createdAt,
  contratanteAtivo, onTransferir,
}: Props) {
  const { t, i18n } = useTranslation();
  const PERFIL_LABEL: Record<string, string> = {
    gestor: t("admin.linhaUnidade.perfilGestor"),
    institucional: t("admin.linhaUnidade.perfilInstitucional"),
    consultorio: t("admin.linhaUnidade.perfilConsultorio"),
  };
  const { data, isLoading } = useQuery({
    queryKey: ["institucional", "unidade-profissionais", unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome, especialidade, perfil_institucional, user_id, plano_status")
        .eq("unidade_id", unidadeId);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="border-l-4 border-l-[#7C4DBA] bg-[#F9F7FC] p-4">
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">{t("admin.linhaUnidade.cnes")}</span> <strong>{cnes || "—"}</strong></div>
        <div><span className="text-muted-foreground">{t("admin.linhaUnidade.plano")}</span> <strong>{plano || "—"}</strong></div>
        <div><span className="text-muted-foreground">{t("admin.linhaUnidade.gestorEmail")}</span> <strong>{gestorEmail || "—"}</strong></div>
        <div><span className="text-muted-foreground">{t("admin.linhaUnidade.cadastradaEm")}</span> <strong>{new Date(createdAt).toLocaleDateString(i18n.language)}</strong></div>
      </div>

      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold text-[#5B3A8E]">{t("admin.linhaUnidade.linkedProfessionals")}</h4>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin.linhaUnidade.noLinkedProfessionals")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("admin.linhaUnidade.colSpecialtyProfile")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.nome}</TableCell>
                  <TableCell>{p.especialidade || PERFIL_LABEL[p.perfil_institucional ?? ""] || "—"}</TableCell>
                  <TableCell>{p.plano_status === "ativo" ? t("admin.linhaUnidade.statusActive") : t("admin.linhaUnidade.statusPendingInvite")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {onTransferir && (
        <div className="mt-4 flex justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onTransferir}
                    disabled={!contratanteAtivo}
                  >
                    <ArrowRightLeft className="mr-1 h-3 w-3" /> {t("admin.linhaUnidade.transferContractor")}
                  </Button>
                </span>
              </TooltipTrigger>
              {!contratanteAtivo && (
                <TooltipContent>
                  {t("admin.linhaUnidade.transferDisabledTip")}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
