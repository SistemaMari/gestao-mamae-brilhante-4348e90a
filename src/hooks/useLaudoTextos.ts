import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Estados possíveis da seção de textos do laudo (34D-B).
 *  - pendente:         ainda não solicitado
 *  - carregando:       chamada à Edge Function em andamento
 *  - completo:         obter-textos-laudo respondeu completo=true → renderiza blocos
 *  - incompleto:       completo=false → placeholder "Texto pendente" (estado de transição)
 *  - ficha_incompleta: desfecho ainda não calculado → mensagem, SEM chamar a função
 *  - desativado:       LAUDO_GERACAO_ATIVA=false (defensivo — ver nota em carregar)
 *  - erro:             rede / 5xx → mensagem genérica + retry
 */
export type StatusTextos =
  | 'pendente'
  | 'carregando'
  | 'completo'
  | 'incompleto'
  | 'ficha_incompleta'
  | 'desativado'
  | 'erro';

/** Bloco textual fixo, exatamente como armazenado em laudo_textos (34D-A). */
export interface BlocoTexto {
  bloco: string;
  ordem_bloco: number;
  titulo_bloco: string | null;
  texto: string;
  versao: number | null;
}

export interface EstadoTextos {
  status: StatusTextos;
  textos: BlocoTexto[];
  blocosFaltantes: string[];
  mensagem?: string | null;
  erro?: { codigo?: number; mensagem: string } | null;
}

const PENDENTE: EstadoTextos = { status: 'pendente', textos: [], blocosFaltantes: [] };

const FICHA_INCOMPLETA: EstadoTextos = {
  status: 'ficha_incompleta',
  textos: [],
  blocosFaltantes: [],
  mensagem: 'Complete os dados clínicos da ficha para visualizar o laudo.',
};

const ERRO_GENERICO = 'Não foi possível carregar os textos do laudo. Tente novamente em instantes.';

interface UseLaudoTextosOptions {
  isPreview: boolean;
}

/**
 * Hook que lê os TEXTOS FIXOS do laudo via Edge Function `obter-textos-laudo`
 * (34D-B). Substitui o antigo `useLaudoIA` — não há mais chamada ao Gemini nem
 * geração/persistência de laudo no fluxo de visualização. A fonte da verdade é
 * a tabela `laudo_textos` (escrita pelo time clínico), keyed por
 * (tipo_consulta + desfecho_clinico).
 *
 * O estado é indexado por `consultaId` para suportar o histórico (várias
 * consultas renderizadas na mesma tela).
 */
