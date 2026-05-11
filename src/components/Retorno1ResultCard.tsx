import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PreviewConsulta } from '@/lib/previewPatients';

type DiagnosticoResult = {
  tipo: 'negativo' | 'positivo' | 'overt';
  label: string;
  texto: string;
  cor: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
};

function calcularDiagnostico(valor: number): DiagnosticoResult {
  if (valor < 92) {
    return {
      tipo: 'negativo',
      label: 'Resultado: NEGATIVO — Normoglicemia',
      texto: `Glicemia de jejum: ${valor} mg/dL. NÃO há diagnóstico de Diabete Mellitus Gestacional neste momento.`,
      cor: 'text-emerald-800',
      bgColor: 'bg-[#DCFCE7]',
      borderColor: 'border-emerald-200',
      iconColor: 'text-emerald-600',
    };
  }
  if (valor < 126) {
    return {
      tipo: 'positivo',
      label: 'Resultado: POSITIVO — Diabete Mellitus Gestacional',
      texto: `Glicemia de jejum: ${valor} mg/dL. Diagnóstico CONFIRMADO de DMG.`,
      cor: 'text-orange-800',
      bgColor: 'bg-[#FEF3C7]',
      borderColor: 'border-orange-200',
      iconColor: 'text-orange-600',
    };
  }
  return {
    tipo: 'overt',
    label: 'Resultado: OVERT DIABETES — Diabete pré-existente',
    texto: `Glicemia de jejum: ${valor} mg/dL. Diagnóstico de Diabete pré-existente diagnosticado durante a gestação.`,
    cor: 'text-red-800',
    bgColor: 'bg-[#FEE2E2]',
    borderColor: 'border-red-200',
    iconColor: 'text-red-600',
  };
}

function getValor(c: PreviewConsulta): number {
  if (typeof c.retorno1_valor_gj === 'number' && c.retorno1_valor_gj > 0) {
    return c.retorno1_valor_gj;
  }
  const m = (c.observacoes || '').match(/GJ:\s*(\d+)\s*mg\/dL/);
  return m ? parseInt(m[1], 10) : 0;
}

interface Retorno1ResultCardProps {
  consulta: PreviewConsulta;
  janelaGTT: { inicio: Date; fim: Date } | null;
  igHoje: { semanas: number; dias: number } | null;
}

export default function Retorno1ResultCard({
  consulta,
}: Retorno1ResultCardProps) {
  const valor = getValor(consulta);
  if (valor === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {consulta.observacoes || 'Sem dados de resultado.'}
      </p>
    );
  }

  const resultado = calcularDiagnostico(valor);

  return (
    <div className={`rounded-xl border ${resultado.borderColor} ${resultado.bgColor} p-5`}>
      <div className="flex items-start gap-3">
        {resultado.tipo === 'negativo' ? (
          <CheckCircle2 className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
        ) : (
          <AlertTriangle className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
        )}
        <div className="flex-1">
          <h2 className={`text-base font-bold ${resultado.cor}`}>{resultado.label}</h2>
          <p className={`mt-2 font-heading text-4xl font-bold leading-none ${resultado.cor}`}>
            {valor}
            <span className="ml-1 text-base font-medium opacity-80">mg/dL</span>
          </p>
          <p className={`mt-2 text-sm ${resultado.cor}`}>{resultado.texto}</p>
        </div>
      </div>
    </div>
  );
}
