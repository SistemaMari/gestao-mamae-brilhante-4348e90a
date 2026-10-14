import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PerfilCard, PerfilCardTitle } from './PerfilCard';

/**
 * Troca de senha com reautenticação pela senha atual. Usado no Meu perfil das
 * profissionais e dos gestores (extraído da PerfilPage, mesmo comportamento).
 */
export default function CardAlterarSenha({ email }: { email: string }) {
  const { t } = useTranslation();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senha1, setSenha1] = useState('');
  const [senha2, setSenha2] = useState('');
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);

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

  return (
    <PerfilCard>
      <PerfilCardTitle icon={Lock}>{t('profile.changePassword')}</PerfilCardTitle>
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
    </PerfilCard>
  );
}
