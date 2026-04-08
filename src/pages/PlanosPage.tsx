import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// Definição dos planos
const planos = [
  {
    id: 'free',
    nome: 'Free',
    preco: 0,
    precoLabel: 'R$ 0',
    periodo: '/mês',
    laudos: 3,
    pacientes: '3',
    botaoTexto: 'Começar grátis',
    destaque: false,
    recursos: [
      '3 laudos por mês',
      '3 pacientes',
      'Acesso ao módulo clínico',
    ],
  },
  {
    id: 'teste',
    nome: 'Teste',
    preco: 79,
    precoLabel: 'R$ 79',
    periodo: '/mês',
    laudos: 10,
    pacientes: 'Ilimitados',
    botaoTexto: 'Assinar',
    destaque: false,
    recursos: [
      '10 laudos por mês',
      'Pacientes ilimitados',
      'Acesso ao módulo clínico',
      'Suporte por e-mail',
    ],
  },
  {
    id: 'iniciante',
    nome: 'Iniciante',
    preco: 139,
    precoLabel: 'R$ 139',
    periodo: '/mês',
    laudos: 35,
    pacientes: 'Ilimitados',
    botaoTexto: 'Assinar',
    destaque: true,
    recursos: [
      '35 laudos por mês',
      'Pacientes ilimitados',
      'Acesso ao módulo clínico',
      'Suporte prioritário',
    ],
  },
  {
    id: 'profissional',
    nome: 'Profissional',
    preco: 299,
    precoLabel: 'R$ 299',
    periodo: '/mês',
    laudos: 100,
    pacientes: 'Ilimitados',
    botaoTexto: 'Assinar',
    destaque: false,
    recursos: [
      '100 laudos por mês',
      'Pacientes ilimitados',
      'Acesso ao módulo clínico',
      'Suporte VIP',
    ],
  },
];

const planosOrdem = ['free', 'teste', 'iniciante', 'profissional'];

export default function PlanosPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Buscar plano atual do profissional via contexto estendido
  const planoAtual = (useAuth() as any).profissionalData?.plano || 'free';

  const handlePlanoClick = (planoId: string) => {
    if (!user) {
      // Usuário não logado — Stripe será integrado depois
      toast.info('Integração com pagamento será ativada em breve.');
      return;
    }

    if (planoId === planoAtual) return;

    // Stripe checkout será integrado depois
    toast.info('Integração com pagamento será ativada em breve.');
  };

  const getBotaoTexto = (planoId: string) => {
    if (!user) {
      return planoId === 'free' ? 'Começar grátis' : 'Assinar';
    }
    if (planoId === planoAtual) return 'Plano atual';
    const idxAtual = planosOrdem.indexOf(planoAtual);
    const idxNovo = planosOrdem.indexOf(planoId);
    return idxNovo > idxAtual ? 'Fazer upgrade' : 'Mudar para este plano';
  };

  return (
    <div className="px-4 py-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-10 text-center">
          {user && (
            <Button
              variant="ghost"
              className="mb-4"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Escolha seu plano
          </h1>
          <p className="mt-2 text-muted-foreground">
            Comece gratuitamente e faça upgrade quando precisar
          </p>
        </div>

        {/* Grid de planos */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {planos.map((plano) => {
            const isAtual = user && plano.id === planoAtual;
            return (
              <div
                key={plano.id}
                className={`relative flex flex-col rounded-xl border p-6 transition-shadow hover:shadow-md ${
                  plano.destaque
                    ? 'border-primary shadow-md ring-1 ring-primary/20'
                    : 'border-border bg-card'
                } ${isAtual ? 'ring-2 ring-primary/40' : ''}`}
              >
                {/* Badge destaque */}
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                      <Crown className="mr-1 h-3 w-3" />
                      Mais popular
                    </Badge>
                  </div>
                )}

                {/* Badge plano atual */}
                {isAtual && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
                      Plano atual
                    </Badge>
                  </div>
                )}

                {/* Nome e preço */}
                <div className="mb-4">
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {plano.nome}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-heading text-3xl font-bold text-foreground">
                      {plano.precoLabel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {plano.periodo}
                    </span>
                  </div>
                </div>

                {/* Limites */}
                <div className="mb-4 space-y-1 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">{plano.laudos}</span> laudos/mês
                  </p>
                  <p>
                    <span className="font-medium text-foreground">{plano.pacientes}</span> pacientes
                  </p>
                </div>

                {/* Recursos */}
                <ul className="mb-6 flex-1 space-y-2">
                  {plano.recursos.map((recurso, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                      {recurso}
                    </li>
                  ))}
                </ul>

                {/* Botão */}
                <Button
                  className="w-full"
                  variant={plano.destaque ? 'default' : 'outline'}
                  disabled={!!isAtual}
                  onClick={() => handlePlanoClick(plano.id)}
                >
                  {getBotaoTexto(plano.id)}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Nota de preço */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Preços de lançamento. Valores podem ser ajustados após o período promocional.
        </p>
      </div>
    </div>
  );
}
