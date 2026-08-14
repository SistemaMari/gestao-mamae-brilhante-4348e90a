/**
 * V4 — Alerta da Família 2 (vitalidade/morfologia fetal) NO LAUDO. Espelha o alerta
 * que o ExamesFetaisCard já mostra na tela da ficha, para o achado também constar do
 * laudo. Auto-busca a linha de `exames_fetais` da consulta; renderiza nada quando não
 * há achado. Texto é placeholder até ratificação clínica (i18n ficha.examesFetais.alerta.*).
 */
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { alertasFamilia2, fromExamesFetaisRow, type ExamesFetaisState } from '@/components/ficha/examesFetaisItems';
import { fichaTemPedidoExames } from '@/lib/pedidosExamesFetais';

interface Props {
  tipo: string | null | undefined;
  consultaId: string | null | undefined;
}

export default function AlertaExamesFetaisLaudo({ tipo, consultaId }: Props) {
  const { t } = useTranslation();
  const [estado, setEstado] = useState<ExamesFetaisState | null>(null);

  useEffect(() => {
    if (!consultaId || !fichaTemPedidoExames(tipo)) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase.from('exames_fetais' as any).select('*').eq('consulta_id', consultaId).maybeSingle();
      if (ativo) setEstado(fromExamesFetaisRow(data as any));
    })();
    return () => { ativo = false; };
  }, [consultaId, tipo]);

  if (!estado) return null;
  const alertas = alertasFamilia2(estado);
  if (alertas.length === 0) return null;

  return (
    <div className="rounded-xl border-2 p-4 space-y-1 mt-4" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" style={{ color: '#92400E' }} />
        <span className="text-sm font-bold" style={{ color: '#92400E' }}>{t('ficha.examesFetais.alertaTitulo')}</span>
      </div>
      <ul className="list-disc pl-6 space-y-0.5">
        {alertas.map((a) => (
          <li key={a.key} className="text-xs" style={{ color: '#B45309' }}>{t(a.alertaKey)}</li>
        ))}
      </ul>
    </div>
  );
}
