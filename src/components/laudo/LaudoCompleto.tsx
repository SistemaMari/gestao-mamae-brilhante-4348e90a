import { type ReactNode } from 'react';
import LaudoCabecalho from './LaudoCabecalho';
import BlocosTextoLaudo from './BlocosTextoLaudo';
import GradeGlicemicaCompacta, { type GradeGlicemicaProps } from './GradeGlicemicaCompacta';
import NotasTecnicasCard from './NotasTecnicasCard';
import JanelaGttCard from './JanelaGttCard';
import { type Cenario } from '@/lib/laudoMapping';
import type { EstadoTextos } from '@/hooks/useLaudoTextos';
import type { VariaveisLaudo } from '@/lib/laudoVariaveis';

export interface LaudoCompletoProps {
  paciente: { nome: string };
  // 34C-B: null quando a paciente não tem âncora — repassado para
  // LaudoCabecalho, que exibe estado explícito em vez de "0s 0d".
  igSemanas: number | null;
  igDias: number | null;
  dataLaudo: Date;
  cenario: Cenario;
  /** Bloco 1 — conteúdo clínico determinístico (cards atuais) */
  children: ReactNode;
  /** Estado dos textos fixos do laudo (34D-B) */
  estado: EstadoTextos;
  /** Variáveis [entre colchetes] a substituir nos textos do laudo */
  variaveis?: VariaveisLaudo;
  /** Oculta a seção de blocos textuais — cenários card-only (Caso Novo, parto, encerramento) */
  ocultarTextosLaudo?: boolean;
  gradeGlicemica?: GradeGlicemicaProps | null;
  proximaFichaTexto?: string | null;
  notasTecnicas?: string[];
  /** Janela do GTT 75g — só renderizada quando cenario === 'negativo' */
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
  variaveis,
  ocultarTextosLaudo,
  gradeGlicemica,
  proximaFichaTexto: _proximaFichaTexto,
  notasTecnicas,
  janelaGTT,
  igMaior24,
  onTentarNovamente,
}: LaudoCompletoProps) {
  // Critério 6/7: o rodapé legal impresso só aparece quando os textos oficiais
  // estão publicados (laudo completo). A UI de impressão na tela (botão e a
  // instrução de Ctrl+P) foi removida a pedido do time clínico — a impressão
  // continua disponível pelo Ctrl+P nativo do navegador.
  const mostrarRodapeLegal = estado.status === 'completo';

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

        {/* Textos fixos do laudo (34D-B) — blocos publicados ou placeholder/estado.
            Cenários card-only (Caso Novo, parto, encerramento) não têm textos em
            laudo_textos: omitimos a seção em vez de exibir "Texto pendente". */}
        {!ocultarTextosLaudo && (
          <BlocosTextoLaudo estado={estado} variaveis={variaveis} onTentarNovamente={onTentarNovamente} />
        )}

        {/* Notas técnicas */}
        <NotasTecnicasCard notas={notasTecnicas} />

        {/* Rodapé legal — só no impresso (Ctrl+P nativo). Sem botão nem instrução
            de PDF na tela, a pedido do time clínico. */}
        {mostrarRodapeLegal && (
          <p className="print-only mt-4 text-center text-[10px] text-muted-foreground">
            Gerado por MARI — {dataLaudo.toLocaleDateString('pt-BR')} — Este documento não substitui a avaliação médica.
          </p>
        )}
      </div>
    </article>
  );
}
