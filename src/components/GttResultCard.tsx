import { CheckCircle2, AlertTriangle } from 'lucide-react';
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
): GttDiagResult {
  if (jejum >= 126 || (h2 != null && h2 >= 200)) {
    return {
      tipo: 'overt',
      label: 'OVERT DIABETES — Diabete pré-existente diagnosticado na gestação',
      texto: `Diagnóstico de Diabete pré-existente diagnosticado durante a gestação.`,
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
      label: 'GTT ALTERADO — Diagnóstico de DMG confirmado',
      texto: recursoLimitado
        ? `Diagnóstico realizado em cenário de recurso limitado (sem GTT 75g completo).`
        : `Qualquer valor alterado no GTT 75g já confirma o diagnóstico de Diabete Mellitus Gestacional.`,
      cor: 'text-orange-800',
      bgColor: 'bg-[#FEF3C7]',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
      cenario,
    };
  }

  return {
    tipo: 'negativo',
    label: 'GTT NORMAL — DMG afastado',
    texto: recursoLimitado
      ? 'Glicemia de jejum dentro dos parâmetros normais. O diagnóstico de DMG está afastado neste exame.'
      : 'Todos os valores do GTT 75g estão dentro dos parâmetros normais. O diagnóstico de Diabete Mellitus Gestacional está AFASTADO.',
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
  const jejum = consulta.gtt_jejum;
  if (jejum == null) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {consulta.observacoes || 'Sem dados de GTT.'}
      </p>
    );
  }

  const h1 = consulta.gtt_1h ?? null;
  const h2 = consulta.gtt_2h ?? null;
  const recurso = consulta.gtt_recurso_limitado ?? false;
  const igSem = consulta.ig_semanas;

  const resultado = calcularGttDiagnostico(jejum, h1, h2, recurso, igSem);
  const isTardio = resultado.cenario === '6B';

  const valores: { label: string; valor: number; meta: string; alterado: boolean }[] = [
    { label: 'Glicemia de jejum', valor: jejum, meta: '< 92 mg/dL', alterado: jejum >= 92 },
  ];
  if (h1 != null) {
    valores.push({ label: '1h pós-sobrecarga', valor: h1, meta: '< 180 mg/dL', alterado: h1 >= 180 });
  }
  if (h2 != null) {
    valores.push({ label: '2h pós-sobrecarga', valor: h2, meta: '< 153 mg/dL', alterado: h2 >= 153 });
  }

  return (
    <div className="space-y-4">
      {/* Values table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-3 py-2 font-medium text-foreground">Dosagem</th>
              <th className="text-center px-3 py-2 font-medium text-foreground">Resultado</th>
              <th className="text-center px-3 py-2 font-medium text-foreground">Meta</th>
              <th className="text-center px-3 py-2 font-medium text-foreground">Status</th>
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
                    {v.alterado ? 'ALTERADO' : 'NORMAL'}
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
            <strong>Recurso limitado:</strong> diagnóstico baseado apenas na glicemia de jejum.
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
                ? 'Investigação diagnóstica concluída — DMG afastado'
                : resultado.label}
            </h2>
            <p className={`mt-1 text-sm ${resultado.cor}`}>{resultado.texto}</p>
          </div>
        </div>

        {isTardio && (
          <div className="rounded-lg bg-red-100/80 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-800">
              Diagnóstico tardio (IG &gt; 28 semanas) — início imediato do tratamento é crítico.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
