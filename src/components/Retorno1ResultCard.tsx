import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
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

function parseValorFromObs(obs: string): number {
  const match = obs.match(/GJ:\s*(\d+)\s*mg\/dL/);
  return match ? parseInt(match[1], 10) : 0;
}

interface Retorno1ResultCardProps {
  consulta: PreviewConsulta;
  janelaGTT: { inicio: Date; fim: Date } | null;
  igHoje: { semanas: number; dias: number } | null;
}

export default function Retorno1ResultCard({
  consulta,
  janelaGTT,
  igHoje,
}: Retorno1ResultCardProps) {
  const valor = parseValorFromObs(consulta.observacoes || '');
  if (valor === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {consulta.observacoes || 'Sem dados de resultado.'}
      </p>
    );
  }

  const resultado = calcularDiagnostico(valor);
  const igMaior24 = igHoje ? igHoje.semanas >= 24 : false;

  return (
    <div className="space-y-4">
      {/* Result card */}
      <div className={`rounded-xl border ${resultado.borderColor} ${resultado.bgColor} p-5 space-y-4`}>
        <div className="flex items-start gap-3">
          {resultado.tipo === 'negativo' ? (
            <CheckCircle2 className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
          ) : (
            <AlertTriangle className={`h-6 w-6 shrink-0 ${resultado.iconColor}`} />
          )}
          <div>
            <h2 className={`text-base font-bold ${resultado.cor}`}>{resultado.label}</h2>
            <p className={`mt-1 text-sm ${resultado.cor}`}>{resultado.texto}</p>
          </div>
        </div>

        {/* Conduta */}
        <div className="rounded-lg bg-white/70 p-4 space-y-2">
          <p className={`text-sm font-semibold ${resultado.cor}`}>Conduta</p>
          {resultado.tipo === 'negativo' ? (
            <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
              <li>Não repetir glicemia de jejum.</li>
              <li>Seguir pré-natal normal.</li>
              <li>
                Realizar GTT 75g o mais próximo possível de 24 semanas — impreterivelmente antes de 28 semanas.
                {janelaGTT && !igMaior24 && (
                  <> O GTT 75g deverá ser realizado o mais próximo possível da 24ª semana (entre{' '}
                    <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e{' '}
                    <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>).</>
                )}
                {igMaior24 && ' O GTT 75g já está na janela — solicitar o mais breve possível.'}
              </li>
            </ul>
          ) : (
            <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
              <li>Iniciar tratamento imediato — dieta + atividade física.</li>
              <li>Solicitar perfil glicêmico de 4 pontos diários por 7 a 10 dias (jejum + 1h pós café + 1h pós almoço + 1h pós jantar).</li>
              <li>Retorno em 7 a 10 dias com o perfil glicêmico preenchido.</li>
              <li>Solicitar ultrassom obstétrico{igHoje && igHoje.semanas < 20 ? ' para datar a gestação.' : ' para referência de crescimento fetal.'}</li>
            </ul>
          )}
        </div>

        {/* Placeholder Blocos 2 e 3 */}
        <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
          <p className="text-sm font-bold text-foreground">Laudo Completo</p>
          <p className="text-xs italic text-[#94A3B8]">
            Bloco 2 — Justificativa Científica: será gerada em breve.
          </p>
          <p className="text-xs italic text-[#94A3B8]">
            Bloco 3 — Conduta Orientativa Personalizada: será gerada em breve.
          </p>
        </div>
      </div>

      {/* Notas técnicas */}
      <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
        <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
          <li>Não repetir glicemia de jejum para fins diagnósticos — em nenhum cenário, seja resultado positivo ou negativo.</li>
          <li>Glicemia plasmática é OBRIGATÓRIA para diagnóstico — glicemia capilar em ponta de dedo não é válida para este fim.</li>
          <li>Glicemia capilar de jejum e pós-prandiais são utilizadas exclusivamente para acompanhamento do perfil glicêmico — nunca para diagnóstico.</li>
          <li>Se diagnóstico confirmado: iniciar tratamento imediato. O diagnóstico oportuno e correto salva vidas. Não espere, não repita — trate.</li>
        </ul>
      </div>
    </div>
  );
}
