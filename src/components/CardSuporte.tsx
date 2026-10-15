import { useTranslation } from 'react-i18next';
import { LifeBuoy, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUPORTE_EMAIL, SUPORTE_WHATSAPP } from '@/lib/suporte';

/**
 * Fale com o suporte (WhatsApp + e-mail). No Meu perfil e no fim do Tutorial
 * ("não encontrou a resposta nos vídeos?").
 */
export default function CardSuporte({ variante = 'perfil' }: { variante?: 'perfil' | 'tutorial' }) {
  const { t } = useTranslation();
  const titulo = variante === 'tutorial' ? t('suporte.tituloTutorial') : t('suporte.titulo');
  const texto = variante === 'tutorial' ? t('suporte.textoTutorial') : t('suporte.texto');

  return (
    <section className="rounded-2xl border border-[#E8E0FF] bg-[#F5F0FF] p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
            <LifeBuoy className="h-5 w-5 text-[#7E69AB]" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-[#1E293B]">{titulo}</h2>
            <p className="mt-1 text-sm text-[#64748B]">{texto}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:shrink-0">
          <Button asChild className="bg-[#25D366] text-white hover:bg-[#1EBE5A]">
            <a href={SUPORTE_WHATSAPP} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> {t('suporte.whatsapp')}
            </a>
          </Button>
          <Button asChild variant="outline" className="bg-white">
            <a href={`mailto:${SUPORTE_EMAIL}`}>
              <Mail className="h-4 w-4" /> {t('suporte.email')}
            </a>
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-[#64748B]">
        {t('suporte.ouEscreva')} <a href={`mailto:${SUPORTE_EMAIL}`} className="font-medium text-[#7E69AB] hover:underline">{SUPORTE_EMAIL}</a>
      </p>
    </section>
  );
}
