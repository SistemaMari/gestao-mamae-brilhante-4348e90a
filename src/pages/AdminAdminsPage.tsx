import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import { Shield, ShieldOff, Loader2, Search, UserPlus, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type AdminRow = {
  id: string;
  user_id: string;
  nome: string | null;
  created_at: string;
  email?: string | null;
};

export default function AdminAdminsPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);

  const [novoAdminOpen, setNovoAdminOpen] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');

  const [confirmRemover, setConfirmRemover] = useState<AdminRow | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: adminsData, error } = await supabase
      .from('admins')
      .select('id, user_id, nome, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Buscar emails via edge function (listar_usuarios)
    const { data: usuariosRes } = await supabase.functions.invoke('admin-gerenciar-usuarios', {
      body: { acao: 'listar_usuarios' },
    });
    const emailMap = new Map<string, string | null>();
    if (usuariosRes?.usuarios) {
      for (const u of usuariosRes.usuarios) emailMap.set(u.user_id, u.email ?? null);
    }

    const enriquecidos: AdminRow[] = (adminsData ?? []).map((a) => ({
      ...a,
      email: emailMap.get(a.user_id) ?? null,
    }));
    setAdmins(enriquecidos);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const adminsFiltrados = useMemo(() => {
    if (!busca.trim()) return admins;
    const q = busca.toLowerCase();
    return admins.filter((a) =>
      (a.nome ?? '').toLowerCase().includes(q) ||
      (a.email ?? '').toLowerCase().includes(q)
    );
  }, [admins, busca]);

  const promoverPorEmail = async () => {
    const email = novoEmail.trim().toLowerCase();
    if (!email) return;
    setAcaoLoading('promover');
    const { data, error } = await supabase.functions.invoke('admin-gerenciar-usuarios', {
      body: { acao: 'promover_admin_por_email', payload: { email } },
    });
    setAcaoLoading(null);
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error ?? error?.message ?? 'Falha', variant: 'destructive' });
      return;
    }
    toast({ title: 'Admin promovido', description: `${email} agora é administrador.` });
    setNovoAdminOpen(false);
    setNovoEmail('');
    await carregar();
  };

  const removerAdmin = async (alvo: AdminRow) => {
    setAcaoLoading('remover' + alvo.user_id);
    const { data, error } = await supabase.functions.invoke('admin-gerenciar-usuarios', {
      body: { acao: 'remover_admin', alvo_user_id: alvo.user_id },
    });
    setAcaoLoading(null);
    setConfirmRemover(null);
    if (error || data?.error) {
      toast({ title: 'Erro', description: data?.error ?? error?.message ?? 'Falha', variant: 'destructive' });
      return;
    }
    toast({ title: 'Admin removido' });
    await carregar();
  };

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10 max-w-6xl">
          <div className="mb-6 flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <a href="/admin"><ArrowLeft className="mr-1 h-4 w-4" /> Painel</a>
            </Button>
          </div>

          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Administradores</h1>
              <p className="text-sm text-muted-foreground">Gerencie quem tem acesso de administrador no sistema</p>
            </div>
            <Badge className="ml-auto bg-primary/10 text-primary border-primary/20">
              {admins.length} {admins.length === 1 ? 'admin' : 'admins'}
            </Badge>
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome ou e-mail…"
                className="pl-9"
              />
            </div>

            <Dialog open={novoAdminOpen} onOpenChange={setNovoAdminOpen}>
              <DialogTrigger asChild>
                <Button><UserPlus className="mr-2 h-4 w-4" /> Promover admin</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Promover novo administrador</DialogTitle>
                  <DialogDescription>
                    Informe o e-mail de um usuário já cadastrado no sistema. Ele receberá acesso total ao painel administrativo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNovoAdminOpen(false)}>Cancelar</Button>
                  <Button disabled={!novoEmail.trim() || acaoLoading === 'promover'} onClick={promoverPorEmail}>
                    {acaoLoading === 'promover' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Promover'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : adminsFiltrados.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {busca ? 'Nenhum admin encontrado para a busca' : 'Nenhum administrador cadastrado'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Promovido em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminsFiltrados.map((a) => {
                    const isMe = a.user_id === user?.id;
                    const isLast = admins.length <= 1;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {a.nome ?? '—'}
                          {isMe && <Badge variant="outline" className="ml-2">Você</Badge>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.email ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isMe || isLast || acaoLoading === 'remover' + a.user_id}
                            title={
                              isMe ? 'Você não pode remover seu próprio acesso'
                                : isLast ? 'Não é possível remover o último admin'
                                : 'Remover admin'
                            }
                            onClick={() => setConfirmRemover(a)}
                          >
                            {acaoLoading === 'remover' + a.user_id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><ShieldOff className="mr-1 h-3 w-3" /> Remover</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              Administradores têm acesso total ao sistema: gestão de unidades, usuários, base de conhecimento e relatórios consolidados.
              O sistema sempre mantém pelo menos 1 admin ativo.
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={!!confirmRemover} onOpenChange={(o) => !o && setConfirmRemover(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemover?.nome ?? confirmRemover?.email} perderá imediatamente o acesso ao painel administrativo.
              Esta ação pode ser revertida promovendo o usuário novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemover && removerAdmin(confirmRemover)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
