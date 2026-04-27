import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Download, Printer, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { downloadLaudoPdf, laudoConteudoToText } from '@/lib/laudoPdf';

interface LaudoFull {
  id: string;
  conteudo_laudo: string | null;
  cenario_clinico: string | null;
  status: string;
  created_at: string;
  paciente_id: string;
  paciente_nome: string;
}

function fmtData(iso: string) {
  try { return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return iso; }
}

export default function LaudoViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [laudo, setLaudo] = useState<LaudoFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('laudos')
        .select('id, conteudo_laudo, cenario_clinico, status, created_at, paciente_id, pacientes:paciente_id(nome)')
        .eq('id', id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setError('Laudo não encontrado ou sem acesso.');
        setLoading(false);
        return;
      }
      setLaudo({
        id: data.id,
        conteudo_laudo: data.conteudo_laudo,
        cenario_clinico: data.cenario_clinico,
        status: data.status,
        created_at: data.created_at,
        paciente_id: data.paciente_id,
        paciente_nome: (data as any).pacientes?.nome ?? '—',
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !laudo) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <FileText className="h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">{error ?? 'Laudo indisponível'}</p>
        <Link to="/laudos" className="text-sm text-primary hover:underline">Voltar ao histórico</Link>
      </div>
    );
  }

  const conteudoText = laudoConteudoToText(laudo.conteudo_laudo);

  const handleDownload = () => {
    downloadLaudoPdf({
      pacienteNome: laudo.paciente_nome,
      cenario: laudo.cenario_clinico,
      geradoEm: fmtData(laudo.created_at),
      conteudo: conteudoText,
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/laudos" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Histórico de laudos
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={!conteudoText}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
        </div>
      </div>

      <article className="rounded-xl border border-border bg-card p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="border-b border-border pb-4">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Laudo de apoio diagnóstico — DMG
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span><strong className="text-foreground">Paciente:</strong> {laudo.paciente_nome}</span>
            {laudo.cenario_clinico && (
              <Badge variant="outline">Cenário {laudo.cenario_clinico}</Badge>
            )}
            <span>Gerado em {fmtData(laudo.created_at)}</span>
            {laudo.status !== 'pronto' && (
              <Badge variant="secondary">{laudo.status}</Badge>
            )}
          </div>
        </header>

        <div className="mt-6 whitespace-pre-wrap font-body text-[15px] leading-relaxed text-foreground">
          {conteudoText || (
            <p className="text-muted-foreground">
              Este laudo ainda não possui conteúdo gerado.
            </p>
          )}
        </div>
      </article>
    </div>
  );
}
