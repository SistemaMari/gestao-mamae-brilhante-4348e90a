/**
 * V4 — Resposta vigente do ultrassom de crescimento fetal para a consulta atual.
 *
 * PFE-US, CA, LA e o crescimento fetal são a leitura de UM ultrassom obstétrico,
 * feito duas vezes na gestação (janela de 28–32 semanas e 36ª). Portanto são
 * respondidos duas vezes, não a cada retorno. Este hook responde: "o exame desta
 * janela já foi lido em alguma consulta anterior? Se sim, qual foi o resultado e
 * de onde ele veio?" — para que a ficha EXIBA o resultado em vez de reperguntar.
 *
 * Junta as DUAS origens do mesmo dado, porque o exame pode ter sido registrado em
 * qualquer uma delas:
 *   - checklist do Retorno 2 (`decisoes_ficha_a.checklist_*`), na Ficha A/C;
 *   - card de exames fetais (`exames_fetais`), na Ficha E (e o crescimento também
 *     na Ficha A/C, onde só PFE/CA/LA ficam ocultos por já virem do checklist).
 *
 * Usado por FichaACForm e FichaEForm — a regra é a mesma nas duas fichas.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIgBatch } from '@/lib/getIg';
import {
  respostaVigenteDaJanela, ultimoRegistroCrescimento, type RespostaVigenteCrescimento,
} from '@/lib/janelaCrescimentoFetal';

interface ConsultaMinima {
  id: string;
  data?: string | null;
  checklist_pfe_us?: string | null;
  checklist_ca?: string | null;
  checklist_la?: string | null;
}

interface Params {
  pacienteId: string;
  consultas: readonly ConsultaMinima[];
  /** IG (semanas) da consulta sendo preenchida — define a janela vigente. */
  igSemanas: number | null | undefined;
  /** Consulta em edição: não pode travar a si mesma enquanto é preenchida. */
  consultaAtualId?: string | null;
  /** Pacientes de demonstração vivem em localStorage, sem linhas no Supabase. */
  isPreview?: boolean;
}

export interface CrescimentoConhecido {
  /** Resultado do exame da janela ATUAL — trava a coleta desta consulta. */
  vigente: RespostaVigenteCrescimento | null;
  /** Último resultado conhecido, de qualquer janela — exibido nas semanas em que
   *  não há coleta (IG 33–35), onde não existe nada a preencher. */
  ultimo: RespostaVigenteCrescimento | null;
}

export function useRespostaVigenteCrescimento({
  pacienteId, consultas, igSemanas, consultaAtualId, isPreview,
}: Params): CrescimentoConhecido {
  const { igs: igPorConsulta } = useIgBatch(
    consultas.map((c) => ({ key: c.id, pacienteId, dataAlvo: c.data ?? null })),
  );

  const [examesPorConsulta, setExamesPorConsulta] = useState<Map<string, any>>(new Map());
  useEffect(() => {
    if (isPreview) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from('exames_fetais' as any)
        .select('consulta_id, pfe_us, ca, la, crescimento')
        .eq('paciente_id', pacienteId);
      if (!ativo || !data) return;
      setExamesPorConsulta(new Map((data as any[]).map((r) => [r.consulta_id, r])));
    })();
    return () => { ativo = false; };
  }, [pacienteId, isPreview]);

  return useMemo(() => {
    const registros = consultas.map((c) => {
      const ex = examesPorConsulta.get(c.id);
      return {
        consultaId: c.id,
        data: c.data ?? null,
        igSemanas: igPorConsulta.get(c.id)?.semanas ?? null,
        // O checklist do Retorno 2 e o card são o mesmo exame lido em lugares
        // diferentes; qualquer um dos dois vale como "resultado registrado".
        pfe_us: ex?.pfe_us ?? c.checklist_pfe_us ?? null,
        ca: ex?.ca ?? c.checklist_ca ?? null,
        la: ex?.la ?? c.checklist_la ?? null,
        crescimento: ex?.crescimento ?? null,
      };
    });
    return {
      vigente: respostaVigenteDaJanela(igSemanas, registros, consultaAtualId),
      ultimo: ultimoRegistroCrescimento(registros, consultaAtualId),
    };
  }, [consultas, igPorConsulta, examesPorConsulta, igSemanas, consultaAtualId]);
}
