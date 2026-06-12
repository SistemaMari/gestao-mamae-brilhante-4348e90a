/**
 * Bloco read-only complementar ao ChecklistRetorno2ReadOnly: mostra as duas
 * respostas que só aparecem em Regras 2 e 4 da Ficha A/C — pactuação com a
 * paciente e avaliação da memória do glicosímetro. Quando nenhum dos dois
 * estiver preenchido (Regra 3 / Regra manter / fichas antigas), não renderiza
 * nada — evita bloco vazio.
 */
interface Props {
  pactuacao: 'aceita' | 'recusa' | string | null;
  memoria: 'confirma' | 'nao_confirma' | string | null;
}

const pactLabel: Record<string, string> = {
  aceita: 'Aceita reforçar MEV',
  recusa: 'Recusa — iniciar insulina',
};

const memLabel: Record<string, string> = {
  confirma: 'Confirma',
  nao_confirma: 'Não confirma',
};

export default function DecisaoExtrasReadOnly({ pactuacao, memoria }: Props) {
  if (!pactuacao && !memoria) return null;

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-2">
      <h3 className="text-sm font-bold text-[#5B21B6]">Decisão clínica do Retorno 2</h3>
      <div className="divide-y divide-[#E5E0F2]">
        {memoria && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
            <span className="text-foreground">Avaliação da memória do glicosímetro</span>
            <span className="font-medium text-[#5B21B6] shrink-0">
              {memLabel[memoria] ?? '—'}
            </span>
          </div>
        )}
        {pactuacao && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs">
            <span className="text-foreground">Pactuação com a paciente</span>
            <span className="font-medium text-[#5B21B6] shrink-0">
              {pactLabel[pactuacao] ?? '—'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
