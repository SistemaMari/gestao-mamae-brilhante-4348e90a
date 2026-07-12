import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  UserCog, Loader2, Camera, Lock, MessageSquareHeart, Heart, Star,
  AlertTriangle, Eye, EyeOff, Mail, Paperclip, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
  const fields = [
    { label: 'Nome', value: data.nome },
    { label: 'E-mail', value: email },
    { label: 'Especialidade', value: data.especialidade },
    { label: 'CRM', value: data.crm },
    { label: 'Estado', value: data.estado },
    { label: 'País', value: data.pais },
  ];
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent">
          <UserCog className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="mt-4 font-heading text-xl font-bold text-foreground">Meu Perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os dados do seu perfil institucional são gerenciados pela sua unidade.
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

/* -------------------- Consultório: full editor -------------------- */
function PerfilConsultorio({ initial, email, userId }: { initial: PerfilData; email: string; userId: string }) {
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
  const [emailModal, setEmailModal] = useState(false);
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
      toast.error('A imagem deve ter no máximo 2 MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Envie uma imagem PNG ou JPG.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('avatares-profissionais')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error('Falha ao enviar imagem.'); return; }
    // Persist path in profissionais
    const { error: upErr } = await supabase
      .from('profissionais')
      .update({ avatar_url: path })
      .eq('user_id', userId);
    if (upErr) { toast.error('Não foi possível salvar a foto no perfil.'); return; }
    setAvatarUrl(path);
    toast.success('Foto atualizada!');
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
    if (error) { toast.error('Erro ao remover foto.'); return; }
    setAvatarUrl(null);
    setAvatarSignedUrl(null);
    toast.success('Foto removida.');
    window.dispatchEvent(new CustomEvent('admin:nome-atualizado'));
  };

  const salvarBasico = async () => {
    if (!nome.trim()) { toast.error('Informe seu nome.'); return; }
    setSavingBasico(true);
    const { error } = await supabase.from('profissionais').update({
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      data_aniversario: aniversario || null,
    }).eq('user_id', userId);
    setSavingBasico(false);
    if (error) { toast.error('Erro ao salvar.'); return; }
    toast.success('Dados atualizados!');
    window.dispatchEvent(new CustomEvent('admin:nome-atualizado'));
  };

  const salvarProfissional = async () => {
    if (!especialidade) { toast.error('Selecione a especialidade.'); return; }
    if (!conselhoNum.trim() || !conselhoUf) { toast.error('Preencha o conselho e a UF.'); return; }
    const crmFmt = `${conselhoTipo} ${conselhoUf} ${conselhoNum.trim()}`;
    setSavingProf(true);
    const { error } = await supabase.from('profissionais').update({
      especialidade,
      crm: crmFmt,
      estado: conselhoUf,
    }).eq('user_id', userId);
    setSavingProf(false);
    if (error) { toast.error('Erro ao salvar dados profissionais.'); return; }
    toast.success('Dados profissionais atualizados!');
  };

  const salvarSenha = async () => {
    if (!senhaAtual) { toast.error('Informe sua senha atual.'); return; }
    if (!senha1 || !senha2) { toast.error('Preencha os dois campos.'); return; }
    if (senha1 !== senha2) { toast.error('As senhas não coincidem.'); return; }
    setSavingSenha(true);
    // Reautentica com a senha atual
    if (!email) { setSavingSenha(false); toast.error('Sessão inválida.'); return; }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: senhaAtual });
    if (reauthErr) {
      setSavingSenha(false);
      toast.error('Senha atual incorreta.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: senha1 });
    setSavingSenha(false);
    if (error) { toast.error(error.message || 'Erro ao trocar senha.'); return; }
    setSenhaAtual(''); setSenha1(''); setSenha2('');
    toast.success('Senha atualizada!');
  };

  const enviarFeedback = async () => {
    const msg = fbTexto.trim();
    if (!msg) { toast.error('Escreva sua mensagem.'); return; }
    setSavingFb(true);
    let anexo_url: string | null = null;
    if (fbAnexo) {
      if (fbAnexo.size > 3 * 1024 * 1024) {
        setSavingFb(false);
        toast.error('Anexo deve ter no máximo 3 MB.');
        return;
      }
      const ext = fbAnexo.name.split('.').pop() || 'png';
      const path = `${userId}/feedback-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatares-profissionais').upload(path, fbAnexo, { upsert: false });
      if (!upErr) anexo_url = path;
    }
    const { error } = await supabase.from('feedbacks_usuario').insert({
      user_id: userId, tipo: fbTipo, mensagem: msg, anexo_url,
    });
    setSavingFb(false);
    if (error) { toast.error('Erro ao enviar feedback.'); return; }
    setFbTexto(''); setFbAnexo(null);
    toast.success('Obrigada pelo seu feedback! 💜');
  };

  const enviarDepoimento = async () => {
    if (!rating) { toast.error('Escolha uma nota de 1 a 5 estrelas.'); return; }
    setSavingDepo(true);
    const { error } = await supabase.from('depoimentos_usuario').insert({
      user_id: userId, rating, texto: depoTexto.trim() || null,
    });
    setSavingDepo(false);
    if (error) { toast.error('Erro ao enviar depoimento.'); return; }
    setRating(0); setDepoTexto('');
    toast.success('Depoimento enviado! Obrigada 💜');
  };

  const excluirConta = async () => {
    if (!confirmSenha) { toast.error('Digite sua senha para confirmar.'); return; }
    setExcluindo(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: confirmSenha });
    if (authErr) { setExcluindo(false); toast.error('Senha incorreta.'); return; }
    const { error } = await supabase.from('profissionais').update({
      deleted_at: new Date().toISOString(),
    }).eq('user_id', userId);
    if (error) { setExcluindo(false); toast.error('Erro ao processar exclusão.'); return; }
    toast.success('Conta marcada para exclusão. Você será desconectado.');
    setTimeout(async () => { await supabase.auth.signOut(); window.location.href = '/login'; }, 1500);
  };

  const iniciais = (nome || 'M A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1 className="font-heading text-3xl font-bold text-foreground">Meu perfil</h1>
        <p className="mt-1 text-muted-foreground">Personalize seu espaço.</p>
      </header>

      {/* 1. Perfil */}
      <Card>
        <CardTitle icon={UserCog}>Perfil</CardTitle>
        <div className="mb-5 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-accent">
            {avatarSignedUrl ? (
              <img src={avatarSignedUrl} alt="Avatar" className="h-full w-full object-cover" />
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
                  <Camera className="h-4 w-4" /> Trocar foto
                </span>
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setConfirmRemoverFoto(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Remover foto
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG ou JPG, até 2 MB.</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <Label>Nome completo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label>E-mail</Label>
            <div className="flex gap-2">
              <Input value={email} disabled className="bg-muted" />
              <Button type="button" variant="outline" onClick={() => setEmailModal(true)}>
                <Mail className="h-4 w-4" /> Solicitar alteração
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" maxLength={30} />
            </div>
            <div>
              <Label>Data de aniversário</Label>
              <Input type="date" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
            </div>
          </div>
          <div>
            <Button onClick={salvarBasico} disabled={savingBasico} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingBasico && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Dados profissionais */}
      <Card>
        <CardTitle icon={UserCog}>Dados profissionais</CardTitle>
        <div className="grid gap-4">
          <div>
            <Label>Especialidade</Label>
            <Select value={especialidade} onValueChange={setEspecialidade}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {ESPECIALIDADES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-[120px,1fr,120px]">
            <div>
              <Label>Conselho</Label>
              <Select value={conselhoTipo} onValueChange={setConselhoTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRM">CRM</SelectItem>
                  <SelectItem value="COREN">COREN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Número</Label>
              <Input value={conselhoNum} onChange={(e) => setConselhoNum(e.target.value)} maxLength={30} />
            </div>
            <div>
              <Label>UF</Label>
              <Select value={conselhoUf} onValueChange={setConselhoUf}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button onClick={salvarProfissional} disabled={savingProf} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingProf && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Alterar senha */}
      <Card>
        <CardTitle icon={Lock}>Alterar senha</CardTitle>
        <div className="grid gap-4">
          <div>
            <Label>Nova senha</Label>
            <div className="relative">
              <Input type={showSenha ? 'text' : 'password'} value={senha1} onChange={(e) => setSenha1(e.target.value)} placeholder="Digite a nova senha" />
              <button type="button" onClick={() => setShowSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label>Confirmar nova senha</Label>
            <Input type={showSenha ? 'text' : 'password'} value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder="Repita a nova senha" />
          </div>
          <div>
            <Button onClick={salvarSenha} disabled={savingSenha} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingSenha && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova senha
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Feedback */}
      <Card>
        <CardTitle icon={MessageSquareHeart}>Enviar feedback</CardTitle>
        <div className="grid gap-4">
          <div>
            <Label>Tipo</Label>
            <Select value={fbTipo} onValueChange={setFbTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sugestao">Sugestão</SelectItem>
                <SelectItem value="elogio">Elogio</SelectItem>
                <SelectItem value="erro">Reportar erro</SelectItem>
                <SelectItem value="duvida">Dúvida</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={fbTexto} onChange={(e) => setFbTexto(e.target.value.slice(0, 1000))} placeholder="Conta pra gente..." rows={4} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{fbTexto.length}/1000</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFbAnexo(e.target.files?.[0] || null)} />
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-muted">
                <Paperclip className="h-4 w-4" /> {fbAnexo ? fbAnexo.name.slice(0, 24) : 'Anexar print'}
              </span>
            </label>
            <Button onClick={enviarFeedback} disabled={savingFb} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingFb && <Loader2 className="h-4 w-4 animate-spin" />} Enviar
            </Button>
          </div>
        </div>
      </Card>

      {/* 5. Depoimento */}
      <Card>
        <CardTitle icon={Heart}>Depoimento</CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          Está gostando do MARI? Deixe seu depoimento — isso nos ajuda muito 💜
        </p>
        <div className="grid gap-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} estrelas`}>
                <Star className={`h-8 w-8 transition ${n <= rating ? 'fill-primary text-primary' : 'text-muted-foreground/40'}`} />
              </button>
            ))}
          </div>
          <div>
            <Textarea value={depoTexto} onChange={(e) => setDepoTexto(e.target.value.slice(0, 1000))}
              placeholder="Conte como o MARI tem ajudado na sua rotina..." rows={4} />
            <p className="mt-1 text-right text-xs text-muted-foreground">{depoTexto.length}/1000</p>
          </div>
          <div>
            <Button onClick={enviarDepoimento} disabled={savingDepo} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {savingDepo && <Loader2 className="h-4 w-4 animate-spin" />} Enviar avaliação
            </Button>
          </div>
        </div>
      </Card>

      {/* 6. Zona de perigo */}
      <Card className="border-destructive/30">
        <button type="button" onClick={() => setZonaAberta(v => !v)}
          className="flex w-full items-center justify-between text-left">
          <span className="flex items-center gap-2 font-heading text-lg font-semibold text-destructive">
            <AlertTriangle className="h-5 w-5" /> Zona de perigo
          </span>
          {zonaAberta ? <ChevronUp className="h-5 w-5 text-destructive" /> : <ChevronDown className="h-5 w-5 text-destructive" />}
        </button>
        {zonaAberta && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Ao excluir sua conta, seus dados pessoais serão marcados para remoção conforme a LGPD.
              Esta ação não pode ser desfeita.
            </p>
            <Label>Confirme com sua senha</Label>
            <Input type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)} placeholder="Sua senha atual" />
            <Button variant="destructive" onClick={excluirConta} disabled={excluindo}>
              {excluindo && <Loader2 className="h-4 w-4 animate-spin" />} Excluir minha conta
            </Button>
          </div>
        )}
      </Card>

      {/* Modal solicitar alteração de e-mail */}
      <Dialog open={emailModal} onOpenChange={setEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar alteração de e-mail</DialogTitle>
            <DialogDescription>
              Por segurança, a troca de e-mail é feita pela nossa equipe. Envie um pedido para{' '}
              <a href="mailto:suporte@novodmg.com.br" className="text-primary underline">suporte@novodmg.com.br</a>{' '}
              informando o novo e-mail desejado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setEmailModal(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------- Page shell -------------------- */
export default function PerfilPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');
  const [data, setData] = useState<PerfilData | null>(isPreview ? DUMMY_PROFILE : null);
  const [loading, setLoading] = useState(!isPreview);

  useEffect(() => {
    if (isPreview) { setData(DUMMY_PROFILE); setLoading(false); return; }
    if (authLoading) { setLoading(true); return; }
    if (!user) { setData(null); setLoading(false); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from('profissionais')
        .select('id, nome, crm, especialidade, estado, pais, telefone, avatar_url, data_aniversario')
        .eq('user_id', user.id).maybeSingle();
      if (!cancel) { setData(p as PerfilData | null); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [authLoading, isPreview, user]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) {
    return <div className="mx-auto max-w-md p-8 text-center text-muted-foreground">Perfil não encontrado.</div>;
  }

  // Editor completo só para consultório real
  if (!isPreview && profile === 'consultorio' && user) {
    return <PerfilConsultorio initial={data} email={user.email || ''} userId={user.id} />;
  }

  return <PerfilReadOnly data={data} email={isPreview ? DUMMY_EMAIL : user?.email} />;
}
