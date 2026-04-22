import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { countries, especialidades, idiomas, identificadores } from '@/data/locationData';
import { useCidadesIBGE } from '@/hooks/useCidadesIBGE';

export interface ProfileFormData {
  nome: string;
  crm: string;
  especialidade: string;
  pais: string;
  estado: string;
  cidade: string;
  idioma: string;
  identificador_padrao: string;
  telefone: string;
}

interface ProfileFormProps {
  initialData: Partial<ProfileFormData> & { email?: string };
  onSubmit: (data: ProfileFormData) => Promise<void>;
  isLoading: boolean;
  submitLabel?: string;
}

function FieldTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="ml-1 inline h-3.5 w-3.5 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export default function ProfileForm({ initialData, onSubmit, isLoading, submitLabel = 'Salvar e continuar' }: ProfileFormProps) {
  const [form, setForm] = useState<ProfileFormData>({
    nome: initialData.nome || '',
    crm: initialData.crm || '',
    especialidade: initialData.especialidade || '',
    pais: initialData.pais || 'Brasil',
    estado: initialData.estado || '',
    cidade: initialData.cidade || '',
    idioma: initialData.idioma || 'pt-BR',
    identificador_padrao: initialData.identificador_padrao || 'nenhum',
    telefone: initialData.telefone || '',
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  

  const isOutro = form.pais === 'Outro';

  const countryData = useMemo(() => countries.find(c => c.value === form.pais), [form.pais]);
  const { cidades: cidadesIBGE } = useCidadesIBGE(form.pais, form.estado);
  const filteredCities = useMemo(() => {
    if (isOutro) return [];
    return cidadesIBGE;
  }, [cidadesIBGE, isOutro]);

  const required: (keyof ProfileFormData)[] = ['nome', 'crm', 'especialidade', 'pais', 'estado', 'cidade', 'idioma'];

  const errors = useMemo(() => {
    const e: Partial<Record<keyof ProfileFormData, string>> = {};
    required.forEach(field => {
      if (!form[field]?.trim()) e[field] = 'Campo obrigatório';
    });
    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'pais') {
        next.estado = '';
        next.cidade = '';
      }
      if (field === 'estado') {
        next.cidade = '';
      }
      return next;
    });
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Marcar todos como touched
    const allTouched: Record<string, boolean> = {};
    required.forEach(f => { allTouched[f] = true; });
    setTouched(allTouched);
    if (!isValid) return;
    await onSubmit(form);
  };

  const showError = (field: keyof ProfileFormData) => touched[field] && errors[field];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email (somente leitura) */}
      {initialData.email && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            E-mail
          </Label>
          <Input value={initialData.email} disabled className="bg-muted" />
        </div>
      )}

      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="nome" className="text-sm font-medium text-foreground">
          Nome completo <span className="text-destructive">*</span>
          <FieldTooltip text="Seu nome completo como aparecerá nos laudos." />
        </Label>
        <Input
          id="nome"
          value={form.nome}
          onChange={e => handleChange('nome', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, nome: true }))}
          placeholder="Seu nome completo"
        />
        {showError('nome') && <p className="text-xs text-destructive">{errors.nome}</p>}
      </div>

      {/* CRM / COREN */}
      <div className="space-y-1.5">
        <Label htmlFor="crm" className="text-sm font-medium text-foreground">
          CRM / COREN <span className="text-destructive">*</span>
          <FieldTooltip text="Número do registro profissional. Ex: CRM/SP 123456" />
        </Label>
        <Input
          id="crm"
          value={form.crm}
          onChange={e => handleChange('crm', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, crm: true }))}
          placeholder="Ex: CRM/SP 123456"
        />
        {showError('crm') && <p className="text-xs text-destructive">{errors.crm}</p>}
      </div>

      {/* Especialidade */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Especialidade <span className="text-destructive">*</span>
          <FieldTooltip text="Selecione sua área de atuação principal." />
        </Label>
        <Select value={form.especialidade} onValueChange={v => handleChange('especialidade', v)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {especialidades.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showError('especialidade') && <p className="text-xs text-destructive">{errors.especialidade}</p>}
      </div>

      {/* País e Estado lado a lado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            País <span className="text-destructive">*</span>
          </Label>
          <Select value={form.pais} onValueChange={v => handleChange('pais', v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {countries.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showError('pais') && <p className="text-xs text-destructive">{errors.pais}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Estado <span className="text-destructive">*</span>
          </Label>
          {isOutro ? (
            <Input
              value={form.estado}
              onChange={e => handleChange('estado', e.target.value)}
              onBlur={() => setTouched(p => ({ ...p, estado: true }))}
              placeholder="Digite o estado"
            />
          ) : (
            <Select value={form.estado} onValueChange={v => handleChange('estado', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {countryData?.states.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showError('estado') && <p className="text-xs text-destructive">{errors.estado}</p>}
        </div>
      </div>

      {/* Cidade */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Cidade <span className="text-destructive">*</span>
        </Label>
        {isOutro ? (
          <Input
            value={form.cidade}
            onChange={e => handleChange('cidade', e.target.value)}
            onBlur={() => setTouched(p => ({ ...p, cidade: true }))}
            placeholder="Digite a cidade"
          />
        ) : (
          <Select
            value={form.cidade}
            onValueChange={v => handleChange('cidade', v)}
            disabled={!form.estado}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                form.estado ? 'Selecione a cidade...' : 'Selecione o estado primeiro'
              } />
            </SelectTrigger>
            <SelectContent>
              {filteredCities.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
              {filteredCities.length === 0 && form.estado && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma cidade encontrada</div>
              )}
            </SelectContent>
          </Select>
        )}
        {showError('cidade') && <p className="text-xs text-destructive">{errors.cidade}</p>}
      </div>

      {/* Idioma */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Idioma preferido <span className="text-destructive">*</span>
          <FieldTooltip text="Define o idioma da interface e dos laudos gerados." />
        </Label>
        <Select value={form.idioma} onValueChange={v => handleChange('idioma', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {idiomas.map(i => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showError('idioma') && <p className="text-xs text-destructive">{errors.idioma}</p>}
      </div>

      {/* Identificador padrão */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Identificador padrão
          <FieldTooltip text="Define qual identificador você usa para suas pacientes." />
        </Label>
        <Select value={form.identificador_padrao} onValueChange={v => handleChange('identificador_padrao', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {identificadores.map(i => (
              <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Telefone */}
      <div className="space-y-1.5">
        <Label htmlFor="telefone" className="text-sm font-medium text-foreground">
          Telefone
          <FieldTooltip text="Opcional. Número de contato profissional." />
        </Label>
        <Input
          id="telefone"
          value={form.telefone}
          onChange={e => handleChange('telefone', e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>

      {/* Botão */}
      <Button type="submit" className="w-full" disabled={!isValid || isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
