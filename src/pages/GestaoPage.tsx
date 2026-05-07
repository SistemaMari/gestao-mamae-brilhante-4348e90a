import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Clock,
  FileText,
  Users,
  Activity,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import BlocoOperacao from '@/components/gestao/BlocoOperacao';
import BlocoPerfilClinico from '@/components/gestao/BlocoPerfilClinico';
import BlocoGargalos from '@/components/gestao/BlocoGargalos';
import BlocoTendencia from '@/components/gestao/BlocoTendencia';
import {
  mockOperacao,
  mockPerfilClinico,
  mockGargalos,
  mockTendencia,
} from '@/lib/mockPainelEstrategico';
import type {
  PainelOperacao,
  PainelPerfilClinico,
  PainelGargalos,
  PainelTendencia,
} from '@/lib/painelEstrategicoTypes';

interface AtividadeRecente {
  id: string;
  tipo: 'consulta' | 'laudo';
  descricao: string;
  profissional_nome: string;
  data: string;
}

interface UnidadeOpt {
  id: string;
  nome: string;
}

export default function GestaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith('/vitrine');
  const basePath = isVitrine ? '/vitrine/gestao' : '/gestao';

  const [unidadeNome, setUnidadeNome] = useState(isVitrine ? 'Hospital Demo MARI' : '');
  const [unidadeId, setUnidadeId] = useState<string | null>(
    isVitrine ? 'vitrine-unidade' : null,
  );
  const [isGestorGeral, setIsGestorGeral] = useState(false);
  const [unidadesDisponiveis, setUnidadesDisponiveis] = useState<UnidadeOpt[]>([]);
  const [gestorSemUnidade, setGestorSemUnidade] = useState(false);
  const [contextoCarregado, setContextoCarregado] = useState(isVitrine);

  const [operacao, setOperacao] = useState<PainelOperacao | null>(
    isVitrine ? mockOperacao : null,
  );
  const [perfil, setPerfil] = useState<PainelPerfilClinico | null>(
    isVitrine ? mockPerfilClinico : null,
  );
  const [gargalos, setGargalos] = useState<PainelGargalos | null>(
    isVitrine ? mockGargalos : null,
  );
  const [tendencia, setTendencia] = useState<PainelTendencia | null>(
    isVitrine ? mockTendencia : null,
  );
  const [loadingBlocos, setLoadingBlocos] = useState(!isVitrine);
  const [erroBlocos, setErroBlocos] = useState<string | null>(null);

  const [atividades, setAtividades] = useState<AtividadeRecente[]>(
    isVitrine
      ? [
          { id: 'a1', tipo: 'laudo', descricao: 'Laudo gerado', profissional_nome: 'Dra. Ana Souza', data: new Date(Date.now() - 2 * 86400000).toISOString() },
          { id: 'a2', tipo: 'consulta', descricao: 'Primeira consulta registrada', profissional_nome: 'Dr. Carlos Lima', data: new Date(Date.now() - 3 * 86400000).toISOString() },
          { id: 'a3', tipo: 'laudo', descricao: 'Laudo gerado', profissional_nome: 'Dra. Bia Mello', data: new Date(Date.now() - 4 * 86400000).toISOString() },
          { id: 'a4', tipo: 'consulta', descricao: 'Retorno registrado', profissional_nome: 'Dra. Ana Souza', data: new Date(Date.now() - 6 * 86400000).toISOString() },
        ]
      : [],
  );

  useEffect(() => {
    if (isVitrine) return;
    if (!user) return;
    initContext();
  }, [user, isVitrine]);

  useEffect(() => {
    if (isVitrine) return;
    if (!user || !unidadeId) return;
    fetchPainel();
  }, [user, unidadeId, isVitrine]);

  const initContext = async () => {
    if (!user) return;
    const { data: gg } = await supabase
      .from('gestores_gerais')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    const ehGestorGeral = !!gg;
    setIsGestorGeral(ehGestorGeral);

    if (ehGestorGeral) {
      const { data: uns } = await supabase.from('unidades').select('id, nome').order('nome');
      setUnidadesDisponiveis(uns || []);
      if (uns && uns.length > 0) setUnidadeId(uns[0].id);
    } else {
      const { data: prof } = await supabase
        .from('profissionais')
        .select('unidade_id, perfil_institucional, acesso_revogado')
        .eq('user_id', user.id)
        .maybeSingle();
      if (prof?.unidade_id) {
        setUnidadeId(prof.unidade_id);
      } else {
        if (prof && prof.perfil_institucional === 'gestor' && !prof.acesso_revogado) {
          setGestorSemUnidade(true);
        }
        setLoadingBlocos(false);
      }
    }
    setContextoCarregado(true);
  };

  const fetchPainel = async () => {
    if (!unidadeId) return;
    setLoadingBlocos(true);
    setErroBlocos(null);
    try {
      const { data: u } = await supabase
        .from('unidades')
        .select('nome')
        .eq('id', unidadeId)
        .single();
      setUnidadeNome(u?.nome || '');

      const [opRes, peRes, gaRes, teRes] = await Promise.all([
        supabase.rpc('get_painel_operacao', { p_unidade_id: unidadeId }),
        supabase.rpc('get_painel_perfil_clinico', { p_unidade_id: unidadeId }),
        supabase.rpc('get_painel_gargalos', { p_unidade_id: unidadeId }),
        supabase.rpc('get_painel_tendencia', { p_unidade_id: unidadeId }),
      ]);

      const erro = opRes.error || peRes.error || gaRes.error || teRes.error;
      if (erro) {
        setErroBlocos('Não foi possível carregar o painel. Tente novamente em instantes.');
        console.error('Erro RPC painel:', erro);
      } else {
        setOperacao(opRes.data as unknown as PainelOperacao);
        setPerfil(peRes.data as unknown as PainelPerfilClinico);
        setGargalos(gaRes.data as unknown as PainelGargalos);
        setTendencia(teRes.data as unknown as PainelTendencia);
      }

      const { data: profs } = await supabase
        .from('profissionais')
        .select('id, nome')
        .eq('unidade_id', unidadeId);
      const profMap = new Map((profs || []).map(p => [p.id, p.nome]));
      const profIds = (profs || []).map(p => p.id);
      if (profIds.length > 0) {
        const [consRes, lauRes] = await Promise.all([
          supabase
            .from('consultas')
            .select('id, data, profissional_id, tipo')
            .in('profissional_id', profIds)
            .order('data', { ascending: false })
            .limit(10),
          supabase
            .from('laudos')
            .select('id, created_at, profissional_id, status')
            .in('profissional_id', profIds)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);
        const acts: AtividadeRecente[] = [];
        (consRes.data || []).forEach(c => {
          acts.push({
            id: c.id,
            tipo: 'consulta',
            descricao: `${c.tipo === 'consulta_1' ? 'Primeira consulta' : 'Retorno'} registrado`,
            profissional_nome: (profMap.get(c.profissional_id) || 'Desconhecido') as string,
            data: c.data,
          });
        });
        (lauRes.data || []).forEach(l => {
          acts.push({
            id: l.id,
            tipo: 'laudo',
            descricao: `Laudo ${l.status === 'gerado' ? 'gerado' : 'pendente'}`,
            profissional_nome: (profMap.get(l.profissional_id) || 'Desconhecido') as string,
            data: l.created_at,
          });
        });
        acts.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
        setAtividades(acts.slice(0, 10));
      }
    } finally {
      setLoadingBlocos(false);
    }
  };

  if (contextoCarregado && gestorSemUnidade) {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-12">
        <div className="max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-200">
            <Building2 className="h-6 w-6 text-amber-900" />
          </div>
          <h1 className="font-heading text-xl font-semibold text-amber-950">
            Você ainda não está vinculado a uma unidade
          </h1>
          <p className="mt-3 text-sm text-amber-900">
            Sua conta de gestor está ativa, mas ainda não foi associada a nenhuma
            unidade. Aguarde a vinculação por um administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" />
          <span>{contextoCarregado ? unidadeNome || '—' : 'Carregando...'}</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Painel da unidade
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão estratégica da operação clínica
        </p>
      </div>

      {/* Seletor de unidade — só aparece para gestor geral */}
      {isGestorGeral && unidadesDisponiveis.length > 0 && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card p-4">
          <span className="text-sm text-muted-foreground">Unidade:</span>
          <Select value={unidadeId || ''} onValueChange={v => setUnidadeId(v)}>
            <SelectTrigger className="h-9 w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unidadesDisponiveis.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-8">
        {operacao && <BlocoOperacao data={operacao} loading={loadingBlocos} error={erroBlocos} />}
        {!operacao && loadingBlocos && (
          <BlocoOperacao data={mockOperacao} loading error={null} />
        )}

        {perfil && <BlocoPerfilClinico data={perfil} loading={loadingBlocos} error={erroBlocos} />}

        {gargalos && <BlocoGargalos data={gargalos} loading={loadingBlocos} error={erroBlocos} />}

        {tendencia && <BlocoTendencia data={tendencia} loading={loadingBlocos} error={erroBlocos} />}

        {/* Quick actions */}
        <div>
          <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
            Gestão
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => navigate(`${basePath}/equipe`)}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Gerenciar equipe</p>
                <p className="text-sm text-muted-foreground">
                  Ver membros, convidar e remover profissionais
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <button
              onClick={() => navigate(`${basePath}/fichas`)}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary/20 transition-colors group-hover:bg-secondary/30">
                <FileText className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">Fichas da unidade</p>
                <p className="text-sm text-muted-foreground">Visualizar e exportar fichas</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Atividade recente */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
            Atividade recente
          </h2>
          {atividades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {atividades.map(a => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      a.tipo === 'consulta' ? 'bg-primary/10' : 'bg-secondary/20'
                    }`}
                  >
                    {a.tipo === 'consulta' ? (
                      <FileText className="h-4 w-4 text-primary" />
                    ) : (
                      <Activity className="h-4 w-4 text-secondary-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.descricao}
                    </p>
                    <p className="text-xs text-muted-foreground">{a.profissional_nome}</p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(format(new Date(a.data), 'yyyy-MM-dd')).toLocaleDateString(
                      'pt-BR',
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
