import { supabase } from '@/integrations/supabase/client';

export interface LaudoDaUnidade {
  profissional_id: string;
  paciente_id: string;
  created_at: string;
}

const PAGINA = 1000;

/**
 * Todos os laudos das gestantes de uma unidade, em páginas de 1000.
 * O PostgREST devolve no máximo 1000 linhas por consulta: sem paginar, o card
 * "Laudos gerados pela equipe", o desempenho por profissional e o tempo até o
 * 1º laudo travavam em 1000 numa unidade grande. Lança o erro da consulta.
 */
export async function buscarLaudosDaUnidade(unidadeId: string): Promise<LaudoDaUnidade[]> {
  const todos: LaudoDaUnidade[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('laudos')
      .select('id, profissional_id, paciente_id, created_at, pacientes!inner(unidade_id)')
      .eq('pacientes.unidade_id', unidadeId)
      .order('id', { ascending: true })
      .range(de, de + PAGINA - 1);
    if (error) throw error;
    const pagina = (data ?? []) as unknown as LaudoDaUnidade[];
    todos.push(...pagina);
    if (pagina.length < PAGINA) return todos;
  }
}
