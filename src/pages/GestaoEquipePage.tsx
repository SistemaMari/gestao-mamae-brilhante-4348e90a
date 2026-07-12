import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, Plus, RefreshCw, Trash2, Loader2, Users, Info, UserPlus, MailWarning, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CardResumoEquipe from '@/components/gestao/CardResumoEquipe';
import ComposicaoClinica, { type ProfissionalEquipe } from '@/components/gestao/ComposicaoClinica';
import PerformanceIndividual, { type ProfPerformance } from '@/components/gestao/PerformanceIndividual';
import IndicadoresFluxo, { type Sobrecarregado } from '@/components/gestao/IndicadoresFluxo';
import type { PainelOperacao } from '@/lib/painelEstrategicoTypes';

interface Membro {
  id: string;
  nome: string;
  crm: string | null;
  especialidade: string | null;
  email?: string;
  created_at: string;
  tipo: 'ativo' | 'pendente' | 'expirado';
  convite_id?: string;
  email_convidado?: string;
}

export default function GestaoEquipePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [unidadeId, setUnidadeId] = useState<string | null>(null);
  const [_profissionalId, setProfissionalId] = useState<string | null>(null);

  // Modal de convite
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showResendOption, setShowResendOption] = useState(false);
  const [unidadeNome, setUnidadeNome] = useState<string>('');

  // Modal de remoção
  const [removeTarget, setRemoveTarget] = useState<Membro | null>(null);
  const [removing, setRemoving] = useState(false);

  // Bloco 1 — cards de resumo
  const [totalAtivos, setTotalAtivos] = useState<number | null>(null);
  const [totalPendentes, setTotalPendentes] = useState<number | null>(null);
  const [totalExpirados, setTotalExpirados] = useState<number | null>(null);
  const [totalLaudos, setTotalLaudos] = useState<number | null>(null);
  const [errosCards, setErrosCards] = useState({ ativos: false, pendentes: false, expirados: false, laudos: false });

  // Bloco 2 — composição
  const [profissionaisEquipe, setProfissionaisEquipe] = useState<ProfissionalEquipe[]>([]);
  const [erroComposicao, setErroComposicao] = useState(false);

  // Bloco 3 — performance
  const [performance, setPerformance] = useState<ProfPerformance[]>([]);
  const [erroPerformance, setErroPerformance] = useState(false);

  // Bloco 4 — indicadores de fluxo
  const [tempoMedioDias, setTempoMedioDias] = useState<number | null>(null);
  const [sobrecarregados, setSobrecarregados] = useState<Sobrecarregado[]>([]);
  const [erroTempo, setErroTempo] = useState(false);
  const [erroSobrecarga, setErroSobrecarga] = useState(false);

  const fetchEquipe = async () => {
    if (!user) return;
    setLoading(true);

    const { data: prof } = await supabase
      .from('profissionais')
      .select('id, unidade_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!prof?.unidade_id) {
      setLoading(false);
      return;
    }

    setUnidadeId(prof.unidade_id);
    setProfissionalId(prof.id);

    const { data: unidade } = await supabase
      .from('unidades')
      .select('nome')
      .eq('id', prof.unidade_id)
      .maybeSingle();
    setUnidadeNome(unidade?.nome || '');

    // Equipe (via view segura)
    const profRes = await supabase
      .from('equipe_unidade_view' as any)
      .select('id, nome, crm, especialidade, perfil_clinico, created_at')
      .eq('unidade_id', prof.unidade_id);
    const profissionais = ((profRes.data ?? []) as unknown) as Array<{
      id: string; nome: string; crm: string | null; especialidade: string | null;
      perfil_clinico: string | null; created_at: string;
    }>;

    const ativos: Membro[] = (profissionais || [])
      .filter(p => p.id !== prof.id)
      .map(p => ({
        id: p.id, nome: p.nome, crm: p.crm, especialidade: p.especialidade,
        created_at: p.created_at, tipo: 'ativo' as const,
      }));

    const { data: convites } = await supabase
      .from('convites')
      .select('id, email_convidado, status, created_at, expires_at')
      .eq('unidade_id', prof.unidade_id)
      .in('status', ['pendente']);

    const conviteMembros: Membro[] = (convites || []).map(c => ({
      id: c.id,
      nome: c.email_convidado,
      crm: null,
      especialidade: null,
      email_convidado: c.email_convidado,
      created_at: c.created_at,
      convite_id: c.id,
      tipo: new Date(c.expires_at) < new Date() ? 'expirado' as const : 'pendente' as const,
    }));

    setMembros([...ativos, ...conviteMembros]);
    setProfissionaisEquipe(
      (profissionais || []).map(p => ({
        id: p.id, nome: p.nome, especialidade: p.especialidade, perfil_clinico: p.perfil_clinico,
      }))
    );

    // Card 1
    try { setTotalAtivos(profissionais.length); }
    catch (e) { console.error(e); setErrosCards(p => ({ ...p, ativos: true })); }

    // Cards 2/3
    try {
      const agora = new Date();
      const pend = (convites || []).filter(c => c.status === 'pendente' && new Date(c.expires_at) > agora).length;
      const exp = (convites || []).filter(c => c.status === 'pendente' && new Date(c.expires_at) <= agora).length;
      setTotalPendentes(pend); setTotalExpirados(exp);
    } catch (e) { console.error(e); setErrosCards(p => ({ ...p, pendentes: true, expirados: true })); }

    // Card 4 + Bloco 3 (laudos por prof) + Bloco 4 esquerdo (tempo médio)
    let laudosDaUnidade: Array<{ profissional_id: string; paciente_id: string; created_at: string }> = [];
    try {
      const { data, error } = await supabase
        .from('laudos')
        .select('profissional_id, paciente_id, created_at, pacientes!inner(unidade_id)')
        .eq('pacientes.unidade_id', prof.unidade_id);
      if (error) throw error;
      laudosDaUnidade = (data || []) as any;
      setTotalLaudos(laudosDaUnidade.length);
    } catch (e) {
      console.error('[card laudos]', e);
      setErrosCards(p => ({ ...p, laudos: true }));
      setErroPerformance(true);
      setErroTempo(true);
    }

    // RPC operação (distribuição de pacientes ativas)
    let distribuicao: PainelOperacao['distribuicao_profissionais'] = [];
    try {
      const opRes = await supabase.rpc('get_painel_operacao', { p_unidade_id: prof.unidade_id });
      if (!opRes.error && opRes.data) {
        const op = opRes.data as unknown as PainelOperacao;
        distribuicao = op.distribuicao_profissionais || [];
      }
    } catch (e) {
      console.error('[op]', e);
      setErroSobrecarga(true);
    }

    // Bloco 3 — performance
    try {
      const laudosPorProf = new Map<string, number>();
      laudosDaUnidade.forEach(l => {
        laudosPorProf.set(l.profissional_id, (laudosPorProf.get(l.profissional_id) || 0) + 1);
      });
      const pacPorProf = new Map<string, number>();
      distribuicao.forEach(d => pacPorProf.set(d.profissional_id, d.total_pacientes_ativos));
      const perf: ProfPerformance[] = (profissionais || []).map(p => ({
        id: p.id,
        nome: p.nome,
        crm: p.crm,
        laudos: laudosPorProf.get(p.id) || 0,
        pacientes: pacPorProf.get(p.id) || 0,
      }));
      setPerformance(perf);
    } catch (e) { console.error('[performance]', e); setErroPerformance(true); }

    // Bloco 4 esquerdo — tempo médio até 1º laudo (filtro: 1º laudo nos últimos 90 dias)
    try {
      // primeiro laudo por paciente
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
        setTempoMedioDias(null);
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
        if (deltas.length === 0) setTempoMedioDias(null);
        else setTempoMedioDias(deltas.reduce((a, b) => a + b, 0) / deltas.length);
      }
    } catch (e) { console.error('[tempo medio]', e); setErroTempo(true); }

    // Bloco 4 direito — sobrecarga
    try {
      const ativosDist = distribuicao.filter(d => d.total_pacientes_ativos > 0);
      if (ativosDist.length === 0) {
        setSobrecarregados([]);
      } else {
        const media = ativosDist.reduce((s, d) => s + d.total_pacientes_ativos, 0) / ativosDist.length;
        const sob = ativosDist
          .filter(d => d.total_pacientes_ativos > 2 * media)
          .map(d => ({ nome: d.nome, pacientes: d.total_pacientes_ativos }));
        setSobrecarregados(sob);
      }
    } catch (e) { console.error('[sobrecarga]', e); setErroSobrecarga(true); }

    setLoading(false);
  };

  useEffect(() => { fetchEquipe(); }, [user]);

  const STATUS_MENSAGENS: Record<string, string> = {
    ja_vinculado: t('gestaoEquipe.status.jaVinculado'),
    email_em_uso_admin: t('gestaoEquipe.status.emailEmUsoAdmin'),
    email_em_uso_gestor_unidade: t('gestaoEquipe.status.emailEmUsoGestorUnidade'),
    email_em_uso_gestor_geral: t('gestaoEquipe.status.emailEmUsoGestorGeral'),
    email_em_uso_outra_unidade: t('gestaoEquipe.status.emailEmUsoOutraUnidade'),
    email_em_uso_consultorio: t('gestaoEquipe.status.emailEmUsoConsultorio'),
    email_em_uso_outro: t('gestaoEquipe.status.emailEmUsoOutro'),
  };

  const handleEnviarConvite = async () => {
    if (!inviteEmail || !unidadeId || !user) return;
    setInviteError(null);
    setShowResendOption(false);
    setSendingInvite(true);

    try {
      const res = await supabase.functions.invoke('enviar-convite', {
        body: { unidade_id: unidadeId, email_convidado: inviteEmail },
      });

      const data = res.data;
      const status = data?.status;

      if (status === 'enviado') {
        toast.success(t('gestaoEquipe.toast.conviteEnviado', { email: inviteEmail }));
        setShowInviteModal(false);
        setInviteEmail('');
        fetchEquipe();
      } else if (status === 'convite_pendente') {
        setInviteError(t('gestaoEquipe.status.convitePendenteReenviar'));
        setShowResendOption(true);
      } else if (status && STATUS_MENSAGENS[status]) {
        setInviteError(STATUS_MENSAGENS[status]);
      } else {
        setInviteError(data?.mensagem || t('gestaoEquipe.toast.erroEnviarConvite'));
      }
    } catch {
      setInviteError(t('gestaoEquipe.toast.erroEnviarConvite'));
    }

    setSendingInvite(false);
  };

  const handleReenviar = async (email: string) => {
    if (!unidadeId || !user) return;
    try {
      const res = await supabase.functions.invoke('enviar-convite', {
        body: { unidade_id: unidadeId, email_convidado: email, convidado_por: user.id },
      });
      if (res.data?.status === 'convite_pendente') {
        await supabase
          .from('convites')
          .update({ status: 'expirado' } as any)
          .eq('email_convidado', email)
          .eq('unidade_id', unidadeId)
          .eq('status', 'pendente');
        const res2 = await supabase.functions.invoke('enviar-convite', {
          body: { unidade_id: unidadeId, email_convidado: email, convidado_por: user.id },
        });
        if (res2.data?.status === 'enviado') {
          toast.success(t('gestaoEquipe.toast.conviteReenviado', { email }));
          fetchEquipe();
        }
      } else if (res.data?.status === 'enviado') {
        toast.success(t('gestaoEquipe.toast.conviteReenviado', { email }));
        fetchEquipe();
      }
    } catch {
      toast.error(t('gestaoEquipe.toast.erroReenviarConvite'));
    }
  };

  const handleRemover = async () => {
    if (!removeTarget || !unidadeId || !user) return;
    setRemoving(true);
    try {
      const res = await supabase.functions.invoke('remover-profissional', {
        body: { profissional_id: removeTarget.id, unidade_id: unidadeId, gestor_id: user.id },
      });
      if (res.data?.status === 'removido') {
        toast.success(res.data.mensagem);
        setRemoveTarget(null);
        fetchEquipe();
      } else {
        toast.error(res.data?.mensagem || t('gestaoEquipe.toast.erroRemoverProfissional'));
      }
    } catch {
      toast.error(t('gestaoEquipe.toast.erroRemoverProfissional'));
    }
    setRemoving(false);
  };

  const getStatusBadge = (tipo: Membro['tipo']) => {
    switch (tipo) {
      case 'ativo':
        return <Badge className="bg-secondary/20 text-secondary border-secondary/30">{t('gestaoEquipe.badge.ativo')}</Badge>;
      case 'pendente':
        return <Badge variant="outline" className="border-amber-400/50 text-amber-600">{t('gestaoEquipe.badge.convitePendente')}</Badge>;
      case 'expirado':
        return <Badge variant="outline" className="border-destructive/50 text-destructive">{t('gestaoEquipe.badge.conviteExpirado')}</Badge>;
    }
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/gestao')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {t('gestaoEquipe.title')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('gestaoEquipe.subtitle')}</p>
            </div>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="h-4 w-4" />
            {t('gestaoEquipe.inviteProfessional')}
          </Button>
        </div>

        {/* Bloco 1 — cards de resumo */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CardResumoEquipe
            titulo={t('gestaoEquipe.cards.ativos.titulo')}
            valor={totalAtivos}
            sublabel={t('gestaoEquipe.cards.ativos.sublabel')}
            tooltip={t('gestaoEquipe.cards.ativos.tooltip')}
            icon={Users}
            loading={loading}
            erro={errosCards.ativos}
          />
          <CardResumoEquipe
            titulo={t('gestaoEquipe.cards.pendentes.titulo')}
            valor={totalPendentes}
            sublabel={t('gestaoEquipe.cards.pendentes.sublabel')}
            tooltip={t('gestaoEquipe.cards.pendentes.tooltip')}
            icon={UserPlus}
            loading={loading}
            erro={errosCards.pendentes}
          />
          <CardResumoEquipe
            titulo={t('gestaoEquipe.cards.expirados.titulo')}
            valor={totalExpirados}
            sublabel={t('gestaoEquipe.cards.expirados.sublabel')}
            tooltip={t('gestaoEquipe.cards.expirados.tooltip')}
            icon={MailWarning}
            loading={loading}
            erro={errosCards.expirados}
          />
          <CardResumoEquipe
            titulo={t('gestaoEquipe.cards.laudos.titulo')}
            valor={totalLaudos}
            sublabel={t('gestaoEquipe.cards.laudos.sublabel')}
            tooltip={t('gestaoEquipe.cards.laudos.tooltip')}
            icon={FileCheck}
            loading={loading}
            erro={errosCards.laudos}
          />
        </div>

        {/* Bloco 2 — composição clínica */}
        <div className="mb-4">
          <ComposicaoClinica
            profissionais={profissionaisEquipe}
            loading={loading}
            erro={erroComposicao}
          />
        </div>

        {/* Bloco 3 — performance individual */}
        <div className="mb-4">
          <PerformanceIndividual
            profissionais={performance}
            loading={loading}
            erro={erroPerformance}
          />
        </div>

        {/* Bloco 4 — indicadores de fluxo */}
        <div className="mb-8">
          <IndicadoresFluxo
            tempoMedioDias={tempoMedioDias}
            sobrecarregados={sobrecarregados}
            loading={loading}
            erroTempo={erroTempo}
            erroSobrecarga={erroSobrecarga}
          />
        </div>

        {/* Tabela — rodapé */}
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">{t('gestaoEquipe.teamTable.heading')}</h2>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : membros.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-foreground">{t('gestaoEquipe.empty.title')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('gestaoEquipe.empty.description')}
            </p>
            <Button className="mt-6" onClick={() => setShowInviteModal(true)}>
              <Plus className="h-4 w-4" />
              {t('gestaoEquipe.inviteProfessional')}
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('gestaoEquipe.teamTable.colNameEmail')}</TableHead>
                  <TableHead>{t('gestaoEquipe.teamTable.colCrm')}</TableHead>
                  <TableHead>{t('gestaoEquipe.teamTable.colSpecialty')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('gestaoEquipe.teamTable.colJoinDate')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membros.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell>{m.crm || '—'}</TableCell>
                    <TableCell>{m.especialidade || '—'}</TableCell>
                    <TableCell>{getStatusBadge(m.tipo)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString(i18n.language)}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.tipo === 'ativo' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRemoveTarget(m)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {m.tipo === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReenviar(m.email_convidado!)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          {t('gestaoEquipe.actions.resend')}
                        </Button>
                      )}
                      {m.tipo === 'expirado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReenviar(m.email_convidado!)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          {t('gestaoEquipe.actions.newInvite')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal de Convite */}
      <Dialog
        open={showInviteModal}
        onOpenChange={(open) => {
          setShowInviteModal(open);
          if (!open) {
            setInviteEmail('');
            setInviteError(null);
            setShowResendOption(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px] rounded-[12px]">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {unidadeNome
                ? t('gestaoEquipe.inviteModal.titleWithUnit', { unidade: unidadeNome })
                : t('gestaoEquipe.inviteModal.title')}
            </DialogTitle>
            <DialogDescription>
              {t('gestaoEquipe.inviteModal.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="invite-email">{t('gestaoEquipe.inviteModal.emailLabel')}</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder={t('gestaoEquipe.inviteModal.emailPlaceholder')}
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value);
                  setInviteError(null);
                  setShowResendOption(false);
                }}
              />
            </div>

            <div
              className="flex items-start gap-2 rounded-md p-3 text-xs leading-relaxed"
              style={{ backgroundColor: '#F5F3FA', color: '#4B3F66' }}
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#7C4DBA' }} />
              <span>
                {t('gestaoEquipe.inviteModal.uniqueEmailInfo')}
              </span>
            </div>

            {inviteError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <p>{inviteError}</p>
                {showResendOption && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={async () => {
                      setInviteError(null);
                      setShowResendOption(false);
                      await handleReenviar(inviteEmail);
                      setShowInviteModal(false);
                      setInviteEmail('');
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {t('gestaoEquipe.actions.resend')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleEnviarConvite} disabled={!inviteEmail || sendingInvite}>
              {sendingInvite && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('gestaoEquipe.inviteModal.sendInvite')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gestaoEquipe.removeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gestaoEquipe.removeDialog.descBefore')} <strong>{removeTarget?.nome}</strong> {t('gestaoEquipe.removeDialog.descAfter')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemover}
              disabled={removing}
            >
              {removing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('gestaoEquipe.removeDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
