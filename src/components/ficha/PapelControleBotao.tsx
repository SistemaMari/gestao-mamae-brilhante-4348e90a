/**
 * V4 — Botão que imprime o papel de controle em branco para a gestante levar.
 *
 * Entregue no FIM da consulta: a gestante chega com o papel preenchido do período
 * que passou, o profissional lança na ficha, e ela vai embora com um papel novo
 * para o período que começa amanhã. Por isso as datas saem do dia seguinte à
 * consulta em diante.
 *
 * Não depende de nada do servidor — o PDF nasce no próprio navegador.
 */
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  gerarPapelControle, imprimirPapelControle, datasDoProximoPeriodo,
} from '@/lib/papelControle';

interface Props {
  nomeGestante: string;
  /** Data desta consulta ('yyyy-MM-dd') — o papel começa no dia seguinte. */
  dataConsulta: string;
  /** Quantos dias o papel deve cobrir (15 na Ficha A/C, 10 na Ficha E). */
  dias: number;
  /** Chaves i18n dos rótulos de cada ponto, na ordem da grade. */
  colunas: string[];
  subColunas: string[];
  disabled?: boolean;
}

export default function PapelControleBotao({
  nomeGestante, dataConsulta, dias, colunas, subColunas, disabled,
}: Props) {
  const { t } = useTranslation();

  const imprimir = () => {
    const datas = datasDoProximoPeriodo(dataConsulta, dias);
    if (datas.length === 0) {
      toast.error(t('fichaAC.papelControle.faltaData'));
      return;
    }

    const doc = gerarPapelControle(
      { nomeGestante: nomeGestante || '—', datas },
      {
        titulo: t('fichaAC.papelControle.titulo'),
        instrucao: t('fichaAC.papelControle.instrucao'),
        rotuloGestante: t('fichaAC.papelControle.gestante'),
        rotuloPeriodo: t('fichaAC.papelControle.periodo'),
        colunaData: t('fichaAC.papelControle.data'),
        colunas: colunas.map((c) => t(c)),
        subColunas: subColunas.map((c) => (c ? t(c) : '')),
        rodape: t('fichaAC.papelControle.rodape'),
        nomeArquivo: t('fichaAC.papelControle.arquivo'),
      },
    );

    imprimirPapelControle(doc, t('fichaAC.papelControle.arquivo'));
  };

  return (
    <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-2">
      <Button type="button" size="sm" variant="outline" onClick={imprimir} disabled={disabled}>
        <Printer className="h-4 w-4 mr-1.5" />
        {t('fichaAC.papelControle.botao')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('fichaAC.papelControle.ajuda')}</p>
    </div>
  );
}
