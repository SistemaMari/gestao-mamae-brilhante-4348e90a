import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';

export default function PacientePage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 font-heading text-xl font-bold text-foreground">
          {id === 'nova' ? 'Nova Paciente' : 'Ficha da Paciente'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {id === 'nova'
            ? 'O formulário de cadastro de nova paciente será construído no próximo prompt.'
            : `A ficha clínica detalhada (ID: ${id?.slice(0, 8)}...) será construída no próximo prompt.`}
        </p>
        <Link to="/dashboard">
          <Button variant="outline" className="mt-6">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
