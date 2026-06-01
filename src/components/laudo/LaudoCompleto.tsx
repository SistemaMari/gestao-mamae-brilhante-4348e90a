import { type ReactNode } from 'react';
import { Printer } from 'lucide-react';
import LaudoCabecalho from './LaudoCabecalho';
import BlocosTextoLaudo from './BlocosTextoLaudo';
import GradeGlicemicaCompacta, { type GradeGlicemicaProps } from './GradeGlicemicaCompacta';
import NotasTecnicasCard from './NotasTecnicasCard';
import InstrucaoCtrlP from './InstrucaoCtrlP';
import JanelaGttCard from './JanelaGttCard';
import { type Cenario } from '@/lib/laudoMapping';
import type { EstadoTextos } from '@/hooks/useLaudoTextos';

export interface LaudoCompletoProps {
  paciente: { nome: string };
  igSemanas: number;
  igDias: number;
  dataLaudo: Date;
  cenario: Cenario;
  /** Bloco 1 — conteúdo clínico determinístico (cards atuais) */
  children: ReactNode;
  /** Estado dos textos fixos do laudo (34D-B) */
  estado: EstadoTextos;
  gradeGlicemica?: GradeGlicemicaProps | null;
  proximaFichaTexto?: string | null;
  notasTecnicas?: string[];
  /** Janela do GTT — só renderizada quando cenario === 'negativo' */
  janelaGTT?: { inicio: Date; fim: Date } | null;
  igMaior24?: boolean;
  onTentarNovamente?: () => void;
}

export default function LaudoCompleto({
  paciente,
  igSemanas,
  igDias,
  dataLaudo,
  cenario,
  children,
  estado,
  gradeGlicemica,
  proximaFichaTexto: _proximaFichaTexto,
  notasTecnicas,
  janelaGTT,
  igMaior24,
  onTentarNovamente,
}: LaudoCompletoProps) {
  // Critérios 6/7: PDF só é liberado quando os textos oficiais estão publicados.
  // Não há botão "Gerar PDF" neste app — o PDF é gerado via Ctrl+P do navegador.
  // O bloqueio se traduz em: esconder a instrução de Ctrl+P e o rodapé legal
  // impresso, e exibir um controle desabilitado (focável, com tooltip).
  const podeImprimir = estado.status === 'completo';

  return (
    <article className="laudo-completo overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <LaudoCabecalho
        paciente={paciente}
        igSemanas={igSemanas}
        igDias={igDias}
        dataLaudo={dataLaudo}
        cenario={cenario}
      />

      <div className="space-y-3 p-4">
        {/* Bloco 1 — conteúdo clínico atual */}
        <div className="laudo-card">{children}</div>

        {/* Card "Janela para GTT 75g" — somente no Retorno 1 com resultado NEGATIVO */}
        {cenario === 'negativo' && janelaGTT && (
          <JanelaGttCard janelaGTT={janelaGTT} igMaior24={!!igMaior24} />
        )}

        {/* Grade compacta (Fichas A/B/C/D) */}
        {gradeGlicemica && <GradeGlicemicaCompacta {...gradeGlicemica} />}

        {/* Textos fixos do laudo (34D-B) — blocos publicados ou placeholder/estado */}
        <BlocosTextoLaudo estado={estado} onTentarNovamente={onTentarNovamente} />

        {/* Notas técnicas */}
        <NotasTecnicasCard notas={notasTecnicas} />

        {podeImprimir ? (
          <>
            {/* Instrução Ctrl+P (não imprime) */}
            <InstrucaoCtrlP />

            {/* Rodapé legal — só impresso */}
            <p className="print-only mt-4 text-center text-[10px] text-muted-foreground">
              Gerado por MARI — {dataLaudo.toLocaleDateString('pt-BR')} — Este documento não substitui a avaliação médica.
            </p>
          </>
        ) : (
          <button
            type="button"
            aria-disabled="true"
            title="Aguardando publicação dos textos pelo time clínico."
            onClick={(e) => e.preventDefault()}
            className="no-print inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 text-[11px] text-[#94A3B8] opacity-80"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Salvar/Imprimir PDF (Ctrl+P) — indisponível</span>
          </button>
        )}
      </div>
    </article>
  );
}