export function useLaudoTextos({ isPreview }: UseLaudoTextosOptions) {
  const [estado, setEstado] = useState<Record<string, EstadoTextos>>({});
  // Evita refazer a mesma chamada várias vezes (auto-trigger + re-render).
  const tentadosRef = useRef<Set<string>>(new Set());

  const carregar = useCallback(
    async (
      consultaId: string,
      tipoConsulta: string | null | undefined,
      desfechoClinico: string | null | undefined,
    ) => {
      // Critério 9: desfecho ainda não calculado (ficha incompleta) → mensagem,
      // SEM chamar a Edge Function.
      if (!tipoConsulta || !desfechoClinico) {
        setEstado((prev) => ({ ...prev, [consultaId]: FICHA_INCOMPLETA }));
        return;
      }

      // Vitrine pública (/vitrine) não tem sessão autenticada e a Edge Function
      // exige Bearer. Além disso, por decisão clínica (obs. #6 do 34D-B) NÃO há
      // texto fictício de fallback. Durante o estado de transição é esperado que
      // a vitrine exiba o placeholder — comportamento correto, não bug.
      if (isPreview) {
        setEstado((prev) => ({
          ...prev,
          [consultaId]: { status: 'incompleto', textos: [], blocosFaltantes: ['*'] },
        }));
        return;
      }

      setEstado((prev) => ({
        ...prev,
        [consultaId]: { status: 'carregando', textos: [], blocosFaltantes: [] },
      }));

      try {
        const { data, error } = await supabase.functions.invoke('obter-textos-laudo', {
          body: { tipo_consulta: tipoConsulta, desfecho_clinico: desfechoClinico },
        });

        if (error) {
          // Defensivo (critério 13): obter-textos-laudo não checa a flag hoje,
          // mas se algum erro de "geração desativada" chegar, mostramos a
          // mensagem específica em vez do erro genérico.
          let flagDesativada = false;
          const ctx = (error as { context?: { response?: { text?: () => Promise<string> } } }).context;
          try {
            const raw = await ctx?.response?.text?.();
            if (raw) {
              const j = JSON.parse(raw) as { erro?: string; error?: string };
              const code = String(j?.erro ?? j?.error ?? '').toUpperCase();
              if (code.includes('GERACAO') || code.includes('DESATIV')) flagDesativada = true;
            }
          } catch {
            /* corpo não-JSON — ignora */
          }

          if (flagDesativada) {
            setEstado((prev) => ({
              ...prev,
              [consultaId]: {
                status: 'desativado',
                textos: [],
                blocosFaltantes: [],
                mensagem:
                  'A geração de laudos está temporariamente desativada pela administração do sistema.',
              },
            }));
            return;
          }

          setEstado((prev) => ({
            ...prev,
            [consultaId]: {
              status: 'erro',
              textos: [],
              blocosFaltantes: [],
              erro: { mensagem: ERRO_GENERICO },
            },
          }));
          return;
        }

        const completo = data?.completo === true;
        const textosRaw: BlocoTexto[] = Array.isArray(data?.textos) ? data.textos : [];

        if (completo && textosRaw.length > 0) {
          const ordenados = [...textosRaw].sort(
            (a, b) => (a.ordem_bloco ?? 0) - (b.ordem_bloco ?? 0),
          );
          setEstado((prev) => ({
            ...prev,
            [consultaId]: { status: 'completo', textos: ordenados, blocosFaltantes: [] },
          }));
          return;
        }

        const faltantes: string[] =
          Array.isArray(data?.blocos_faltantes) && data.blocos_faltantes.length
            ? data.blocos_faltantes
            : ['*'];
        setEstado((prev) => ({
          ...prev,
          [consultaId]: {
            status: 'incompleto',
            textos: [],
            blocosFaltantes: faltantes,
            mensagem: typeof data?.mensagem === 'string' ? data.mensagem : null,
          },
        }));
      } catch {
        setEstado((prev) => ({
          ...prev,
          [consultaId]: {
            status: 'erro',
            textos: [],
            blocosFaltantes: [],
            erro: { mensagem: ERRO_GENERICO },
          },
        }));
      }
    },
    [isPreview],
  );

  /** Carrega os textos de uma consulta uma única vez (auto-trigger). */
  const garantir = useCallback(
    (
      consultaId: string,
      tipoConsulta: string | null | undefined,
      desfechoClinico: string | null | undefined,
    ) => {
      if (tentadosRef.current.has(consultaId)) return;
      tentadosRef.current.add(consultaId);
      void carregar(consultaId, tipoConsulta, desfechoClinico);
    },
    [carregar],
  );

  /** Retry manual (critério 12) — reseta o dedupe e refaz a chamada. */
  const tentarNovamente = useCallback(
    (
      consultaId: string,
      tipoConsulta: string | null | undefined,
      desfechoClinico: string | null | undefined,
    ) => {
      tentadosRef.current.delete(consultaId);
      void carregar(consultaId, tipoConsulta, desfechoClinico);
    },
    [carregar],
  );

  /** Reset ao trocar de paciente. */
  const resetar = useCallback(() => {
    setEstado({});
    tentadosRef.current.clear();
  }, []);

  const getEstado = useCallback(
    (consultaId: string): EstadoTextos => estado[consultaId] ?? PENDENTE,
    [estado],
  );

  return { getEstado, garantir, tentarNovamente, resetar, carregar };
}
