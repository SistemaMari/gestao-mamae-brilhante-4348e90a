import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StatusIA } from '@/components/laudo/Bloco2Justificativa';
import type { Cenario } from '@/lib/laudoMapping';
import { cenarioLabel } from '@/lib/laudoMapping';

export interface EstadoIA {
  statusIA: StatusIA;
  bloco2: string | null;
  bloco3: string | null;
  erroIA?: { codigo?: number; mensagem: string } | null;
  laudoId?: string | null;
}

const PENDENTE: EstadoIA = { statusIA: 'pendente', bloco2: null, bloco3: null };

interface UseLaudoIAOptions {
  isPreview: boolean;
}

/**
 * Hook centralizado para gerar e ler os Blocos 2 (Justificativa) e 3 (Conduta)
 * via edge function `gerar-laudo`. Em modo preview, devolve template demo.
 */
export function useLaudoIA({ isPreview }: UseLaudoIAOptions) {
  const [estado, setEstado] = useState<Record<string, EstadoIA>>({});
  // Evita gerar/carregar o mesmo laudo várias vezes
  const tentadosRef = useRef<Set<string>>(new Set());

  /** Carrega laudos já persistidos para uma lista de consultas. */
  const carregarLaudosExistentes = useCallback(
    async (pacienteId: string, consultaIds: string[]) => {
      if (isPreview || consultaIds.length === 0) return;

      const { data, error } = await supabase
        .from('laudos')
        .select('id, consulta_id, conteudo_laudo, status')
        .eq('paciente_id', pacienteId)
        .in('consulta_id', consultaIds);

      if (error || !data) return;

      const novos: Record<string, EstadoIA> = {};
      for (const row of data) {
        if (!row.consulta_id) continue;
        if (row.status === 'gerado' && row.conteudo_laudo) {
          try {
            const parsed = JSON.parse(row.conteudo_laudo);
            const b2 = parsed?.bloco_2_justificativa;
            const b3 = parsed?.bloco_3_conduta;
            const bloco2 =
              typeof b2 === 'string' ? b2 : b2 ? JSON.stringify(b2, null, 2) : null;
            const bloco3 =
              typeof b3 === 'string' ? b3 : b3 ? JSON.stringify(b3, null, 2) : null;
            novos[row.consulta_id] = {
              statusIA: 'pronto',
              bloco2,
              bloco3,
              laudoId: row.id,
            };
            tentadosRef.current.add(row.consulta_id);
          } catch {
            // ignora JSON inválido — permite regerar
          }
        } else if (row.status === 'processando') {
          novos[row.consulta_id] = {
            statusIA: 'gerando',
            bloco2: null,
            bloco3: null,
            laudoId: row.id,
          };
          tentadosRef.current.add(row.consulta_id);
        }
      }
      if (Object.keys(novos).length > 0) {
        setEstado((prev) => ({ ...novos, ...prev }));
      }
    },
    [isPreview],
  );

  /** Gera (ou regenera) o laudo de uma consulta. */
  const gerarLaudo = useCallback(
    async (pacienteId: string, consultaId: string, cenario?: Cenario) => {
      // Preview: devolve template demo, não chama IA
      if (isPreview) {
        const label = cenario ? cenarioLabel(cenario) : 'Cenário demonstrativo';
        setEstado((prev) => ({
          ...prev,
          [consultaId]: {
            statusIA: 'pronto',
            bloco2: [
              `**Exemplo demonstrativo (modo vitrine)** — ${label}.`,
              '',
              'A justificativa clínica completa é gerada pela IA **MARI** a partir do PROTOCOLO_DMG_Brasil_2016 e da Base de Conhecimento institucional, considerando IG, exames, perfil glicêmico e histórico da paciente.',
              '',
              'Em ambiente real, este bloco contém:',
              '- Síntese clínica objetiva do quadro.',
              '- Citação dos critérios do protocolo aplicáveis.',
              '- Razões para a conduta sugerida.',
            ].join('\n'),
            bloco3: [
              `**Exemplo demonstrativo (modo vitrine)** — ${label}.`,
              '',
              'A conduta sugerida pela IA MARI inclui:',
              '- Próximo passo clínico recomendado.',
              '- Janela e tipo do próximo exame, quando aplicável.',
              '- Orientações de acompanhamento e sinais de alerta.',
              '- Critérios para encaminhamento ao endocrinologista.',
            ].join('\n'),
          },
        }));
        tentadosRef.current.add(consultaId);
        return;
      }

      // Real mode
      tentadosRef.current.add(consultaId);
      setEstado((prev) => ({
        ...prev,
        [consultaId]: {
          statusIA: 'gerando',
          bloco2: null,
          bloco3: null,
          laudoId: prev[consultaId]?.laudoId ?? null,
        },
      }));

      try {
        const { data, error } = await supabase.functions.invoke('gerar-laudo', {
          body: { paciente_id: pacienteId, consulta_id: consultaId, cenario_clinico: cenario ?? null },
        });

        if (error) {
          // FunctionsHttpError carrega o status no context
          const ctx: any = (error as any).context ?? {};
          const status: number | undefined = ctx?.status;
          let mensagem = error.message || 'Erro ao gerar laudo.';
          let codigo: number | undefined = status;

          // Tenta extrair detalhes do corpo de erro
          try {
            const raw = await ctx?.response?.text?.();
            if (raw) {
              const j = JSON.parse(raw);
              if (j?.error) mensagem = j.error;
            }
          } catch { /* ignora */ }

          if (status === 402) {
            codigo = 403; // Bloco2/Bloco3 usam 403 para "Limite atingido"
            mensagem = 'Limite de laudos do plano atingido.';
          } else if (status === 429) {
            mensagem = 'Muitas requisições à IA. Tente novamente em instantes.';
          }

          setEstado((prev) => ({
            ...prev,
            [consultaId]: {
              statusIA: 'erro',
              bloco2: null,
              bloco3: null,
              erroIA: { codigo, mensagem },
            },
          }));
          return;
        }

        const bloco2 = data?.bloco_2 ?? null;
        const bloco3 = data?.bloco_3 ?? null;
        const b2str = typeof bloco2 === 'string' ? bloco2 : bloco2 ? JSON.stringify(bloco2, null, 2) : null;
        const b3str = typeof bloco3 === 'string' ? bloco3 : bloco3 ? JSON.stringify(bloco3, null, 2) : null;

        setEstado((prev) => ({
          ...prev,
          [consultaId]: {
            statusIA: 'pronto',
            bloco2: b2str,
            bloco3: b3str,
            laudoId: data?.laudo_id ?? prev[consultaId]?.laudoId ?? null,
          },
        }));
      } catch (e: any) {
        setEstado((prev) => ({
          ...prev,
          [consultaId]: {
            statusIA: 'erro',
            bloco2: null,
            bloco3: null,
            erroIA: { mensagem: e?.message || 'Erro inesperado ao gerar laudo.' },
          },
        }));
      }
    },
    [isPreview],
  );

  /** Garante que o laudo de uma consulta seja gerado — uma vez só. */
  const garantirLaudo = useCallback(
    (pacienteId: string, consultaId: string, cenario?: Cenario) => {
      if (tentadosRef.current.has(consultaId)) return;
      tentadosRef.current.add(consultaId);
      void gerarLaudo(pacienteId, consultaId, cenario);
    },
    [gerarLaudo],
  );

  const tentarNovamente = useCallback(
    (pacienteId: string, consultaId: string, cenario?: Cenario) => {
      tentadosRef.current.delete(consultaId);
      void gerarLaudo(pacienteId, consultaId, cenario);
    },
    [gerarLaudo],
  );

  /** Reset ao trocar de paciente */
  const resetar = useCallback(() => {
    setEstado({});
    tentadosRef.current.clear();
  }, []);

  const getEstado = useCallback(
    (consultaId: string): EstadoIA => estado[consultaId] ?? PENDENTE,
    [estado],
  );

  // Evita warning de export não usado
  useEffect(() => { /* noop */ }, []);

  return {
    getEstado,
    carregarLaudosExistentes,
    gerarLaudo,
    garantirLaudo,
    tentarNovamente,
    resetar,
  };
}
