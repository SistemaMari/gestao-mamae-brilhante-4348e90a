import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { countries, especialidades, idiomas, identificadores } from '@/data/locationData';
import { useCidadesIBGE } from '@/hooks/useCidadesIBGE';
import CidadeCombobox from '@/components/CidadeCombobox';

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

export default function ProfileForm({ initialData, onSubmit, isLoading, submitLabel }: ProfileFormProps) {
  const { t } = useTranslation();
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
      if (!form[field]?.trim()) e[field] = t('profileForm.requiredField');
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
            {t('common.email')}
          </Label>
          <Input value={initialData.email} disabled className="bg-muted" />
        </div>
      )}

      {/* Nome */}
      <div className="space-y-1.5">
        <Label htmlFor="nome" className="text-sm font-medium text-foreground">
          {t('profileForm.fullName')} <span className="text-destructive">*</span>
          <FieldTooltip text={t('profileForm.fullNameTooltip')} />
        </Label>
        <Input
          id="nome"
          value={form.nome}
          onChange={e => handleChange('nome', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, nome: true }))}
          placeholder={t('profileForm.fullNamePlaceholder')}
        />
        {showError('nome') && <p className="text-xs text-destructive">{errors.nome}</p>}
      </div>

      {/* CRM / COREN */}
      <div className="space-y-1.5">
        <Label htmlFor="crm" className="text-sm font-medium text-foreground">
          {t('profileForm.crmCoren')} <span className="text-destructive">*</span>
          <FieldTooltip text={t('profileForm.crmTooltip')} />
        </Label>
        <Input
          id="crm"
          value={form.crm}
          onChange={e => handleChange('crm', e.target.value)}
          onBlur={() => setTouched(p => ({ ...p, crm: true }))}
          placeholder={t('profileForm.crmPlaceholder')}
        />
        {showError('crm') && <p className="text-xs text-destructive">{errors.crm}</p>}
      </div>

      {/* Especialidade */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          {t('profileForm.specialty')} <span className="text-destructive">*</span>
          <FieldTooltip text={t('profileForm.specialtyTooltip')} />
        </Label>
        <Select value={form.especialidade} onValueChange={v => handleChange('especialidade', v)}>
          <SelectTrigger>
            <SelectValue placeholder={t('profileForm.selectPlaceholder')} />
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
            {t('profileForm.country')} <span className="text-destructive">*</span>
          </Label>
          <Select value={form.pais} onValueChange={v => handleChange('pais', v)}>
            <SelectTrigger>
              <SelectValue placeholder={t('profileForm.selectPlaceholder')} />
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
            {t('profileForm.state')} <span className="text-destructive">*</span>
          </Label>
          {isOutro ? (
            <Input
              value={form.estado}
              onChange={e => handleChange('estado', e.target.value)}
              onBlur={() => setTouched(p => ({ ...p, estado: true }))}
              placeholder={t('profileForm.statePlaceholder')}
            />
          ) : (
            <Select value={form.estado} onValueChange={v => handleChange('estado', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('profileForm.selectPlaceholder')} />
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
          {t('profileForm.city')} <span className="text-destructive">*</span>
        </Label>
        {isOutro ? (
          <Input
            value={form.cidade}
            onChange={e => handleChange('cidade', e.target.value)}
            onBlur={() => setTouched(p => ({ ...p, cidade: true }))}
            placeholder={t('profileForm.cityPlaceholder')}
          />
        ) : (
          <CidadeCombobox
            value={form.cidade}
            onChange={v => {
              handleChange('cidade', v);
              setTouched(p => ({ ...p, cidade: true }));
            }}
            cidades={filteredCities}
            disabled={!form.estado}
            placeholder={form.estado ? t('profileForm.citySelectPlaceholder') : t('profileForm.citySelectStateFirst')}
          />
        )}
        {showError('cidade') && <p className="text-xs text-destructive">{errors.cidade}</p>}
      </div>

      {/* Idioma */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          {t('profileForm.preferredLanguage')} <span className="text-destructive">*</span>
          <FieldTooltip text={t('profileForm.languageTooltip')} />
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
          {t('profileForm.defaultIdentifier')}
          <FieldTooltip text={t('profileForm.identifierTooltip')} />
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
          {t('profileForm.phone')}
          <FieldTooltip text={t('profileForm.phoneTooltip')} />
        </Label>
        <Input
          id="telefone"
          value={form.telefone}
          onChange={e => handleChange('telefone', e.target.value)}
          placeholder={t('profileForm.phonePlaceholder')}
        />
      </div>

      {/* Botão */}
      <Button type="submit" className="w-full" disabled={!isValid || isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.saving')}
          </>
        ) : (
          submitLabel ?? t('profileForm.saveAndContinue')
        )}
      </Button>
    </form>
  );
}
