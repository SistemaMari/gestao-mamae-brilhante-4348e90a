import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import StatCard from '@/components/StatCard';
import { Users, Building2, UserPlus, ShieldCheck, Plus, Loader2, Trash2, ShieldOff, Shield, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

type Profissional = {
  id: string;
  user_id: string;
  nome: string;
  crm: string | null;
  especialidade: string | null;
  unidade_id: string | null;
  perfil_institucional: string | null;
  created_at: string;
};
type Unidade = { id: string; nome: string; tipo: string | null; created_at: string };
type Admin = { id: string; user_id: string; nome: string | null; created_at: string };
type GestorGeral = { id: string; user_id: string; nome: string | null; created_at: string };
type UsuarioSistema = {
  user_id: string;
  email: string | null;
  created_at: string;
  nome_profissional: string | null;
  is_admin: boolean;
  is_gestor_geral: boolean;
  is_profissional: boolean;
};

export default function AdminPage() {
  const [stats, setStats] = useState({ profissionais: 0, unidades: 0, convites: 0 });
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [gestoresGerais, setGestoresGerais] = useState<GestorGeral[]>([]);
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);

  const [novaUnidadeOpen, setNovaUnidadeOpen] = useState(false);
  const [novaUnidadeNome, setNovaUnidadeNome] = useState('');
  const [novaUnidadeTipo, setNovaUnidadeTipo] = useState('');

  const [vincularOpen, setVincularOpen] = useState<Profissional | null>(null);
  const [vincularUnidadeId, setVincularUnidadeId] = useState<string>('');
  const [vincularPerfil, setVincularPerfil] = useState<string>('profissional');

  const carregar = useCallback(async () => {
    setLoading(true);
    const [profsRes, unitsRes, convitesRes, adminsRes, gestoresRes] = await Promise.all([
      supabase.from('profissionais').select('id, user_id, nome, crm, especialidade, unidade_id, perfil_institucional, created_at').order('created_at', { ascending: false }),
      supabase.from('unidades').select('id, nome, tipo, created_at').order('created_at', { ascending: false }),
      supabase.from('convites').select('id').eq('status', 'pendente'),
      supabase.from('admins').select('id, user_id, nome, created_at').order('created_at', { ascending: false }),
      supabase.from('gestores_gerais').select('id, user_id, nome, created_at').order('created_at', { ascending: false }),
    ]);
    setProfissionais((profsRes.data ?? []) as Profissional[]);
    setUnidades((unitsRes.data ?? []) as Unidade[]);
    setAdmins((adminsRes.data ?? []) as Admin[]);
    setGestoresGerais((gestoresRes.data ?? []) as GestorGeral[]);
    setStats({
      profissionais: profsRes.data?.length || 0,
      unidades: unitsRes.data?.length || 0,
      convites: convitesRes.data?.length || 0,
    });
    setLoading(false);
  }, []);

  const carregarUsuarios = useCallback(async () => {
    setLoadingUsuarios(true);
    const { data, error } = await supabase.functions.invoke('admin-gerenciar-usuarios', {
      body: { acao: 'listar_usuarios' },
    });
    setLoadingUsuarios(false);
    if (error || (data && data.error)) {
      toast({ title: 'Erro', description: (data?.error || error?.message) ?? 'Falha ao carregar usuários', variant: 'destructive' });
      return;
    }
    setUsuariosSistema((data?.usuarios ?? []) as UsuarioSistema[]);
  }, []);

  useEffect(() => { carregar(); carregarUsuarios(); }, [carregar, carregarUsuarios]);

  const chamarAcao = async (acao: string, alvo_user_id?: string, payload?: Record<string, unknown>) => {
    setAcaoLoading(acao + (alvo_user_id ?? ''));
    const { data, error } = await supabase.functions.invoke('admin-gerenciar-usuarios', {
      body: { acao, alvo_user_id, payload },
    });
    setAcaoLoading(null);
    if (error || (data && data.error)) {
      toast({ title: 'Erro', description: (data?.error || error?.message) ?? 'Falha ao executar ação', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Sucesso', description: 'Ação executada.' });
    await Promise.all([carregar(), carregarUsuarios()]);
    return true;
  };

  const isAdmin = (userId: string) => admins.some((a) => a.user_id === userId);
  const isGestorGeral = (userId: string) => gestoresGerais.some((g) => g.user_id === userId);
  const unidadeNome = (id: string | null) => (id ? (unidades.find((u) => u.id === id)?.nome ?? '—') : '—');

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Painel Administrativo</h1>
              <p className="text-sm text-muted-foreground">Visão geral do sistema MARI DMG Diagnóstica</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="/admin/admins"><Shield className="mr-1 h-4 w-4" /> Gerenciar admins</a>
              </Button>
              <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>
            </div>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Profissionais" value={stats.profissionais} subtitle="cadastrados no sistema" icon={Users} />
            <StatCard title="Unidades" value={stats.unidades} subtitle="instituições ativas" icon={Building2} />
            <StatCard title="Convites pendentes" value={stats.convites} subtitle="aguardando aceite" icon={UserPlus} />
          </div>

          {/* Unidades */}
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Unidades
              </h2>
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href="/admin/unidades">Gerenciar todas</a>
                </Button>
                <Dialog open={novaUnidadeOpen} onOpenChange={setNovaUnidadeOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Nova unidade</Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Criar nova unidade</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Nome da unidade</Label>
                      <Input value={novaUnidadeNome} onChange={(e) => setNovaUnidadeNome(e.target.value)} placeholder="Ex: Clínica Materna SP" />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo (opcional)</Label>
                      <Input value={novaUnidadeTipo} onChange={(e) => setNovaUnidadeTipo(e.target.value)} placeholder="Ex: clinica_privada, hospital, sus" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNovaUnidadeOpen(false)}>Cancelar</Button>
                    <Button
                      disabled={!novaUnidadeNome.trim() || acaoLoading === 'criar_unidade'}
                      onClick={async () => {
                        const ok = await chamarAcao('criar_unidade', undefined, { nome: novaUnidadeNome.trim(), tipo: novaUnidadeTipo.trim() || null });
                        if (ok) {
                          setNovaUnidadeOpen(false);
                          setNovaUnidadeNome('');
                          setNovaUnidadeTipo('');
                        }
                      }}
                    >
                      {acaoLoading === 'criar_unidade' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : unidades.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Criada em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unidades.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell className="text-muted-foreground">{u.tipo ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Usuários do sistema (todos os auth users, mesmo sem profissional) */}
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Usuários do sistema
              </h2>
              <span className="text-xs text-muted-foreground">
                {usuariosSistema.length} {usuariosSistema.length === 1 ? 'usuário' : 'usuários'}
              </span>
            </div>
            {loadingUsuarios ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : usuariosSistema.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Privilégios</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuariosSistema.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="font-medium">{u.email ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">criado em {new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.nome_profissional ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.is_admin && <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>}
                          {u.is_gestor_geral && <Badge variant="secondary">Gestor geral</Badge>}
                          {u.is_profissional && <Badge variant="outline">Profissional</Badge>}
                          {!u.is_admin && !u.is_gestor_geral && !u.is_profissional && (
                            <span className="text-xs text-muted-foreground">sem perfil</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!u.is_admin ? (
                            <Button size="sm" variant="outline"
                              onClick={() => chamarAcao('promover_admin', u.user_id, { nome: u.nome_profissional ?? u.email })}
                              disabled={acaoLoading === 'promover_admin' + u.user_id}>
                              <Shield className="mr-1 h-3 w-3" /> Promover admin
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline"
                              onClick={() => chamarAcao('remover_admin', u.user_id)}
                              disabled={acaoLoading === 'remover_admin' + u.user_id}>
                              <ShieldOff className="mr-1 h-3 w-3" /> Remover admin
                            </Button>
                          )}
                          {!u.is_gestor_geral ? (
                            <Button size="sm" variant="outline"
                              onClick={() => chamarAcao('promover_gestor_geral', u.user_id, { nome: u.nome_profissional ?? u.email })}
                              disabled={acaoLoading === 'promover_gestor_geral' + u.user_id}>
                              Gestor geral
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline"
                              onClick={() => chamarAcao('remover_gestor_geral', u.user_id)}
                              disabled={acaoLoading === 'remover_gestor_geral' + u.user_id}>
                              <Trash2 className="mr-1 h-3 w-3" /> Tirar gestor geral
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Profissionais */}
          <div className="mb-6 rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Gestão de profissionais
            </h2>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : profissionais.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum profissional cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Privilégios</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profissionais.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">{p.crm ?? 'sem CRM'} · {p.especialidade ?? 'sem especialidade'}</div>
                      </TableCell>
                      <TableCell className="text-sm">{unidadeNome(p.unidade_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.unidade_id
                          ? (p.perfil_institucional === 'gestor' ? 'Gestor de unidade' : 'Profissional institucional')
                          : 'Consultório'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isAdmin(p.user_id) && <Badge className="bg-primary/10 text-primary border-primary/20">Admin</Badge>}
                          {isGestorGeral(p.user_id) && <Badge variant="secondary">Gestor geral</Badge>}
                          {!isAdmin(p.user_id) && !isGestorGeral(p.user_id) && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {!isAdmin(p.user_id) ? (
                            <Button size="sm" variant="outline" onClick={() => chamarAcao('promover_admin', p.user_id, { nome: p.nome })} disabled={acaoLoading === 'promover_admin' + p.user_id}>
                              <Shield className="mr-1 h-3 w-3" /> Promover admin
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => chamarAcao('remover_admin', p.user_id)} disabled={acaoLoading === 'remover_admin' + p.user_id}>
                              <ShieldOff className="mr-1 h-3 w-3" /> Remover admin
                            </Button>
                          )}
                          {!isGestorGeral(p.user_id) ? (
                            <Button size="sm" variant="outline" onClick={() => chamarAcao('promover_gestor_geral', p.user_id, { nome: p.nome })} disabled={acaoLoading === 'promover_gestor_geral' + p.user_id}>
                              Gestor geral
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => chamarAcao('remover_gestor_geral', p.user_id)} disabled={acaoLoading === 'remover_gestor_geral' + p.user_id}>
                              <Trash2 className="mr-1 h-3 w-3" /> Tirar gestor geral
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => {
                            setVincularOpen(p);
                            setVincularUnidadeId(p.unidade_id ?? '');
                            setVincularPerfil(p.perfil_institucional ?? 'profissional');
                          }}>
                            <Building2 className="mr-1 h-3 w-3" /> Vincular unidade
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Admins ativos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Administradores
              </h2>
              {admins.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">Nenhum admin</p>
              ) : (
                <ul className="space-y-2">
                  {admins.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="font-medium">{a.nome ?? a.user_id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString('pt-BR')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 font-heading text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Gestores gerais
              </h2>
              {gestoresGerais.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">Nenhum gestor geral</p>
              ) : (
                <ul className="space-y-2">
                  {gestoresGerais.map((g) => (
                    <li key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                      <span className="font-medium">{g.nome ?? g.user_id.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString('pt-BR')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Dialog vincular unidade */}
        <Dialog open={!!vincularOpen} onOpenChange={(open) => !open && setVincularOpen(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Vincular {vincularOpen?.nome} a unidade</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={vincularUnidadeId || 'none'} onValueChange={(v) => setVincularUnidadeId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma (consultório)</SelectItem>
                    {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {vincularUnidadeId && (
                <div className="space-y-2">
                  <Label>Perfil na unidade</Label>
                  <Select value={vincularPerfil} onValueChange={setVincularPerfil}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profissional">Profissional</SelectItem>
                      <SelectItem value="gestor">Gestor da unidade</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setVincularOpen(null)}>Cancelar</Button>
              <Button
                disabled={acaoLoading === 'vincular_unidade' + (vincularOpen?.user_id ?? '')}
                onClick={async () => {
                  if (!vincularOpen) return;
                  const ok = await chamarAcao('vincular_unidade', vincularOpen.user_id, {
                    unidade_id: vincularUnidadeId || null,
                    perfil_institucional: vincularUnidadeId ? vincularPerfil : null,
                  });
                  if (ok) setVincularOpen(null);
                }}
              >
                {acaoLoading?.startsWith('vincular_unidade') ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
