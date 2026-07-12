import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ProfileForm, { ProfileFormData } from '@/components/ProfileForm';
import { UserCircle } from 'lucide-react';

export default function CompletarPerfilPage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<Partial<ProfileFormData> & { email?: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profissionais')
        .select('nome, crm, especialidade, pais, estado, cidade, idioma, identificador_padrao, telefone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // Se perfil já completo, redirecionar
        if (data.crm && data.especialidade) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setInitialData({
          nome: data.nome || '',
          crm: data.crm || '',
          especialidade: data.especialidade || '',
          pais: data.pais || 'Brasil',
          estado: data.estado || '',
          cidade: data.cidade || '',
          idioma: data.idioma || 'pt-BR',
          identificador_padrao: data.identificador_padrao || 'nenhum',
          telefone: data.telefone || '',
          email: user.email || '',
        });
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSubmit = async (formData: ProfileFormData) => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from('profissionais')
      .update({
        nome: formData.nome.trim(),
        crm: formData.crm.trim(),
        especialidade: formData.especialidade,
        pais: formData.pais,
        estado: formData.estado,
        cidade: formData.cidade,
        idioma: formData.idioma,
        identificador_padrao: formData.identificador_padrao,
        telefone: formData.telefone.trim() || null,
      })
      .eq('user_id', user.id);

    setSaving(false);

    if (error) {
      toast.error(t('completeProfile.saveError'));
      return;
    }

    toast.success(t('completeProfile.saveSuccess'));
    navigate('/dashboard', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-[500px] animate-fade-in">
        {/* Cabeçalho */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <UserCircle className="h-7 w-7 text-accent-foreground" />
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {t('completeProfile.title')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t('completeProfile.subtitle')}
          </p>
        </div>

        {/* Card do formulário */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <ProfileForm
            initialData={initialData}
            onSubmit={handleSubmit}
            isLoading={saving}
          />
        </div>
      </div>
    </div>
  );
}
