import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Printer } from 'lucide-react';
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
  // Check overt first
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
        ? `Diagnóstico realizado em cenário de recurso limitado (sem GTT 75g completo). Este método alcança aproximadamente 66% dos diagnósticos — cerca de 34% dos casos podem não ser detectados.`
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
      ? 'Glicemia de jejum dentro dos parâmetros normais. O diagnóstico de DMG está afastado neste exame. Nota: sem o GTT completo, cerca de 34% dos casos podem não ser detectados.'
      : 'Todos os valores do GTT 75g estão dentro dos parâmetros normais. O diagnóstico de Diabete Mellitus Gestacional está AFASTADO. Seguir pré-natal normal.',
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

export default function GttResultCard({ consulta, igHoje }: GttResultCardProps) {
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

  // Build values table
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
            <strong>Recurso limitado:</strong> diagnóstico baseado apenas na glicemia de jejum, que alcança ~66% dos diagnósticos. ~34% dos casos podem não ser detectados.
          </p>
        </div>
      )}

      {/* Result card */}
      <div className={`rounded-xl border ${resultado.borderColor} ${resultado.bgColor} p-5 space-y-4`}>
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
            {resultado.tipo === 'negativo' ? (
              <div className={`mt-2 space-y-2 text-sm ${resultado.cor}`}>
                <p>
                  O teste de tolerância à glicose (GTT 75g) apresentou todos os valores dentro
                  dos parâmetros normais. O diagnóstico de Diabete Mellitus Gestacional está
                  AFASTADO para esta paciente.
                </p>
                <p>Não é necessário repetir nenhum exame para DMG. Seguir pré-natal normal.</p>
                <p>
                  Toda a história clínica e resultados de exames permanecem disponíveis para
                  consulta nesta ficha.
                </p>
              </div>
            ) : (
              <p className={`mt-1 text-sm ${resultado.cor}`}>{resultado.texto}</p>
            )}
          </div>
        </div>

        {isTardio && (
          <div className="rounded-lg bg-red-100/80 border border-red-200 p-3">
            <p className="text-xs font-semibold text-red-800">
              Diagnóstico tardio (IG &gt; 28 semanas) — início imediato do tratamento é crítico.
            </p>
          </div>
        )}

        {/* Conduta — exibida apenas para resultado positivo/overt (negativo já encerra) */}
        {resultado.tipo !== 'negativo' && (
          <div className="rounded-lg bg-white/70 p-4 space-y-2">
            <p className={`text-sm font-semibold ${resultado.cor}`}>Conduta</p>
            <ul className={`list-disc pl-4 text-xs ${resultado.cor} space-y-1.5`}>
              <li>Iniciar tratamento imediato — dieta + atividade física.</li>
              <li>Solicitar perfil glicêmico de 4 pontos diários por 7 a 10 dias (jejum + 1h pós café + 1h pós almoço + 1h pós jantar).</li>
              <li>Retorno em 7 a 10 dias com o perfil glicêmico preenchido.</li>
              <li>Solicitar ultrassom obstétrico{igHoje && igHoje.semanas < 20 ? ' para datar a gestação.' : ' para referência de crescimento fetal.'}</li>
            </ul>
          </div>
        )}

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

      {/* Ctrl+P instruction */}
      <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
        <Printer className="h-3.5 w-3.5" />
        <span>Para salvar ou imprimir este laudo em PDF: pressione Ctrl+P (Windows) ou Cmd+P (Mac) e escolha "Salvar como PDF".</span>
      </div>
    </div>
  );
}
