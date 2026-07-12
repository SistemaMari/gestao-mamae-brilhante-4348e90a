import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Lock, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface UpgradeRequiredProps {
  /** Ex.: "Profissional" — nome amigável do plano necessário. */
  planoNecessario: string;
  /** Título principal. */
  titulo?: string;
  /** Descrição opcional explicando o que a feature entrega. */
  descricao?: string;
}

/**
 * Estado "bloqueado por plano" em página cheia.
 * Renderizado pelo PlanoGuard quando o usuário acessa rota acima do plano dele.
 */
export default function UpgradeRequired({
  planoNecessario,
  titulo,
  descricao,
}: UpgradeRequiredProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="container max-w-2xl py-16">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 px-6 py-12 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: '#E8E0FF' }}
          >
            <Lock className="h-8 w-8" style={{ color: '#7E69AB' }} />
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold text-foreground">
              {titulo ?? t('upgradeRequired.title')}
            </h1>
            <p className="text-base text-muted-foreground">
              <Trans i18nKey="upgradeRequired.availableInPlan" values={{ plano: planoNecessario }}>
                Disponível no plano <strong>{{ plano: planoNecessario } as any}</strong>.
              </Trans>
            </p>
            {descricao && (
              <p className="mx-auto max-w-md pt-2 text-sm text-muted-foreground">
                {descricao}
              </p>
            )}
          </div>

          <Button
            size="lg"
            className="gap-2 text-white hover:opacity-90"
            style={{ backgroundColor: '#7C4DBA' }}
            onClick={() => navigate('/planos')}
          >
            {t('upgradeRequired.upgradeButton')}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
