import { Building2, Mail, ShieldCheck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { useFiltrosGestorGeral } from "@/contexts/FiltrosGestorGeralContext";
import { useAuth } from "@/contexts/AuthContext";

export default function ConfiguracoesGestorGeralPage() {
  const { gestor, unidades, contratantes } = useFiltrosGestorGeral();
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-[#1E293B]" style={{ fontFamily: "Sora, sans-serif" }}>
          {t('consolidar.configuracoesGestorGeral.title')}
        </h1>
        <p className="mt-1 text-sm text-[#64748B]">
          {t('consolidar.configuracoesGestorGeral.subtitle')}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-[#7E69AB] mt-0.5" />
          <div>
            <p className="text-xs font-medium text-[#64748B]">{t('common.name')}</p>
            <p className="text-sm text-[#1E293B]">{gestor?.nome ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-[#7E69AB] mt-0.5" />
          <div>
            <p className="text-xs font-medium text-[#64748B]">{t('common.email')}</p>
            <p className="text-sm text-[#1E293B]">{user?.email ?? "demo@mari.health"}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-[#7E69AB] mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#64748B]">{t('consolidar.configuracoesGestorGeral.contratante')}</p>
            <p className="text-sm text-[#1E293B]">
              {contratantes.primeiro || "—"}
              {contratantes.outros > 0 && (
                <span className="text-[#94A3B8]"> {t('consolidar.configuracoesGestorGeral.maisOutras', { count: contratantes.outros })}</span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
        <p className="text-xs font-medium text-[#64748B]">{t('consolidar.configuracoesGestorGeral.unidadesVinculadas', { count: unidades.length })}</p>
        <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 text-sm text-[#1E293B]">
          {unidades.map((u) => (
            <li key={u.id} className="truncate">• {u.nome}</li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-[#E8E0FF] bg-[#FAF8FF] p-4 text-xs text-[#475569]">
        <p>
          <Trans
            i18nKey="consolidar.configuracoesGestorGeral.suporte"
            components={{
              mailLink: <a href="mailto:suporte@mari.health" className="font-medium text-[#7E69AB] hover:underline" />,
            }}
          />
        </p>
      </div>
    </div>
  );
}
