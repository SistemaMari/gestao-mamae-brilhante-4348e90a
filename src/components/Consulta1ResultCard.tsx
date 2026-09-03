import { useEffect, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useLaudoTextos } from '@/hooks/useLaudoTextos';

interface Consulta1ResultCardProps {
  /** Mantidas por compatibilidade — não são mais usadas neste card. */
  janelaGTT?: { inicio: Date; fim: Date } | null;
  igMaior24?: boolean;
  /** Id da consulta_1 (opcional). Sem ele, cai no texto fixo padrão do i18n. */
  consultaId?: string | null;
}

/**
 * Caso Novo — Pedido de exame.
 *
 * NÃO é um laudo. Antes o texto ficava fixo no i18n; agora vive em
 * `laudo_textos` (tipo_consulta='consulta_1', desfecho_clinico='pedido_exame',
 * bloco='orientacao'), para as Dras poderem editar pelo painel /admin/laudos.
 * Se o SQL de seed ainda não foi aplicado no banco, o card cai para o texto
 * padrão do i18n — não fica em branco.
 */
export default function Consulta1ResultCard({ consultaId }: Consulta1ResultCardProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');
  const { getEstado, garantir } = useLaudoTextos({ isPreview });

  const idEfetivo = consultaId ?? '__caso_novo_default__';

  useEffect(() => {
    garantir(idEfetivo, 'consulta_1', 'pedido_exame');
  }, [idEfetivo, garantir]);

  const estado = getEstado(idEfetivo);

  const blocoOrientacao = useMemo(
    () => estado.textos.find((b) => b.bloco === 'orientacao'),
    [estado.textos],
  );

  // Texto padrão do i18n — fallback se ainda não existe linha no banco (SQL
  // não rodado) ou enquanto a Edge Function carrega.
  const textoOrientacao =
    blocoOrientacao?.texto ?? t('consulta1Result.orientationBody');
  const tituloOrientacao =
    blocoOrientacao?.titulo_bloco ?? t('consulta1Result.orientationTitle');

  return (
    <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7] p-5 space-y-4">
      <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        {t('consulta1Result.title')}
      </h2>

      <div className="rounded-lg bg-white/70 p-3">
        <p className="text-sm font-semibold text-emerald-900">{tituloOrientacao}</p>
        <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-800">{textoOrientacao}</p>
      </div>
    </div>
  );
}
