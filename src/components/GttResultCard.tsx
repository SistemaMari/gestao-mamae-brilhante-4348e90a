import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { PreviewConsulta } from '@/lib/previewPatients';

type GttDiagResult = {
  tipo: 'negativo' | 'positivo' | 'overt';
  label: string;
  texto: string;
  cor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  cenario: string | null;
};

function calcularGttDiagnostico(
  jejum: number,
  h1: number | null,
  h2: number | null,
  recursoLimitado: boolean,
  igSemanas: number | null,
  t: TFunction,
): GttDiagResult {
  if (jejum >= 126 || (h2 != null && h2 >= 200)) {
    return {
      tipo: 'overt',
      label: t('gttResultCard.overtLabel'),
      texto: t('gttResultCard.overtTexto'),
      cor: 'text-red-800',
      bgColor: 'bg-[#FEE2E2]',
      borderColor: 'border-red-200',
      iconColor: 'text-red-600',
      cenario: '8',
    };
  }

  const jejumAlterado = jejum >= 92;
  const h1Alterado = h1 != null && h1 >= 180;
  const h2Alterado = h2 != null && h2 >= 153;

  if (jejumAlterado || h1Alterado || h2Alterado) {
    const cenario = (igSemanas ?? 0) > 28 ? '6B' : '6';
    return {
      tipo: 'positivo',
      label: t('gttResultCard.positivoLabel'),
      texto: recursoLimitado
        ? t('gttResultCard.positivoTextoRecurso')
        : t('gttResultCard.positivoTexto'),
      cor: 'text-orange-800',
      bgColor: 'bg-[#FEF3C7]',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
      cenario,
    };
  }

  return {
    tipo: 'negativo',
    label: t('gttResultCard.negativoLabel'),
    texto: recursoLimitado
      ? t('gttResultCard.negativoTextoRecurso')
      : t('gttResultCard.negativoTexto'),
    cor: 'text-emerald-800',
    bgColor: 'bg-[#DCFCE7]',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    cenario: null,
  };
}

interface GttResultCardProps {
  consulta: PreviewConsulta;
  igHoje: { semanas: number; dias: number } | null;
}

export default function GttResultCard({ consulta }: GttResultCardProps) {
  const { t } = useTranslation();
  const jejum = consulta.gtt_jejum;
  if (jejum == null) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {consulta.observacoes || t('gttResultCard.semDados')}
      </p>
    );
  }

  const h1 = consulta.gtt_1h ?? null;
  const h2 = consulta.gtt_2h ?? null;
  const recurso = consulta.gtt_recurso_limitado ?? false;
  const igSem = consulta.ig_semanas;

  const resultado = calcularGttDiagnostico(jejum, h1, h2, recurso, igSem, t);
  // 38B-B (#23): confia no cenario_clinico='6B' roteado pelo backend (GTT 75g com
  // IG > 28 sem). Antes dependia só do recálculo local por ig_semanas, que podia
  // divergir do valor persistido e ocultar a nota de diagnóstico tardio.
  const isTardio = consulta.cenario_clinico === '6B' || resultado.cenario === '6B';

  const valores: { label: string; valor: number; meta: string; alterado: boolean }[] = [
    { label: t('gttResultCard.glicemiaJejum'), valor: jejum, meta: '< 92 mg/dL', alterado: jejum >= 92 },
  ];
  if (h1 != null) {
    valores.push({ label: t('gttResultCard.h1PosSobrecarga'), valor: h1, meta: '< 180 mg/dL', alterado: h1 >= 180 });
  }
  if (h2 != null) {
    valores.push({ label: t('gttResultCard.h2PosSobrecarga'), valor: h2, meta: '< 153 mg/dL', alterado: h2 >= 153 });
  }

  return (
    <div className="space-y-4">
      {/* Values table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-foreground">{t('gttResultCard.colDosagem')}</th>
              <th className="text-center px-3 py-2 font-medium text-foreground">{t('gttResultCard.colResultado')}</th>
              <th className="text-center px-3 py-2 font-medium text-foreground">{t('gttResultCard.colMeta')}</th>
              <th className="text-center px-3 py-2 font-medium text-foreground">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody>
            {valores.map((v) => (
              <tr key={v.label} className="border-t border-border">
                <td className="px-3 py-2 text-foreground">{v.label}</td>
                <td className={`px-3 py-2 text-center font-semibold ${v.alterado ? 'text-red-600' : 'text-emerald-600'}`}>
                  {v.valor} mg/dL
                </td>
                <td className="px-3 py-2 text-center text-muted-foreground">{v.meta}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.alterado ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {v.alterado ? t('gttResultCard.statusAlterado') : t('gttResultCard.statusNormal')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recurso && (
        <div className="rounded-lg border border-amber-200 bg-[#FEF3C7] p-3">
          <p className="text-xs text-amber-800">
            <strong>{t('gttResultCard.recursoLimitadoLabel')}</strong> {t('gttResultCard.recursoLimitadoText')}
          </p>
        </div>
      )}

      {/* Result card */}
      <div className={`rounded-xl border ${resultado.borderColor} ${resultado.bgColor} p-5 space-y-3`}>
        <div className="flex items-start gap-3">
          {resultado.tipo === 'negativo' ? (
            <CheckCircle2 className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
          ) : (
            <AlertTriangle className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
          )}
          <div>
            <h2 className={`text-base font-bold ${resultado.cor}`}>
              {resultado.tipo === 'negativo'
                ? t('gttResultCard.negativoHeading')
                : resultado.label}
            </h2>
            <p className={`mt-1 text-sm ${resultado.cor}`}>{resultado.texto}</p>
          </div>
        </div>

        {isTardio && (
          <div className="rounded-lg bg-red-100/80 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-800">
              {t('gttResultCard.diagnosticoTardio')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
