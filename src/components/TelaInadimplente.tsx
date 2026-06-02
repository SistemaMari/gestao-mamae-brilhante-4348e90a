import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { PlanoStatusInfo } from '@/lib/planoStatus';
import { useNavigate } from 'react-router-dom';

interface TelaInadimplenteProps {
  info: PlanoStatusInfo;
  planoSlug?: string | null;
}

const PLANOS_CHECKOUT: Record<string, string> = {
  inicial:       '/checkout/inicial',
  intermediaria: '/checkout/intermediaria',
  profissional:  '/checkout/profissional',
};

export default function TelaInadimplente({ info, planoSlug }: TelaInadimplenteProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const checkoutPath = planoSlug ? PLANOS_CHECKOUT[planoSlug] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(252,100%,97%)] to-[hsl(168,60%,95%)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-lg p-8 space-y-6 text-center">

        {/* Ícone */}
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>

        {/* Título e descrição */}
        <div className="space-y-2">
          <h1 className="font-heading text-xl font-bold text-foreground">{info.titulo}</h1>
          <p className="text-sm text-muted-foreground">{info.descricao}</p>
        </div>

        {/* O que acontece depois */}
        <div className="rounded-lg bg-muted/50 p-4 text-left space-y-2 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-sm">Como regularizar?</p>
          {checkoutPath ? (
            <ul className="space-y-1 list-disc list-inside">
              <li>Clique em <strong>"Renovar assinatura"</strong> abaixo</li>
              <li>Escolha Pix, Boleto ou Cartão de crédito</li>
              <li>Após o pagamento, seu acesso é reativado automaticamente</li>
            </ul>
          ) : (
            <ul className="space-y-1 list-disc list-inside">
              <li>Acesse a página de planos e renove sua assinatura</li>
              <li>Após o pagamento, seu acesso é reativado automaticamente</li>
            </ul>
          )}
        </div>

        {/* Ações */}
        <div className="space-y-3">
          {checkoutPath ? (
            <Button
              className="w-full h-11 font-bold"
              onClick={() => navigate(checkoutPath)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Renovar assinatura
            </Button>
          ) : (
            <Button
              className="w-full h-11 font-bold"
              onClick={() => navigate('/planos')}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Ver planos
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
