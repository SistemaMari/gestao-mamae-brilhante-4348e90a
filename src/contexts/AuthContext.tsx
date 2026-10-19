import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';
import {
  marcarSessaoPlantao, limparSessaoPlantao, sessaoPlantaoExpirada, INTERVALO_BATIMENTO_MS,
} from '@/lib/sessaoPlantao';

export type UserProfile = 'consultorio' | 'institucional' | 'gestor' | 'gestor_geral' | 'admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ROLE_PRIORITY: UserProfile[] = [
  'admin',
  'gestor_geral',
  'gestor',
  'institucional',
  'consultorio',
];

async function rolesFromUserRoles(userId: string): Promise<UserProfile[]> {
  // Ao abrir/atualizar a página o token pode estar sendo renovado e a 1ª
  // consulta falhar; sem perfil a pessoa caía no onboarding como se tivesse
  // sido deslogada. Tenta algumas vezes, com espera crescente.
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (!error && data) {
      return (data.map((r) => r.role) as UserProfile[]) ?? [];
    }
    if (tentativa < 3) await new Promise((r) => setTimeout(r, 300 * (tentativa + 1)));
  }
  return [];
}

async function determineProfile(userId: string): Promise<UserProfile | null> {
  // 1. Fonte oficial: user_roles (com prioridade fixa)
  const roles = await rolesFromUserRoles(userId);
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }

  // 2. Fallback legado: tabelas específicas — só se user_roles estiver vazio
  const { data: admin } = await supabase
    .from('admins')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (admin) return 'admin';

  const { data: gestorGeral } = await supabase
    .from('gestores_gerais')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (gestorGeral) return 'gestor_geral';

  const { data: profissional } = await supabase
    .from('profissionais')
    .select('unidade_id, perfil_institucional, acesso_revogado')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profissional) return null;
  if ((profissional as any).acesso_revogado) {
    await supabase.auth.signOut();
    try {
      const { toast } = await import('sonner');
      toast.error(i18n.t('auth.accountDisabled'));
    } catch { /* ignore */ }
    return null;
  }
  if (!profissional.unidade_id) return 'consultorio';
  if (profissional.perfil_institucional === 'gestor') return 'gestor';
  return 'institucional';
}

export function getRedirectPath(profile: UserProfile): string {
  switch (profile) {
    case 'admin': return '/admin';
    case 'gestor_geral': return '/consolidar';
    case 'gestor': return '/gestao';
    default: return '/dashboard';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Cache das consultas (react-query) é por aba, não por usuário: as chaves dos
  // painéis não levam o id de quem está logado. Ao trocar de conta na mesma aba,
  // a tela mostrava os dados da conta anterior (ex.: gestor geral vendo as
  // unidades de outro gestor geral). Limpamos o cache a cada troca de identidade.
  const queryClient = useQueryClient();

  // Refs estáveis com o último user.id e o último access_token persistidos.
  // Usadas para evitar criar novas referências de user/session em eventos
  // de TOKEN_REFRESHED quando nada relevante mudou — esse era um dos
  // gatilhos do Bug B (refetch em cascata ao voltar foco de aba). Fonte 1, 34B.1.
  const currentUserIdRef = useRef<string | null>(null);
  const currentAccessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    const resolverPerfil = async (uid: string) => {
      try {
        const p = await determineProfile(uid);
        // Institucional: a sessão vale só enquanto o navegador estiver aberto
        // (computador da unidade é dividido entre plantões). Demais perfis
        // seguem logados até sair. Ver src/lib/sessaoPlantao.ts.
        if (p === 'institucional') {
          if (sessaoPlantaoExpirada()) {
            limparSessaoPlantao();
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
          marcarSessaoPlantao();
        } else {
          limparSessaoPlantao();
        }
        if (!cancelado) setProfile(p);
      } catch {
        if (!cancelado) setProfile(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    /**
     * Atualiza user/session evitando referências novas quando o usuário é o mesmo
     * E o access_token também não mudou.
     *
     * O Supabase Auth dispara onAuthStateChange ao voltar foco mesmo sem mudança
     * de identidade (eventos SIGNED_IN/INITIAL_SESSION com a mesma sessão, ou
     * TOKEN_REFRESHED com novo token mas mesmo user). Sem este guard, cada
     * volta de foco criava novas refs de user/session, propagando refetches
     * em cascata por toda a árvore (useProfissionalData, useAuthoriaFicha etc.).
     */
    const syncSession = (newSession: Session | null) => {
      const newUserId = newSession?.user?.id ?? null;
      const newAccessToken = newSession?.access_token ?? null;
      const sameUser = currentUserIdRef.current === newUserId;
      const sameToken = currentAccessTokenRef.current === newAccessToken;

      currentUserIdRef.current = newUserId;
      currentAccessTokenRef.current = newAccessToken;

      // Se identidade E token são idênticos, não cria novas referências.
      // (loading/profile também não precisam ser tocados.)
      if (sameUser && sameToken) return { changed: false, sameUser };

      setSession(newSession);
      setUser(newSession?.user ?? null);
      return { changed: true, sameUser };
    };

    // Listener primeiro — NUNCA usar await dentro do callback (deadlock conhecido do Supabase Auth)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        const { changed, sameUser } = syncSession(newSession);

        if (newSession?.user) {
          // Se nada relevante mudou (mesmo user E mesmo token), mantém profile/loading.
          if (!changed) return;
          // Se mudou o token mas o user é o mesmo, NÃO derruba o profile — só atualiza session
          // silenciosamente. O profile já resolvido continua válido.
          if (sameUser) return;
          // Caso real de mudança de identidade: descarta dados da conta anterior e re-resolve perfil.
          queryClient.clear();
          setLoading(true);
          setTimeout(() => {
            resolverPerfil(newSession.user.id);
          }, 0);
        } else {
          limparSessaoPlantao();
          queryClient.clear();
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Depois getSession
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      syncSession(initialSession);

      if (initialSession?.user) {
        resolverPerfil(initialSession.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      cancelado = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // Plantão do institucional: enquanto houver uma aba aberta, renova o sinal de
  // vida (permite abrir outra aba sem perder o login).
  useEffect(() => {
    if (profile !== 'institucional') return;
    const bater = () => marcarSessaoPlantao();
    bater();
    const id = window.setInterval(bater, INTERVALO_BATIMENTO_MS);
    const aoVoltar = () => { if (document.visibilityState === 'visible') bater(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [profile]);

  const signIn = async (email: string, password: string) => {
    // Login digitado agora = plantão novo nesta aba (antes do perfil resolver,
    // para o institucional não ser deslogado logo em seguida).
    marcarSessaoPlantao();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'E-mail ou senha incorretos.' };
    return { error: null };
  };

  const signOut = async () => {
    limparSessaoPlantao();
    await supabase.auth.signOut();
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });
    if (error) return { error: 'Erro ao enviar e-mail de recuperação. Tente novamente.' };
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
