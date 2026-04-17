interface Props {
  notas?: string[];
}

export const NOTAS_PADRAO = [
  'Não repetir glicemia plasmática de jejum para fins diagnósticos — em nenhum cenário, seja resultado positivo ou negativo.',
  'Glicemia plasmática venosa é OBRIGATÓRIA para diagnóstico — glicemia capilar em ponta de dedo não é válida para este fim.',
  'Glicemia capilar de jejum e pós-prandiais são utilizadas exclusivamente para acompanhamento do perfil glicêmico — nunca para diagnóstico.',
  'Este laudo é um instrumento de apoio à decisão clínica e não substitui a avaliação médica.',
];

export default function NotasTecnicasCard({ notas = NOTAS_PADRAO }: Props) {
  return (
    <section className="laudo-notas rounded-xl border border-border bg-[#F1F5F9] p-4">
      <p className="mb-1.5 text-xs font-semibold text-foreground">Notas técnicas</p>
      <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
        {notas.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </section>
  );
}
