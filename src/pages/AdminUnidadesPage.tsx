import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import AppSidebar from '@/components/AppSidebar';
import {
  ArrowLeft, Building2, Plus, Pencil, Search, Loader2, Power, PowerOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

interface Unidade {
  id: string;
  nome: string;
  tipo: string | null;
  cnes: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  ativa: boolean;
  plano_status: string;
  plano_expira_em: string | null;
  created_at: string;
}

const TIPO_OPTIONS = [
  { value: 'clinica_privada', label: 'Clínica privada' },
  { value: 'consultorio', label: 'Consultório' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'sus', label: 'Unidade SUS / pública' },
  { value: 'maternidade', label: 'Maternidade' },
  { value: 'outro', label: 'Outro' },
];

const unidadeSchema = z.object({
  nome: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  tipo: z.string().trim().max(40).nullable(),
  cnes: z.string().trim().regex(/^[0-9]{0,7}$/, 'CNES deve ter até 7 dígitos').nullable(),
  pais: z.string().trim().max(60).nullable(),
  estado: z.string().trim().max(40).nullable(),
  cidade: z.string().trim().max(80).nullable(),
  plano_status: z.enum(['ativo', 'suspenso', 'expirado', 'trial']),
  plano_expira_em: z.string().nullable(),
});

const empty: Omit<Unidade, 'id' | 'created_at' | 'ativa'> = {
  nome: '', tipo: null, cnes: null, pais: 'Brasil', estado: null, cidade: null,
  plano_status: 'ativo', plano_expira_em: null,
};

export default function AdminUnidadesPage() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroAtiva, setFiltroAtiva] = useState<'todas' | 'ativas' | 'inativas'>('todas');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('unidades')
      .select('id, nome, tipo, cnes, pais, estado, cidade, ativa, plano_status, plano_expira_em, created_at')
      .order('nome', { ascending: true });
    if (error) {
      toast.error('Falha ao carregar unidades');
      setUnidades([]);
    } else {
      setUnidades((data ?? []) as Unidade[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return unidades.filter((u) => {
      if (filtroAtiva === 'ativas' && !u.ativa) return false;
      if (filtroAtiva === 'inativas' && u.ativa) return false;
      if (!q) return true;
      return [u.nome, u.cidade, u.estado, u.cnes].some((v) => v?.toLowerCase().includes(q));
    });
  }, [unidades, busca, filtroAtiva]);

  function openNova() {
    setEditing(null);
    setForm({ ...empty });
    setDialogOpen(true);
  }

  function openEditar(u: Unidade) {
    setEditing(u);
    setForm({
      nome: u.nome,
      tipo: u.tipo,
      cnes: u.cnes,
      pais: u.pais ?? 'Brasil',
      estado: u.estado,
      cidade: u.cidade,
      plano_status: u.plano_status as any,
      plano_expira_em: u.plano_expira_em,
    });
    setDialogOpen(true);
  }

  async function salvar() {
    const parsed = unidadeSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? 'Dados inválidos');
      return;
    }
    setSaving(true);
    const payload = {
      ...parsed.data,
      cnes: parsed.data.cnes || null,
      tipo: parsed.data.tipo || null,
      estado: parsed.data.estado || null,
      cidade: parsed.data.cidade || null,
      plano_expira_em: parsed.data.plano_expira_em || null,
    };
    const { error } = editing
      ? await supabase.from('unidades').update(payload as any).eq('id', editing.id)
      : await supabase.from('unidades').insert(payload as any);
    setSaving(false);

    if (error) {
      toast.error(error.message || 'Falha ao salvar unidade');
      return;
    }
    toast.success(editing ? 'Unidade atualizada' : 'Unidade criada');
    setDialogOpen(false);
    carregar();
  }

  async function toggleAtiva(u: Unidade) {
    const { error } = await supabase
      .from('unidades')
      .update({ ativa: !u.ativa })
      .eq('id', u.id);
    if (error) {
      toast.error('Falha ao alterar status');
      return;
    }
    toast.success(u.ativa ? 'Unidade desativada' : 'Unidade reativada');
    carregar();
  }

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-6 py-8 lg:px-10">
          <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Painel administrativo
          </Link>

          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold text-foreground">Gestão de Unidades</h1>
                <p className="text-sm text-muted-foreground">
                  Cadastre e gerencie hospitais, clínicas e consultórios.
                </p>
              </div>
            </div>
            <Button onClick={openNova}>
              <Plus className="mr-2 h-4 w-4" /> Nova unidade
            </Button>
          </div>

          {/* Filtros */}
          <section className="mb-4 grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cidade, estado ou CNES..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroAtiva} onValueChange={(v: any) => setFiltroAtiva(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="ativas">Apenas ativas</SelectItem>
                <SelectItem value="inativas">Apenas inativas</SelectItem>
              </SelectContent>
            </Select>
          </section>

          {/* Tabela */}
          <section className="rounded-xl border border-border bg-card">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : filtradas.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {unidades.length === 0 ? 'Nenhuma unidade cadastrada.' : 'Nenhum resultado para os filtros.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-[140px]">Tipo</TableHead>
                    <TableHead className="w-[140px]">Localização</TableHead>
                    <TableHead className="w-[100px]">CNES</TableHead>
                    <TableHead className="w-[100px]">Plano</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[140px] text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((u) => {
                    const tipoLabel = TIPO_OPTIONS.find((t) => t.value === u.tipo)?.label ?? (u.tipo ?? '—');
                    const local = [u.cidade, u.estado].filter(Boolean).join(' / ') || '—';
                    return (
                      <TableRow key={u.id} className={u.ativa ? '' : 'opacity-60'}>
                        <TableCell className="font-medium">{u.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{tipoLabel}</TableCell>
                        <TableCell className="text-muted-foreground">{local}</TableCell>
                        <TableCell className="text-muted-foreground">{u.cnes ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={u.plano_status === 'ativo' ? 'default' : 'secondary'}>
                            {u.plano_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.ativa
                            ? <Badge variant="default">Ativa</Badge>
                            : <Badge variant="outline">Inativa</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEditar(u)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAtiva(u)}
                              title={u.ativa ? 'Desativar' : 'Reativar'}
                            >
                              {u.ativa ? <PowerOff className="h-4 w-4 text-destructive" /> : <Power className="h-4 w-4 text-emerald-600" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </div>
      </main>

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar unidade' : 'Nova unidade'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Maternidade São José"
                maxLength={120}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.tipo ?? ''}
                  onValueChange={(v) => setForm({ ...form, tipo: v || null })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CNES (7 dígitos)</Label>
                <Input
                  value={form.cnes ?? ''}
                  onChange={(e) => setForm({ ...form, cnes: e.target.value.replace(/\D/g, '').slice(0, 7) || null })}
                  placeholder="Ex: 2077426"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>País</Label>
                <Input
                  value={form.pais ?? ''}
                  onChange={(e) => setForm({ ...form, pais: e.target.value || null })}
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado / UF</Label>
                <Input
                  value={form.estado ?? ''}
                  onChange={(e) => setForm({ ...form, estado: e.target.value || null })}
                  placeholder="Ex: SP"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={form.cidade ?? ''}
                  onChange={(e) => setForm({ ...form, cidade: e.target.value || null })}
                  placeholder="Ex: São Paulo"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status do plano</Label>
                <Select
                  value={form.plano_status}
                  onValueChange={(v: any) => setForm({ ...form, plano_status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="suspenso">Suspenso</SelectItem>
                    <SelectItem value="expirado">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano expira em</Label>
                <Input
                  type="date"
                  value={form.plano_expira_em ? form.plano_expira_em.slice(0, 10) : ''}
                  onChange={(e) => setForm({ ...form, plano_expira_em: e.target.value || null })}
                />
              </div>
            </div>

            {editing && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                <div>
                  <p className="text-sm font-medium">Unidade ativa</p>
                  <p className="text-xs text-muted-foreground">
                    Inativas ficam ocultas para profissionais e gestores.
                  </p>
                </div>
                <Switch
                  checked={editing.ativa}
                  onCheckedChange={() => toggleAtiva(editing)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
