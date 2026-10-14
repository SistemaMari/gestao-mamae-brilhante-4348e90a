import { supabase } from '@/integrations/supabase/client';
import { buscarLaudosDaUnidade } from '@/lib/laudosDaUnidade';
import type { ProfissionalEquipe } from '@/components/gestao/ComposicaoClinica';
import type { ProfPerformance } from '@/components/gestao/PerformanceIndividual';
import type { Sobrecarregado } from '@/components/gestao/IndicadoresFluxo';
import type { PainelOperacao } from '@/lib/painelEstrategicoTypes';

export interface DadosEquipe {
  totalAtivos: number | null;
  totalPendentes: number | null;
  totalExpirados: number | null;
  totalLaudos: number | null;
  errosCards: { ativos: boolean; pendentes: boolean; expirados: boolean; laudos: boolean };
  profissionaisEquipe: ProfissionalEquipe[];
  erroComposicao: boolean;
  performance: ProfPerformance[];
  erroPerformance: boolean;
  tempoMedioDias: number | null;
  sobrecarregados: Sobrecarregado[];
  erroTempo: boolean;
  erroSobrecarga: boolean;
}

export async function fetchDadosEquipe(unidadeId: string): Promise<DadosEquipe> {
  const out: DadosEquipe = {
    totalAtivos: null,
    totalPendentes: null,
    totalExpirados: null,
    totalLaudos: null,
    errosCards: { ativos: false, pendentes: false, expirados: false, laudos: false },
    profissionaisEquipe: [],
    erroComposicao: false,
    performance: [],
    erroPerformance: false,
    tempoMedioDias: null,
    sobrecarregados: [],
    erroTempo: false,
    erroSobrecarga: false,
  };

  // Equipe via RPC SECURITY DEFINER (mesma fonte da GestaoEquipePage).
  const profRes = await supabase.rpc('get_profissionais_equipe', { p_unidade_id: unidadeId });
  const profissionais = (((profRes.data ?? []) as unknown) as Array<{
    id: string; nome: string; crm: string | null; especialidade: string | null;
    perfil_clinico: string | null; created_at: string; acesso_revogado: boolean | null;
    perfil_institucional: string | null;
  }>).filter(p => !p.acesso_revogado);
  // Gestor de unidade não atende gestantes: fora das métricas da equipe clínica.
  const equipeClinica = profissionais.filter(p => p.perfil_institucional !== 'gestor');

  out.profissionaisEquipe = equipeClinica.map(p => ({
    id: p.id, nome: p.nome, especialidade: p.especialidade, perfil_clinico: p.perfil_clinico,
  }));
  try { out.totalAtivos = equipeClinica.length; } catch { out.errosCards.ativos = true; }

  // Convites
  const { data: convites } = await supabase
    .from('convites')
    .select('id, email_convidado, status, created_at, expires_at')
    .eq('unidade_id', unidadeId)
    .in('status', ['pendente']);
  try {
    const agora = new Date();
    const pend = (convites || []).filter(c => c.status === 'pendente' && new Date(c.expires_at) > agora).length;
    const exp = (convites || []).filter(c => c.status === 'pendente' && new Date(c.expires_at) <= agora).length;
    out.totalPendentes = pend;
    out.totalExpirados = exp;
  } catch {
    out.errosCards.pendentes = true; out.errosCards.expirados = true;
  }

  // Laudos da unidade
  let laudosDaUnidade: Array<{ profissional_id: string; paciente_id: string; created_at: string }> = [];
  try {
    laudosDaUnidade = await buscarLaudosDaUnidade(unidadeId);
    out.totalLaudos = laudosDaUnidade.length;
  } catch (e) {
    console.error('[card laudos]', e);
    out.errosCards.laudos = true;
    out.erroPerformance = true;
    out.erroTempo = true;
  }

  // Operação (distribuição)
  let distribuicao: PainelOperacao['distribuicao_profissionais'] = [];
  try {
    const opRes = await supabase.rpc('get_painel_operacao', { p_unidade_id: unidadeId });
    if (!opRes.error && opRes.data) {
      const op = opRes.data as unknown as PainelOperacao;
      distribuicao = op.distribuicao_profissionais || [];
    }
  } catch {
    out.erroSobrecarga = true;
  }

  // Performance
  try {
    const laudosPorProf = new Map<string, number>();
    laudosDaUnidade.forEach(l => {
      laudosPorProf.set(l.profissional_id, (laudosPorProf.get(l.profissional_id) || 0) + 1);
    });
    const pacPorProf = new Map<string, number>();
    distribuicao.forEach(d => pacPorProf.set(d.profissional_id, d.total_pacientes_ativos));
    out.performance = equipeClinica.map(p => ({
      id: p.id,
      nome: p.nome,
      crm: p.crm,
      laudos: laudosPorProf.get(p.id) || 0,
      pacientes: pacPorProf.get(p.id) || 0,
    }));
  } catch {
    out.erroPerformance = true;
  }

  // Tempo médio até 1º laudo
  try {
    const primeiroLaudo = new Map<string, Date>();
    laudosDaUnidade.forEach(l => {
      const d = new Date(l.created_at);
      const cur = primeiroLaudo.get(l.paciente_id);
      if (!cur || d < cur) primeiroLaudo.set(l.paciente_id, d);
    });
    const noventaDias = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const pacientesElegiveis = Array.from(primeiroLaudo.entries())
      .filter(([, d]) => d >= noventaDias)
      .map(([pid, d]) => ({ pid, dataLaudo: d }));

    if (pacientesElegiveis.length === 0) {
      out.tempoMedioDias = null;
    } else {
      const ids = pacientesElegiveis.map(p => p.pid);
      const { data: cons, error } = await supabase
        .from('consultas')
        .select('paciente_id, data')
        .in('paciente_id', ids);
      if (error) throw error;
      const primeiraCons = new Map<string, Date>();
      (cons || []).forEach(c => {
        const d = new Date(c.data);
        const cur = primeiraCons.get(c.paciente_id);
        if (!cur || d < cur) primeiraCons.set(c.paciente_id, d);
      });
      const deltas: number[] = [];
      pacientesElegiveis.forEach(({ pid, dataLaudo }) => {
        const pc = primeiraCons.get(pid);
        if (pc) {
          const delta = Math.round((dataLaudo.getTime() - pc.getTime()) / (24 * 60 * 60 * 1000));
          if (delta >= 0) deltas.push(delta);
        }
      });
      out.tempoMedioDias = deltas.length === 0 ? null : deltas.reduce((a, b) => a + b, 0) / deltas.length;
    }
  } catch {
    out.erroTempo = true;
  }

  // Sobrecarga
  try {
    const ativosDist = distribuicao.filter(d => d.total_pacientes_ativos > 0);
    if (ativosDist.length === 0) {
      out.sobrecarregados = [];
    } else {
      const media = ativosDist.reduce((s, d) => s + d.total_pacientes_ativos, 0) / ativosDist.length;
      out.sobrecarregados = ativosDist
        .filter(d => d.total_pacientes_ativos > 2 * media)
        .map(d => ({ nome: d.nome, pacientes: d.total_pacientes_ativos }));
    }
  } catch {
    out.erroSobrecarga = true;
  }

  return out;
}
