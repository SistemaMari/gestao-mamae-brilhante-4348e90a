/**
 * V4 — Card do laudo que SOLICITA os exames de crescimento/vitalidade fetal
 * devidos na idade gestacional da ficha. Aparece nas fichas de acompanhamento
 * (perfis) pós-diagnóstico. Rende nada quando não há exame a pedir naquela IG.
 *
 * Os rótulos são RASCUNHO (i18n ficha.pedidoExames.*), pendentes de ratificação
 * clínica — mesmo padrão dos demais textos de laudo.
 */
import { ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pedidosExamesFetais, fichaTemPedidoExames } from '@/lib/pedidosExamesFetais';

interface Props {
  tipo: string | null | undefined;
  igSemanas: number | null | undefined;
}

export default function PedidoExamesFetaisCard({ tipo, igSemanas }: Props) {
  const { t } = useTranslation();
  if (!fichaTemPedidoExames(tipo)) return null;
  const pedidos = pedidosExamesFetais(igSemanas);
  if (pedidos.length === 0) return null;

  return (
    <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: '#F5F3FF', borderColor: '#D6BCFA' }}>
      <div className="flex items-center gap-2">
        <ClipboardList className="h-4 w-4" style={{ color: '#5B21B6' }} />
        <h4 className="text-sm font-bold" style={{ color: '#5B21B6' }}>{t('ficha.pedidoExames.titulo')}</h4>
      </div>
      <ul className="list-disc pl-6 space-y-0.5">
        {pedidos.map((k) => (
          <li key={k} className="text-xs" style={{ color: '#4C1D95' }}>{t(k)}</li>
        ))}
      </ul>
    </div>
  );
}
