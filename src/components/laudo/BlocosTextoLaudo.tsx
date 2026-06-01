import { AlertTriangle, FileText, Info, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EstadoTextos } from '@/hooks/useLaudoTextos';
import SkeletonShimmer from './SkeletonShimmer';
import PlaceholderTextoPendente from './PlaceholderTextoPendente';

interface Props {
  estado: EstadoTextos;
  onTentarNovamente?: () => void;
}

/**
 * Seção de textos do laudo (34D-B §3.2.3 / §3.5).
 *
 * Renderiza, conforme o estado retornado por `useLaudoTextos`:
 *  - completo:         blocos textuais fixos, ordenados por ordem_bloco;
 *  - incompleto:       placeholder "Texto pendente";
 *  - ficha_incompleta: orientação para completar a ficha (sem ter chamado a função);
 *  - desativado:       aviso de feature flag desligada (defensivo);
 *  - erro:             mensagem genérica + retry;
 *  - pendente/carregando: skeleton.
 *
 * Regra clínica (§3.5.2 / critérios 10 e 11): o `texto` do banco é renderizado
 * EXATAMENTE como armazenado — sem markdown, paráfrase, complemento ou injeção
 * de variáveis. Dados dinâmicos da paciente aparecem apenas no cabeçalho/rodapé.
 */
export default function BlocosTextoLaudo({ estado, onTentarNovamente }: Props) {
  if (estado.status === 'pendente' || estado.status === 'carregando') {
    return (
      <section className="laudo-bloco rounded-xl border border-[#D6BCFA] bg-white p-4 shadow-sm">
        <p className="text-xs font-medium text-[#7E69AB]">Carregando textos do laudo…</p>
        <div className="mt-2">
          <SkeletonShimmer variante="lilas" linhas={3} />
        </div>
      </section>
    );
  }

  if (estado.status === 'erro') {
    return (
      <section className="laudo-bloco rounded-xl border-2 border-[#FCA5A5] bg-[#FEE2E2] p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
          <div className="flex-1">
            <h3 className="font-heading text-sm font-bold text-[#991B1B]">
              Não foi possível carregar os textos
            </h3>
            <p className="mt-1 text-xs text-[#7F1D1D]">
              {estado.erro?.mensagem ??
                'Não foi possível carregar os textos do laudo. Tente novamente em instantes.'}
            </p>
            {onTentarNovamente && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#B91C1C] text-[#B91C1C] hover:bg-[#FECACA]"
                  onClick={onTentarNovamente}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (estado.status === 'desativado') {
    return (
      <section className="laudo-bloco rounded-xl border border-[#FDE68A] border-l-4 border-l-[#D97706] bg-[#FEF9C3] p-4">
        <div className="flex items-start gap-2">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#B45309]" />
          <p className="text-xs leading-relaxed text-[#78350F]">
            {estado.mensagem ??
              'A geração de laudos está temporariamente desativada pela administração do sistema.'}
          </p>
        </div>
      </section>
    );
  }

  if (estado.status === 'ficha_incompleta') {
    return (
      <section className="laudo-bloco rounded-xl border border-[#D6BCFA] bg-[#F1F0FB] p-4">
        <div className="flex items-start gap-2">
          <FileText aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[#7C4DBA]" />
          <p className="text-xs leading-relaxed text-[#5B21B6]">
            {estado.mensagem ?? 'Complete os dados clínicos da ficha para visualizar o laudo.'}
          </p>
        </div>
      </section>
    );
  }

  if (estado.status === 'incompleto') {
    return <PlaceholderTextoPendente blocosFaltantes={estado.blocosFaltantes} />;
  }

  // status === 'completo'
  return (
    <div className="space-y-3">
      {estado.textos.map((bloco) => (
        <section
          key={bloco.bloco}
          className="laudo-bloco rounded-xl border border-[#D6BCFA] bg-white p-4 shadow-sm"
        >
          {bloco.titulo_bloco && (
            <h3 className="font-display text-lg font-normal text-[#7E69AB]">
              {bloco.titulo_bloco}
            </h3>
          )}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#4C1D95]">
            {bloco.texto}
          </p>
        </section>
      ))}
    </div>
  );
}
