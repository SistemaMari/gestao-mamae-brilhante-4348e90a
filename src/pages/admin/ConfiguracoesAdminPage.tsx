import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, UserCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ConfiguracoesAdminPage() {
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('admins')
        .select('nome')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelado) return;
      if (!error && data) setNome(data.nome ?? '');
      setLoading(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  async function salvar() {
    if (!user?.id) return;
    if (!nome.trim()) {
      toast.error('Informe seu nome.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('admins')
      .update({ nome: nome.trim() })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
    } else {
      window.dispatchEvent(new CustomEvent("admin:nome-atualizado"));
      toast.success('Nome atualizado. Ele aparece na saudação e no menu.');
    }
  }

  return (
    <div className="container max-w-2xl py-8">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-bold text-foreground">Configurações</h1>
        <p className="mt-1 text-muted-foreground">Ajuste os dados da sua conta de administrador.</p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: '#E8E0FF' }}
            >
              <UserCircle className="h-6 w-6" style={{ color: '#7C4DBA' }} />
            </div>
            <div>
              <p className="font-heading font-semibold text-foreground">Sua identidade</p>
              <p className="text-sm text-muted-foreground">
                O nome aparece na saudação e no rodapé do menu.
              </p>
            </div>
          </div>

          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="nome-admin">Nome</Label>
              <Input
                id="nome-admin"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Moara de Carvalho"
                onKeyDown={(e) => e.key === 'Enter' && salvar()}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={user?.email ?? ''} disabled readOnly />
            <p className="text-xs text-muted-foreground">O e-mail de acesso não é editável por aqui.</p>
          </div>

          <div className="flex justify-end">
            <Button
              className="text-white hover:opacity-90"
              style={{ backgroundColor: '#7C4DBA' }}
              onClick={salvar}
              disabled={saving || loading}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
