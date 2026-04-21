import { type ReactNode } from 'react';
import LaudoCabecalho from './LaudoCabecalho';
import Bloco2Justificativa, { type StatusIA } from './Bloco2Justificativa';
import Bloco3Conduta from './Bloco3Conduta';
import GradeGlicemicaCompacta, { type GradeGlicemicaProps } from './GradeGlicemicaCompacta';
import NotasTecnicasCard from './NotasTecnicasCard';
import InstrucaoCtrlP from './InstrucaoCtrlP';
import { type Cenario } from '@/lib/laudoMapping';

export interface LaudoCompletoProps {
  paciente: { nome: string };
  igSemanas: number;
  igDias: number;
  dataLaudo: Date;
  cenario: Cenario;
  /** Bloco 1 — conteúdo clínico determinístico (cards atuais) */
  children: ReactNode;
  /** Bloco 2 — justificativa IA */
  bloco2: string | null;
  /** Bloco 3 — conduta IA */
  bloco3: string | null;
  statusIA: StatusIA;
  erroIA?: { codigo?: number; mensagem: string } | null;
  gradeGlicemica?: GradeGlicemicaProps | null;
  proximaFichaTexto?: string | null;
  notasTecnicas?: string[];
  onTentarNovamente?: () => void;
}

export default function LaudoCompleto({
  paciente,
  igSemanas,
  igDias,
  dataLaudo,
  cenario,
  children,
  bloco2,
  bloco3,
  statusIA,
  erroIA,
  gradeGlicemica,
  proximaFichaTexto: _proximaFichaTexto,
  notasTecnicas,
  onTentarNovamente,
}: LaudoCompletoProps) {
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

        {/* Grade compacta (Fichas A/B/C/D) */}
        {gradeGlicemica && <GradeGlicemicaCompacta {...gradeGlicemica} />}

        {/* Bloco 2 — Justificativa IA */}
        <Bloco2Justificativa
          status={statusIA}
          conteudo={bloco2}
          erro={erroIA}
          onTentarNovamente={onTentarNovamente}
        />

        {/* Bloco 3 — Conduta IA */}
        <Bloco3Conduta
          status={statusIA}
          conteudo={bloco3}
          erro={erroIA}
          onTentarNovamente={onTentarNovamente}
        />

        {/* Notas técnicas */}
        <NotasTecnicasCard notas={notasTecnicas} />

        {/* Instrução Ctrl+P (não imprime) */}
        <InstrucaoCtrlP />

        {/* Rodapé legal — só impresso */}
        <p className="print-only mt-4 text-center text-[10px] text-muted-foreground">
          Gerado por Dra. Mari DMG Diagnóstica — {dataLaudo.toLocaleDateString('pt-BR')} — Este documento não substitui a avaliação médica.
        </p>
      </div>
    </article>
  );
}
