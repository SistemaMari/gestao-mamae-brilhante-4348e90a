import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SkeletonShimmer from './SkeletonShimmer';
import { buildMarkdownComponents } from './markdownComponents';
import type { StatusIA } from './Bloco2Justificativa';

interface Props {
  status: StatusIA;
  conteudo: string | null;
  erro?: { codigo?: number; mensagem: string } | null;
  onTentarNovamente?: () => void;
}

const components = buildMarkdownComponents('menta');

export default function Bloco3Conduta({ status, conteudo, erro, onTentarNovamente }: Props) {
  const navigate = useNavigate();

  if (status === 'erro') {
    const limiteAtingido = erro?.codigo === 403;
    return (
      <section className="laudo-bloco rounded-xl border-2 border-[#FCA5A5] bg-[#FEE2E2] p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
          <div className="flex-1">
            <h3 className="font-heading text-sm font-bold text-[#991B1B]">
              {limiteAtingido ? 'Limite de laudos atingido' : 'Não foi possível gerar a conduta'}
            </h3>
            <p className="mt-1 text-xs text-[#7F1D1D]">
              {erro?.mensagem ?? 'Ocorreu um erro ao gerar este bloco.'}
            </p>
            <div className="mt-3">
              {limiteAtingido ? (
                <Button
                  size="sm"
                  className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white"
                  onClick={() => navigate('/planos')}
                >
                  Ver planos
                </Button>
              ) : (
                onTentarNovamente && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#B91C1C] text-[#B91C1C] hover:bg-[#FECACA]"
                    onClick={onTentarNovamente}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Tentar novamente
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="laudo-bloco rounded-xl border border-[#5EEAD4] bg-white p-4 shadow-sm">
      <h3 className="font-display text-lg font-normal text-[#0D7364]">
        Conduta sugerida
      </h3>
      <div className="mt-2">
        {status === 'pendente' && (
          <p className="animate-pulse text-sm italic text-[#0D7364]/70">
            A conduta sugerida será gerada em breve.
          </p>
        )}
        {status === 'gerando' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#0D7364]">Gerando…</p>
            <SkeletonShimmer variante="menta" linhas={3} />
          </div>
        )}
        {status === 'pronto' && conteudo && (
          <div className="space-y-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {conteudo}
            </ReactMarkdown>
          </div>
        )}
        {status === 'pronto' && !conteudo && (
          <p className="text-sm italic text-[#0D7364]/70">Sem conteúdo.</p>
        )}
      </div>
    </section>
  );
}
