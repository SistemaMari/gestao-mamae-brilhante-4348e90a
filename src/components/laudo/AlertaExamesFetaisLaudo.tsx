/**
 * V4 — Seção de avaliação fetal NO LAUDO (fichas de acompanhamento). Renderiza, em
 * ordem:
 *  1) REGISTRO read-only dos resultados respondidos (quadro lilás);
 *  2) PEDIDO, em dois blocos: exames PONTUAIS a solicitar (só os ainda não
 *     trazidos) e VIGILÂNCIA contínua (CMF/CTG/PBF, que reaparece a cada consulta);
 *  3) quadro AMARELO — Doppler (item 1, sempre) + achados da Família 2 (quando há);
 *  4) SUGESTÃO DE CONDUTA (peso fetal × bem-estar fetal — 4 cenários);
 *  5) ORIENTAÇÕES GERAIS.
 * Doppler/conduta/orientações aparecem em toda ficha de acompanhamento; registro e
 * achados dependem do que foi preenchido; o pedido depende da IG E do que já foi
 * trazido (exame pontual já registrado sai do pedido — ver pedidosExamesFetais).
 * Auto-busca a linha de `exames_fetais` da consulta.
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, ClipboardList, Stethoscope, Info, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { alertasFamilia2, fromExamesFetaisRow, type ExamesFetaisState } from '@/components/ficha/examesFetaisItems';
import ExamesFetaisReadOnly from '@/components/ficha/ExamesFetaisReadOnly';
import { pedidosExamesFetais, fichaTemPedidoExames, separarPedidos } from '@/lib/pedidosExamesFetais';

interface Props {
  tipo: string | null | undefined;
  consultaId: string | null | undefined;
  igSemanas: number | null | undefined;
  /** Ficha que decidiu insulina (MARI encerra) — muda o pedido de CTG/PBF. */
  emInsulina?: boolean;
  /** Pedidos PONTUAIS já atendidos até esta consulta (`pedidosJaAtendidos`).
   *  Sem isso o laudo repete exame que a gestante já trouxe. */
  jaAtendidos?: readonly string[];
}

export default function AlertaExamesFetaisLaudo({ tipo, consultaId, igSemanas, emInsulina, jaAtendidos }: Props) {
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

  // Doppler/conduta/orientações valem para toda ficha de acompanhamento.
  if (!fichaTemPedidoExames(tipo)) return null;

  const alertas = estado ? alertasFamilia2(estado) : [];
  const { solicitar, vigilancia } = separarPedidos(
    pedidosExamesFetais(igSemanas, !!emInsulina, jaAtendidos ?? []),
  );
  const condutaItens = ['item1', 'item2', 'item3', 'item4'];
  const orientacoesItens = ['item1', 'item2', 'item3'];

  return (
    <div className="space-y-4 mt-4">
      {/* 1) Registro read-only dos resultados (quadro lilás) */}
      {estado && <ExamesFetaisReadOnly value={estado} igSemanas={igSemanas} />}

      {/* 2a) Exames PONTUAIS a solicitar (só os ainda não trazidos) */}
      {solicitar.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: '#F5F3FF', borderColor: '#D6BCFA' }}>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" style={{ color: '#5B21B6' }} />
            <h4 className="text-sm font-bold" style={{ color: '#5B21B6' }}>{t('ficha.pedidoExames.titulo')}</h4>
          </div>
          <ul className="list-disc pl-6 space-y-0.5">
            {solicitar.map((k) => (
              <li key={k} className="text-xs" style={{ color: '#4C1D95' }}>{t(k)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 2b) Vigilância CONTÍNUA — reaparece a cada consulta por definição (não é
          pedido repetido): CMF diário, CTG/PBF semanais. */}
      {vigilancia.length > 0 && (
        <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: '#F5F3FF', borderColor: '#D6BCFA' }}>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: '#5B21B6' }} />
            <h4 className="text-sm font-bold" style={{ color: '#5B21B6' }}>{t('ficha.pedidoExames.tituloVigilancia')}</h4>
          </div>
          <ul className="list-disc pl-6 space-y-0.5">
            {vigilancia.map((k) => (
              <li key={k} className="text-xs" style={{ color: '#4C1D95' }}>{t(k)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 3) Quadro amarelo — Doppler (sempre, item 1 em destaque) + achados da Família 2 */}
      <div className="rounded-xl border-2 p-4 space-y-2" style={{ backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" style={{ color: '#92400E' }} />
          <span className="text-sm font-bold" style={{ color: '#92400E' }}>{t('ficha.examesFetais.alertaTitulo')}</span>
        </div>
        <p className="rounded-md bg-white/70 px-3 py-2 text-xs font-semibold" style={{ color: '#92400E' }}>
          {t('ficha.examesFetais.doppler')}
        </p>
        {alertas.length > 0 && (
          <ul className="list-disc pl-6 space-y-0.5">
            {alertas.map((a) => (
              <li key={a.key} className="text-xs" style={{ color: '#B45309' }}>{t(a.alertaKey)}</li>
            ))}
          </ul>
        )}
      </div>

      {/* 4) Sugestão de conduta (peso fetal × bem-estar fetal) */}
      <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: '#F0FDFA', borderColor: '#99F6E4' }}>
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" style={{ color: '#0F766E' }} />
          <h4 className="text-sm font-bold" style={{ color: '#0F766E' }}>{t('ficha.condutaFetal.titulo')}</h4>
        </div>
        <ul className="list-decimal pl-6 space-y-0.5">
          {condutaItens.map((k) => (
            <li key={k} className="text-xs" style={{ color: '#115E59' }}>{t(`ficha.condutaFetal.${k}`)}</li>
          ))}
        </ul>
      </div>

      {/* 5) Orientações gerais */}
      <div className="rounded-xl border p-4 space-y-2" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4" style={{ color: '#475569' }} />
          <h4 className="text-sm font-bold" style={{ color: '#334155' }}>{t('ficha.orientacoesGerais.titulo')}</h4>
        </div>
        <ul className="list-decimal pl-6 space-y-0.5">
          {orientacoesItens.map((k) => (
            <li key={k} className="text-xs" style={{ color: '#475569' }}>{t(`ficha.orientacoesGerais.${k}`)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
