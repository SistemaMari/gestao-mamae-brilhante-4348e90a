import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface UsageWarningBannerProps {
  laudosUsados: number;
  laudosLimite: number;
}

export default function UsageWarningBanner({ laudosUsados, laudosLimite }: UsageWarningBannerProps) {
  const navigate = useNavigate();
  const percentual = laudosLimite > 0 ? (laudosUsados / laudosLimite) * 100 : 0;

  // Só exibir se >= 90%
  if (percentual < 90) return null;

  return (
    <div className="mx-auto max-w-4xl px-4">
      <div className="flex items-center gap-3 rounded-lg border border-clinical-warning-text/20 bg-clinical-warning-bg px-4 py-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-clinical-warning-icon" />
        <p className="flex-1 text-sm text-clinical-warning-text">
          Você já usou <strong>{laudosUsados}</strong> de <strong>{laudosLimite}</strong> laudos
          deste período ({Math.round(percentual)}%). Considere fazer upgrade para continuar sem interrupções.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-clinical-warning-text/30 text-clinical-warning-text hover:bg-clinical-warning-bg"
          onClick={() => navigate('/planos')}
        >
          Ver planos
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
