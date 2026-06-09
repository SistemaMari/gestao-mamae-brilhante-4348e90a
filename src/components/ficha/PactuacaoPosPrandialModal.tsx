import { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { type JanelaPosPrandial, metaPosPrandial, prefixoHora } from '@/lib/posPrandial';

interface PactuacaoPosPrandialModalProps {
  open: boolean;
  onConfirm: (janela: JanelaPosPrandial) => void;
  onCancel: () => void;
}

const OPCOES: { value: JanelaPosPrandial; titulo: string }[] = [
  { value: '1h', titulo: '1 hora' },
  { value: '2h', titulo: '2 horas' },
];

// 35B — Passo de pactuação bloqueante antes da grade (Fichas A/B/C/D).
// Bloqueante: AlertDialog controlado só por `open` (sem onOpenChange) — não fecha por
// clique fora nem por Esc, e não tem X. Só sai por "Cancelar" (não cria ficha) ou
// "Confirmar e abrir ficha". 1h vem pré-destacada, mas a confirmação exige clique ativo:
// o foco inicial vai para o card "1 hora" (Enter ali é no-op de seleção), nunca ao Confirmar.
export default function PactuacaoPosPrandialModal({
  open, onConfirm, onCancel,
}: PactuacaoPosPrandialModalProps) {
  const [janela, setJanela] = useState<JanelaPosPrandial>('1h');
  const card1hRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className="max-w-lg"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          card1hRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[#5B21B6]">
            Pactuação das medições pós-prandiais
          </AlertDialogTitle>
          <AlertDialogDescription className="text-foreground">
            Você pactuou com a paciente medições pós-prandiais de 1 hora ou 2 horas?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div
          role="radiogroup"
          aria-label="Janela das medições pós-prandiais"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          {OPCOES.map((op) => {
            const selecionada = janela === op.value;
            return (
              <button
                key={op.value}
                ref={op.value === '1h' ? card1hRef : undefined}
                type="button"
                role="radio"
                aria-checked={selecionada}
                onClick={() => setJanela(op.value)}
                className={`relative rounded-xl border-2 p-4 text-left outline-none transition-colors
                  focus-visible:ring-2 focus-visible:ring-[#7C4DBA]
                  ${selecionada
                    ? 'border-[#7C4DBA] bg-[#E8E0FF]'
                    : 'border-border bg-background hover:border-[#D6BCFA]'}`}
              >
                {selecionada && (
                  <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C4DBA] text-white">
                    <Check className="h-3 w-3" />
                  </span>
                )}
                <span className="block text-lg font-bold text-[#5B21B6]">{op.titulo}</span>
                <span className="mt-1 block text-xs text-[#6D28D9]">
                  {prefixoHora(op.value)} pós café / almoço / jantar
                </span>
                <span className="mt-1 block text-xs font-medium text-muted-foreground">
                  Meta: &lt; {metaPosPrandial(op.value)} mg/dL
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          A medição de 1 hora é a mais usada. A de 2 horas pode ser pactuada por comodidade da
          paciente. É uma escolha clínica feita junto com a paciente e não pode ser alterada depois
          nesta ficha.
        </p>

        <AlertDialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(janela)}
            className="bg-[#7C4DBA] text-white hover:bg-[#7E69AB]"
          >
            Confirmar e abrir ficha
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
