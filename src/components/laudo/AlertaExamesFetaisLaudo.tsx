/**
 * V4 — Exames de crescimento e vitalidade fetal NO LAUDO. Auto-busca a linha de
 * `exames_fetais` da consulta e renderiza (1) o REGISTRO read-only dos resultados
 * respondidos (quadro lilás — espelho do card da ficha) e (2) o ALERTA da Família 2
 * (vitalidade/morfologia) quando há achado. Renderiza nada quando não há dado algum.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { alertasFamilia2, fromExamesFetaisRow, type ExamesFetaisState } from '@/components/ficha/examesFetaisItems';
import ExamesFetaisReadOnly from '@/components/ficha/ExamesFetaisReadOnly';
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
  const temDados = Object.values(estado).some((v) => v != null);
  if (!temDados) return null;
  const alertas = alertasFamilia2(estado);

  return (
    <div className="space-y-4 mt-4">
      {/* Registro read-only dos resultados (quadro lilás) */}
      <ExamesFetaisReadOnly value={estado} />

      {/* Alerta da Família 2 (vitalidade/morfologia) */}
      {alertas.length > 0 && (
        <div className="rounded-xl border-2 p-4 space-y-1" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
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
      )}
    </div>
  );
}
