import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileText, Info, Loader2 } from 'lucide-react';

export default function PacientePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');
  const { user } = useAuth();
  const { profissionalData } = useProfissionalData();

  const isNew = id === 'nova' || !id;

  const [nome, setNome] = useState('');
  const [numeroId, setNumeroId] = useState('');
  const [dum, setDum] = useState('');
  const [usgData, setUsgData] = useState('');
  const [usgSemanas, setUsgSemanas] = useState('');
  const [usgDias, setUsgDias] = useState('');
  const [dmgAnterior, setDmgAnterior] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isNew) {
    return (
      <div className="mx-auto max-w-md py-12">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-5 font-heading text-xl font-bold text-foreground">Ficha da Paciente</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A ficha clínica detalhada (ID: {id?.slice(0, 8)}...) será construída no próximo prompt.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) {
      toast.error('O nome da paciente é obrigatório.');
      return;
    }

    if (isPreview) {
      toast.success('Cadastro simulado com sucesso na vitrine!');
      navigate(isPreview ? '/vitrine/dashboard' : '/dashboard');
      return;
    }

    if (!profissionalData || !user) {
      toast.error('Você precisa estar logado para cadastrar uma paciente.');
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      nome: nome.trim(),
      profissional_id: profissionalData.id,
      numero_identificacao: numeroId.trim() || null,
      dum: dum || null,
      usg_data: usgData || null,
      usg_ig_semanas: usgSemanas ? parseInt(usgSemanas, 10) : null,
      usg_ig_dias: usgDias ? parseInt(usgDias, 10) : null,
      dmg_gestacao_anterior: dmgAnterior,
    };

    if (profissionalData && 'unidade_id' in profissionalData) {
      // @ts-ignore — unidade_id may exist on extended profissionalData
      payload.unidade_id = (profissionalData as any).unidade_id || null;
    }

    const { error } = await supabase.from('pacientes').insert(payload as any);

    setSaving(false);

    if (error) {
      toast.error('Erro ao cadastrar paciente. Tente novamente.');
      console.error('Insert error:', error);
      return;
    }

    toast.success('Paciente cadastrada com sucesso!');
    navigate('/dashboard');
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h1 className="font-heading text-xl font-bold text-foreground">Nova Paciente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preencha os dados iniciais da paciente para abrir a ficha clínica.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Nome completo da gestante.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da paciente"
              required
            />
          </div>

          {/* Número de identificação */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="numero-id">Número de identificação</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Prontuário, CPF ou outro identificador interno da unidade.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="numero-id"
              value={numeroId}
              onChange={(e) => setNumeroId(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {/* DUM */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="dum">Data da Última Menstruação (DUM)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>Data referida pela paciente. Será usada para cálculo da idade gestacional caso não haja USG.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="dum"
              type="date"
              value={dum}
              onChange={(e) => setDum(e.target.value)}
            />
          </div>

          {/* USG */}
          <fieldset className="space-y-3 rounded-lg border border-border p-4">
            <legend className="px-2 text-sm font-medium text-foreground">
              Ultrassonografia (opcional)
            </legend>

            <div className="space-y-2">
              <Label htmlFor="usg-data">Data da USG</Label>
              <Input
                id="usg-data"
                type="date"
                value={usgData}
                onChange={(e) => setUsgData(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="usg-semanas">IG semanas</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>Idade gestacional em semanas completas na data da USG.</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="usg-semanas"
                  type="number"
                  min="0"
                  max="42"
                  value={usgSemanas}
                  onChange={(e) => setUsgSemanas(e.target.value)}
                  placeholder="Ex: 12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usg-dias">IG dias</Label>
                <Input
                  id="usg-dias"
                  type="number"
                  min="0"
                  max="6"
                  value={usgDias}
                  onChange={(e) => setUsgDias(e.target.value)}
                  placeholder="Ex: 3"
                />
              </div>
            </div>
          </fieldset>

          {/* DMG anterior */}
          <div className="flex items-start gap-3 rounded-lg border border-border p-4">
            <Checkbox
              id="dmg-anterior"
              checked={dmgAnterior}
              onCheckedChange={(v) => setDmgAnterior(v === true)}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="dmg-anterior" className="cursor-pointer font-medium">
                DMG em gestação anterior
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Marque se a paciente já teve diagnóstico de Diabete Mellitus Gestacional em gestação prévia.
              </p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isPreview ? '/vitrine/dashboard' : '/dashboard')}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar paciente
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
