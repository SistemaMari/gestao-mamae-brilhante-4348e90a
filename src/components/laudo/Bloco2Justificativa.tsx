import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import SkeletonShimmer from './SkeletonShimmer';
import { buildMarkdownComponents } from './markdownComponents';

export type StatusIA = 'pendente' | 'gerando' | 'pronto' | 'erro';

interface Props {
  status: StatusIA;
  conteudo: string | null;
  erro?: { codigo?: number; mensagem: string } | null;
  onTentarNovamente?: () => void;
}

const components = buildMarkdownComponents('lilas');

export default function Bloco2Justificativa({ status, conteudo, erro, onTentarNovamente }: Props) {
  const navigate = useNavigate();

  if (status === 'erro') {
    const limiteAtingido = erro?.codigo === 403;
    return (
      <section className="laudo-bloco rounded-xl border-2 border-[#FCA5A5] bg-[#FEE2E2] p-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B91C1C]" />
          <div className="flex-1">
            <h3 className="font-heading text-sm font-bold text-[#991B1B]">
              {limiteAtingido ? 'Limite de laudos atingido' : 'Não foi possível gerar a justificativa'}
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
    <section className="laudo-bloco rounded-xl border border-[#D6BCFA] bg-white p-4 shadow-sm">
      <h3 className="font-display text-lg font-normal text-[#7E69AB]">
        Justificativa clínica
      </h3>
      <div className="mt-2">
        {status === 'pendente' && (
          <p className="animate-pulse text-sm italic text-[#7E69AB]/70">
            A justificativa clínica será gerada em breve.
          </p>
        )}
        {status === 'gerando' && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#7E69AB]">Gerando…</p>
            <SkeletonShimmer variante="lilas" linhas={3} />
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
          <p className="text-sm italic text-[#7E69AB]/70">Sem conteúdo.</p>
        )}
      </div>
    </section>
  );
}
