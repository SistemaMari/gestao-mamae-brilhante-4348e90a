import { useState, useEffect } from 'react';
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
import { ArrowLeft, Plus, RefreshCw, Trash2, Loader2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  // Modal de remoção
  const [removeTarget, setRemoveTarget] = useState<Membro | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchEquipe = async () => {
    if (!user) return;
    setLoading(true);

    // Get gestor's unit
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

    // Get active members
    const { data: profissionais } = await supabase
      .from('profissionais')
      .select('id, nome, crm, especialidade, created_at')
      .eq('unidade_id', prof.unidade_id);

    const ativos: Membro[] = (profissionais || [])
      .filter(p => p.id !== prof.id) // exclude self
      .map(p => ({
        ...p,
        tipo: 'ativo' as const,
      }));

    // Get pending/expired invites
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
    setLoading(false);
  };

  useEffect(() => { fetchEquipe(); }, [user]);

  const handleEnviarConvite = async () => {
    if (!inviteEmail || !unidadeId || !user) return;
    setSendingInvite(true);

    try {
      const res = await supabase.functions.invoke('enviar-convite', {
        body: { unidade_id: unidadeId, email_convidado: inviteEmail, convidado_por: user.id },
      });

      const data = res.data;

      if (data?.status === 'enviado') {
        toast.success(`Convite enviado para ${inviteEmail}!`);
        setShowInviteModal(false);
        setInviteEmail('');
        fetchEquipe();
      } else if (data?.status === 'ja_vinculado') {
        toast.error('Este profissional já faz parte da unidade.');
      } else if (data?.status === 'convite_pendente') {
        toast.warning('Já existe um convite pendente para este e-mail. Deseja reenviar?', {
          action: {
            label: 'Reenviar',
            onClick: () => handleReenviar(inviteEmail),
          },
        });
      } else {
        toast.error(data?.mensagem || 'Erro ao enviar convite.');
      }
    } catch {
      toast.error('Erro ao enviar convite.');
    }

    setSendingInvite(false);
  };

  const handleReenviar = async (email: string) => {
    if (!unidadeId || !user) return;

    // Expire old invite and send new one
    try {
      const res = await supabase.functions.invoke('enviar-convite', {
        body: { unidade_id: unidadeId, email_convidado: email, convidado_por: user.id },
      });

      // If pending, we force resend by expiring old one first
      // For now, the edge function handles this — just mark old as expired and create new
      if (res.data?.status === 'convite_pendente') {
        // Mark old invite as expired
        await supabase
          .from('convites')
          .update({ status: 'expirado' } as any)
          .eq('email_convidado', email)
          .eq('unidade_id', unidadeId)
          .eq('status', 'pendente');

        // Retry
        const res2 = await supabase.functions.invoke('enviar-convite', {
          body: { unidade_id: unidadeId, email_convidado: email, convidado_por: user.id },
        });

        if (res2.data?.status === 'enviado') {
          toast.success(`Convite reenviado para ${email}!`);
          fetchEquipe();
        }
      } else if (res.data?.status === 'enviado') {
        toast.success(`Convite reenviado para ${email}!`);
        fetchEquipe();
      }
    } catch {
      toast.error('Erro ao reenviar convite.');
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
        toast.error(res.data?.mensagem || 'Erro ao remover profissional.');
      }
    } catch {
      toast.error('Erro ao remover profissional.');
    }

    setRemoving(false);
  };

  const getStatusBadge = (tipo: Membro['tipo']) => {
    switch (tipo) {
      case 'ativo':
        return <Badge className="bg-secondary/20 text-secondary border-secondary/30">Ativo</Badge>;
      case 'pendente':
        return <Badge variant="outline" className="border-amber-400/50 text-amber-600">Convite pendente</Badge>;
      case 'expirado':
        return <Badge variant="outline" className="border-destructive/50 text-destructive">Convite expirado</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
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
                Gerenciar Equipe
              </h1>
              <p className="text-sm text-muted-foreground">Gerencie os profissionais da sua unidade</p>
            </div>
          </div>
          <Button onClick={() => setShowInviteModal(true)}>
            <Plus className="h-4 w-4" />
            Convidar profissional
          </Button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : membros.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-lg font-medium text-foreground">Nenhum profissional na equipe</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Convide profissionais para começarem a trabalhar na sua unidade.
            </p>
            <Button className="mt-6" onClick={() => setShowInviteModal(true)}>
              <Plus className="h-4 w-4" />
              Convidar profissional
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / E-mail</TableHead>
                  <TableHead>CRM/COREN</TableHead>
                  <TableHead>Especialidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de adesão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
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
                      {new Date(m.created_at).toLocaleDateString('pt-BR')}
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
                          Reenviar
                        </Button>
                      )}
                      {m.tipo === 'expirado' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReenviar(m.email_convidado!)}
                        >
                          <RefreshCw className="h-4 w-4" />
                          Novo convite
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
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar profissional</DialogTitle>
            <DialogDescription>
              Informe o e-mail do profissional para enviar o convite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="invite-email">E-mail do profissional</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="profissional@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEnviarConvite} disabled={!inviteEmail || sendingInvite}>
              {sendingInvite && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Remoção */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover profissional</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{removeTarget?.nome}</strong> da unidade?
              As fichas criadas por ele permanecem acessíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemover}
              disabled={removing}
            >
              {removing && <Loader2 className="h-4 w-4 animate-spin" />}
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
