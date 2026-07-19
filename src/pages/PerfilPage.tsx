import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  UserCog, Loader2, Camera, Lock, MessageSquareHeart, Heart, Star,
  AlertTriangle, Eye, EyeOff, Paperclip, ChevronDown, ChevronUp, Trash2, Building2, Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ESPECIALIDADES = ['Médico(a)', 'Enfermeiro(a) Obstétrica', 'Outros'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

interface PerfilData {
  id?: string;
  nome: string;
  crm: string | null;
  especialidade: string | null;
  estado: string | null;
  pais: string | null;
  telefone?: string | null;
  avatar_url?: string | null;
  data_aniversario?: string | null;
}

const DUMMY_PROFILE: PerfilData = {
  nome: 'MARI Exemplo',
  crm: 'CRM 12345/SP',
  especialidade: 'Médico(a)',
  estado: 'SP',
  pais: 'Brasil',
};
const DUMMY_EMAIL = 'mari.exemplo@dramari.com';

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

function CardTitle({ icon: Icon, children }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
      {Icon && <Icon className="h-5 w-5 text-primary" />}
      {children}
    </h2>
  );
}

/* -------------------- Read-only fallback (institucional / preview) -------------------- */
function PerfilReadOnly({ data, email }: { data: PerfilData; email: string | undefined }) {
  const { t } = useTranslation();
  const fields = [
    { label: t('common.name'), value: data.nome },
    { label: t('common.email'), value: email },
    { label: t('profile.specialty'), value: data.especialidade },
    { label: t('profile.crmShort'), value: data.crm },
    { label: t('patient.state'), value: data.estado },
    { label: t('patient.country'), value: data.pais },
  ];
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <UserCog className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="mt-4 font-heading text-xl font-bold text-foreground">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('profile.institutionalManaged')}
        </p>
        <div className="mt-6 space-y-3 text-left">
          {fields.map((f) => (
            <div key={f.label} className="flex justify-between border-b border-border pb-2">
              <span className="text-sm text-muted-foreground">{f.label}</span>
              <span className="text-sm font-medium text-foreground">{f.value || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Consultório / Institucional: editor -------------------- */
function PerfilConsultorio({ initial, email, userId, perfilTipo, unidadeNome }: { initial: PerfilData; email: string; userId: string; perfilTipo: 'consultorio' | 'institucional'; unidadeNome?: string | null }) {
  const { t } = useTranslation();
  const isInstitucional = perfilTipo === 'institucional';
  const [data, setData] = useState<PerfilData>(initial);

  const parseConselho = (raw: string | null) => {
    if (!raw) return { tipo: 'CRM', numero: '', uf: '' };
    const m = raw.match(/^(CRM|COREN)\s*([A-Z]{2})?\s*(.*)$/i);
    if (m) return { tipo: (m[1] || 'CRM').toUpperCase(), uf: (m[2] || '').toUpperCase(), numero: (m[3] || '').trim() };
    return { tipo: 'CRM', numero: raw, uf: '' };
  };
  const initConselho = parseConselho(initial.crm);

  const [nome, setNome] = useState(initial.nome || '');
  const [telefone, setTelefone] = useState(initial.telefone || '');
  const [aniversario, setAniversario] = useState(initial.data_aniversario || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatar_url || null);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);
  const [savingBasico, setSavingBasico] = useState(false);

  const [especialidade, setEspecialidade] = useState(initial.especialidade || '');
  const [conselhoTipo, setConselhoTipo] = useState(initConselho.tipo);
  const [conselhoNum, setConselhoNum] = useState(initConselho.numero);
  const [conselhoUf, setConselhoUf] = useState(initConselho.uf || initial.estado || '');
  const [savingProf, setSavingProf] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [senha1, setSenha1] = useState('');
  const [senha2, setSenha2] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);

  const [fbTipo, setFbTipo] = useState('sugestao');
  const [fbTexto, setFbTexto] = useState('');
  const [fbAnexo, setFbAnexo] = useState<File | null>(null);
  const [savingFb, setSavingFb] = useState(false);

  const [rating, setRating] = useState(0);
  const [depoTexto, setDepoTexto] = useState('');
  const [savingDepo, setSavingDepo] = useState(false);

  const [zonaAberta, setZonaAberta] = useState(false);
  const [confirmSenha, setConfirmSenha] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [confirmRemoverFoto, setConfirmRemoverFoto] = useState(false);
  const [removendoFoto, setRemovendoFoto] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!avatarUrl) { setAvatarSignedUrl(null); return; }
      const { data: signed } = await supabase.storage
        .from('avatares-profissionais')
        .createSignedUrl(avatarUrl, 3600);
      if (!cancel) setAvatarSignedUrl(signed?.signedUrl || null);
    })();
    return () => { cancel = true; };
  }, [avatarUrl]);

  const handleAvatar = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('profile.errors.imageMaxSize'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.errors.imageFormat'));
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('avatares-profissionais')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(t('profile.errors.imageUpload')); return; }
    // Persist path in profissionais
    const { error: upErr } = await supabase
      .from('profissionais')
      .update({ avatar_url: path })
      .eq('user_id', userId);
    if (upErr) { toast.error(t('profile.errors.photoSave')); return; }
    setAvatarUrl(path);
    toast.success(t('profile.toasts.photoUpdated'));
    window.dispatchEvent(new CustomEvent('admin:nome-atualizado'));
  };

  const removerFoto = async () => {
    setRemovendoFoto(true);
    // apaga arquivo se path pertence ao bucket
    if (avatarUrl) {
      await supabase.storage.from('avatares-profissionais').remove([avatarUrl]).catch(() => {});
    }
    const { error } = await supabase.from('profissionais')
      .update({ avatar_url: null }).eq('user_id', userId);
    setRemovendoFoto(false);
    setConfirmRemoverFoto(false);
    if (error) { toast.error(t('profile.errors.photoRemove')); return; }
    setAvatarUrl(null);
    setAvatarSignedUrl(null);
    toast.success(t('profile.toasts.photoRemoved'));
    window.dispatchEvent(new CustomEvent('admin:nome-atualizado'));
  };

  const salvarBasico = async () => {
    if (!nome.trim()) { toast.error(t('profile.errors.nameRequired')); return; }
    setSavingBasico(true);
    const { error } = await supabase.from('profissionais').update({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      data_aniversario: aniversario || null,
    }).eq('user_id', userId);
    setSavingBasico(false);
    if (error) { toast.error(t('profile.errors.saveGeneric')); return; }
    toast.success(t('profile.toasts.dataUpdated'));
    window.dispatchEvent(new CustomEvent('admin:nome-atualizado'));
  };

  const salvarProfissional = async () => {
    if (!especialidade) { toast.error(t('profile.errors.specialtyRequired')); return; }
    if (!conselhoNum.trim() || !conselhoUf) { toast.error(t('profile.errors.councilRequired')); return; }
    const crmFmt = `${conselhoTipo} ${conselhoUf} ${conselhoNum.trim()}`;
    setSavingProf(true);
    const { error } = await supabase.from('profissionais').update({
      especialidade,
      crm: crmFmt,
      estado: conselhoUf,
    }).eq('user_id', userId);
    setSavingProf(false);
    if (error) { toast.error(t('profile.errors.saveProfessional')); return; }
    toast.success(t('profile.toasts.professionalUpdated'));
  };

  const salvarSenha = async () => {
    if (!senhaAtual) { toast.error(t('profile.errors.currentPasswordRequired')); return; }
    if (!senha1 || !senha2) { toast.error(t('profile.errors.bothFieldsRequired')); return; }
    if (senha1 !== senha2) { toast.error(t('profile.errors.passwordsDontMatch')); return; }
    setSavingSenha(true);
    // Reautentica com a senha atual
    if (!email) { setSavingSenha(false); toast.error(t('profile.errors.invalidSession')); return; }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: senhaAtual });
    if (reauthErr) {
      setSavingSenha(false);
      toast.error(t('profile.errors.currentPasswordWrong'));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: senha1 });
    setSavingSenha(false);
    if (error) { toast.error(error.message || t('profile.errors.passwordChange')); return; }
    setSenhaAtual(''); setSenha1(''); setSenha2('');
    toast.success(t('profile.toasts.passwordUpdated'));
  };

  const enviarFeedback = async () => {
    const msg = fbTexto.trim();
    if (!msg) { toast.error(t('profile.errors.messageRequired')); return; }
    setSavingFb(true);
    let anexo_url: string | null = null;
    if (fbAnexo) {
      if (fbAnexo.size > 3 * 1024 * 1024) {
        setSavingFb(false);
        toast.error(t('profile.errors.attachmentMaxSize'));
        return;
      }
      const ext = fbAnexo.name.split('.').pop() || 'png';
      const path = `${userId}/feedback-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatares-profissionais').upload(path, fbAnexo, { upsert: false });
      if (!upErr) anexo_url = path;
    }
    const { error } = await supabase.functions.invoke('enviar-feedback', {
      body: { tipo: fbTipo, mensagem: msg, anexo_url },
    });
    setSavingFb(false);
    if (error) { toast.error(t('profile.errors.feedbackSend')); return; }
    setFbTexto(''); setFbAnexo(null);
    toast.success(t('profile.toasts.feedbackThanks'));
  };

  const enviarDepoimento = async () => {
    if (!rating) { toast.error(t('profile.errors.ratingRequired')); return; }
    setSavingDepo(true);
    const { error } = await supabase.from('depoimentos_usuario').insert({
      user_id: userId, rating, texto: depoTexto.trim() || null,
    });
    setSavingDepo(false);
    if (error) { toast.error(t('profile.errors.testimonialSend')); return; }
    setRating(0); setDepoTexto('');
    toast.success(t('profile.toasts.testimonialThanks'));
  };

  const excluirConta = async () => {
    if (!confirmSenha) { toast.error(t('profile.errors.passwordConfirmRequired')); return; }
    setExcluindo(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: confirmSenha });
    if (authErr) { setExcluindo(false); toast.error(t('profile.errors.passwordWrong')); return; }
    const { error } = await supabase.from('profissionais').update({
      deleted_at: new Date().toISOString(),
    }).eq('user_id', userId);
    if (error) { setExcluindo(false); toast.error(t('profile.errors.deleteProcess')); return; }
    toast.success(t('profile.toasts.accountDeleted'));
    setTimeout(async () => { await supabase.auth.signOut(); window.location.href = '/login'; }, 1500);
  };

  const iniciais = (nome || 'M A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="font-heading text-3xl font-bold text-foreground">{t('profile.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('profile.customizeSpace')}</p>
      </header>

      {isInstitucional && (
        <Card>
          <CardTitle icon={Building2}>{t('profile.institutionalLink')}</CardTitle>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('profile.unit')}</p>
              <p className="mt-1 font-medium text-foreground">{unidadeNome || '—'}</p>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {t('profile.managedByUnitManager')}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {t('profile.unitChangeNote')}
          </p>
        </Card>
      )}


      {/* 1. Perfil */}
      <Card>
        <CardTitle icon={UserCog}>{t('profile.sectionProfile')}</CardTitle>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-accent">
            {avatarSignedUrl ? (
              <img src={avatarSignedUrl} alt={t('profile.avatarAlt')} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-heading text-2xl text-primary">
                {iniciais}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <label className="cursor-pointer">
                <input
                  type="file" accept="image/png,image/jpeg" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleAvatar(e.target.files[0])}
                />
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10">
                  <Camera className="h-4 w-4" /> {t('profile.changePhoto')}
                </span>
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoverFoto(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> {t('profile.removePhoto')}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('profile.photoHint')}</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label>{t('profile.fullName')}</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </div>
          <div>
            {/* E-mail é somente leitura: a troca é feita pelo suporte (mantém o
                login e o cadastro de cobrança no Asaas em sincronia). A tooltip
                explica o MOTIVO sem oferecer o caminho — evita que o campo pareça
                defeito, sem convidar pedidos de troca. */}
            <div className="flex items-center gap-1.5">
              <Label>{t('common.email')}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{t('profile.emailLockedTooltip')}</TooltipContent>
              </Tooltip>
            </div>
            <Input value={email} disabled className="bg-muted" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{t('profile.phoneWhatsapp')}</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" maxLength={30} />
            </div>
            <div>
              <Label>{t('profile.birthdate')}</Label>
              <Input type="date" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
            </div>
          </div>
          <div>
            <Button onClick={salvarBasico} disabled={savingBasico} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingBasico && <Loader2 className="h-4 w-4 animate-spin" />} {t('common.save')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Dados profissionais */}
      <Card>
        <CardTitle icon={UserCog}>{t('profile.professionalInfo')}</CardTitle>
        <div className="grid gap-4">
          <div>
            <Label>{t('profile.specialty')}</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger><SelectValue placeholder={t('profile.selectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {ESPECIALIDADES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[120px,1fr,120px]">
            <div>
              <Label>{t('profile.council')}</Label>
              <Select value={conselhoTipo} onValueChange={setConselhoTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRM">CRM</SelectItem>
                  <SelectItem value="COREN">COREN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('profile.councilNumber')}</Label>
              <Input value={conselhoNum} onChange={(e) => setConselhoNum(e.target.value)} maxLength={30} />
            </div>
            <div>
              <Label>{t('profile.uf')}</Label>
              <Select value={conselhoUf} onValueChange={setConselhoUf}>
                <SelectTrigger><SelectValue placeholder={t('profile.ufPlaceholder')} /></SelectTrigger>
                <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button onClick={salvarProfissional} disabled={savingProf} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingProf && <Loader2 className="h-4 w-4 animate-spin" />} {t('common.save')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Alterar senha */}
      <Card>
        <CardTitle icon={Lock}>{t('profile.changePassword')}</CardTitle>
        <div className="grid gap-4">
          <div>
            <Label>{t('profile.currentPassword')}</Label>
            <div className="relative">
              <Input
                type={showSenhaAtual ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder={t('profile.currentPasswordPlaceholder')}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowSenhaAtual(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showSenhaAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>{t('profile.newPassword')}</Label>
            <div className="relative">
              <Input type={showSenha ? 'text' : 'password'} value={senha1} onChange={(e) => setSenha1(e.target.value)} placeholder={t('profile.newPasswordPlaceholder')} />
              <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>{t('profile.confirmNewPassword')}</Label>
            <Input type={showSenha ? 'text' : 'password'} value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder={t('profile.repeatNewPasswordPlaceholder')} />
          </div>
          <div>
            <Button onClick={salvarSenha} disabled={savingSenha} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingSenha && <Loader2 className="h-4 w-4 animate-spin" />} {t('profile.saveNewPassword')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Feedback */}
      <Card>
        <CardTitle icon={MessageSquareHeart}>{t('profile.sendFeedback')}</CardTitle>
        <div className="grid gap-4">
          <div>
            <Label>{t('profile.feedbackType')}</Label>
            <Select value={fbTipo} onValueChange={setFbTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sugestao">{t('profile.feedbackTypes.sugestao')}</SelectItem>
                <SelectItem value="elogio">{t('profile.feedbackTypes.elogio')}</SelectItem>
                <SelectItem value="erro">{t('profile.feedbackTypes.erro')}</SelectItem>
                <SelectItem value="duvida">{t('profile.feedbackTypes.duvida')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('profile.message')}</Label>
            <Textarea value={fbTexto} onChange={(e) => setFbTexto(e.target.value.slice(0, 1000))} placeholder={t('profile.feedbackPlaceholder')} rows={4} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{fbTexto.length}/1000</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFbAnexo(e.target.files?.[0] || null)} />
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-muted">
                <Paperclip className="h-4 w-4" /> {fbAnexo ? fbAnexo.name.slice(0, 24) : t('profile.attachScreenshot')}
              </span>
            </label>
            <Button onClick={enviarFeedback} disabled={savingFb} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingFb && <Loader2 className="h-4 w-4 animate-spin" />} {t('common.upload')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 5. Depoimento */}
      <Card>
        <CardTitle icon={Heart}>{t('profile.testimonial')}</CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          {t('profile.testimonialIntro')}
        </p>
        <div className="grid gap-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={t('profile.starsAria', { count: n })}>
                <Star className={`h-8 w-8 transition ${n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground/40'}`} />
              </button>
            ))}
          </div>
          <div>
            <Textarea value={depoTexto} onChange={(e) => setDepoTexto(e.target.value.slice(0, 1000))}
              placeholder={t('profile.testimonialPlaceholder')} rows={4} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{depoTexto.length}/1000</p>
          </div>
          <div>
            <Button onClick={enviarDepoimento} disabled={savingDepo} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingDepo && <Loader2 className="h-4 w-4 animate-spin" />} {t('profile.sendRating')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 6. Zona de perigo — apenas consultório */}
      {!isInstitucional && (
        <Card className="border-destructive/30">
          <button type="button" onClick={() => setZonaAberta(v => !v)}
            className="flex w-full items-center justify-between text-left">
            <span className="flex items-center gap-2 font-heading text-lg font-semibold text-destructive">
              <AlertTriangle className="h-5 w-5" /> {t('profile.dangerZone')}
            </span>
            {zonaAberta ? <ChevronUp className="h-5 w-5 text-destructive" /> : <ChevronDown className="h-5 w-5 text-destructive" />}
          </button>
          {zonaAberta && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {t('profile.deleteAccountWarning')}
              </p>
              <Label>{t('profile.confirmWithPassword')}</Label>
              <Input type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} placeholder={t('profile.currentPasswordPlaceholder')} />
              <Button variant="destructive" onClick={excluirConta} disabled={excluindo}>
                {excluindo && <Loader2 className="h-4 w-4 animate-spin" />} {t('profile.deleteMyAccount')}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Confirmação — remover foto */}
      <AlertDialog open={confirmRemoverFoto} onOpenChange={setConfirmRemoverFoto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('profile.removePhotoConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.removePhotoConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendoFoto}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); removerFoto(); }}
              disabled={removendoFoto}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removendoFoto && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('common.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -------------------- Page shell -------------------- */
export default function PerfilPage() {
  const { t } = useTranslation();
  const { user, profile, loading: authLoading } = useAuth();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');
  const [data, setData] = useState<PerfilData | null>(isPreview ? DUMMY_PROFILE : null);
  const [unidadeNome, setUnidadeNome] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isPreview);

  useEffect(() => {
    if (isPreview) { setData(DUMMY_PROFILE); setLoading(false); return; }
    if (authLoading) { setLoading(true); return; }
    if (!user) { setData(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from('profissionais')
        .select('id, nome, crm, especialidade, estado, pais, telefone, avatar_url, data_aniversario, unidade_id')
        .eq('user_id', user.id).maybeSingle();
      if (cancel) return;
      setData(p as PerfilData | null);
      if (p && (p as any).unidade_id) {
        const { data: u } = await supabase.from('unidades')
          .select('nome').eq('id', (p as any).unidade_id).maybeSingle();
        if (!cancel) setUnidadeNome((u as any)?.nome ?? null);
      } else {
        setUnidadeNome(null);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [authLoading, isPreview, user]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) {
    return <div className="mx-auto max-w-md p-8 text-center text-muted-foreground">{t('profile.notFound')}</div>;
  }

  // Editor completo para consultório e institucional
  if (!isPreview && (profile === 'consultorio' || profile === 'institucional') && user) {
    return (
      <PerfilConsultorio
        initial={data}
        email={user.email || ''}
        userId={user.id}
        perfilTipo={profile as 'consultorio' | 'institucional'}
        unidadeNome={unidadeNome}
      />
    );
  }

  return <PerfilReadOnly data={data} email={isPreview ? DUMMY_EMAIL : user?.email} />;
}
