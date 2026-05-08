import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, Users, Sparkles, Image as ImageIcon, FileText, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface UnidadeData {
  nome: string;
  tipo: string | null;
  cnes: string | null;
  cidade: string | null;
  estado: string | null;
}
interface ContratanteData {
  nome: string | null;
  cnpj: string | null;
}
interface EquipeData {
  total: number;
  ultimaInclusao: { nome: string; created_at: string } | null;
}

const SUPORTE_EMAIL = 'SuporteMari@novodmg.com.br';

const formatCNPJ = (raw: string | null) => {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  if (d.length !== 14) return raw;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
};

const capitalize = (s: string | null) => s ? s.charAt(0).toUpperCase() + s.slice(1) : null;

const formatDateBR = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('pt-BR'); } catch { return ''; }
};

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#E2E8F0] bg-card p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ Icon, title, subtitle }: { Icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F5F3FA]">
        <Icon className="h-5 w-5 text-[#7C4DBA]" />
      </div>
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVitrine = pathname.startsWith('/vitrine');
  const basePath = isVitrine ? '/vitrine/gestao' : '/gestao';

  const [loading, setLoading] = useState(true);
  const [erroUnidade, setErroUnidade] = useState(false);
  const [unidade, setUnidade] = useState<UnidadeData | null>(null);
  const [contratante, setContratante] = useState<ContratanteData | null>(null);
  const [equipe, setEquipe] = useState<EquipeData>({ total: 0, ultimaInclusao: null });

  useEffect(() => {
    if (isVitrine) {
      // Mock vitrine — nome final do produto em definição, não fixar.
      setUnidade({ nome: 'Hospital Demo', tipo: 'hospital', cnes: '1234567', cidade: 'São Paulo', estado: 'SP' });
      setContratante({ nome: 'Rede Demo de Saúde', cnpj: '12345678000190' });
      setEquipe({
        total: 3,
        ultimaInclusao: { nome: 'Dra. Bia Mello', created_at: new Date(Date.now() - 12 * 86400000).toISOString() },
      });
      setLoading(false);
      return;
    }
    if (!user) return;

    (async () => {
      setLoading(true);
      try {
        const { data: prof } = await supabase
          .from('profissionais')
          .select('unidade_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const unidadeId = prof?.unidade_id;
        if (!unidadeId) {
          setErroUnidade(true);
          setLoading(false);
          return;
        }

        // Card 1 — tenta JOIN com contratantes; se falhar, fallback sem JOIN.
        let unidadeOk = false;
        try {
          const { data, error } = await supabase
            .from('unidades')
            .select('nome, tipo, cnes, cidade, estado, contratante_id, contratantes:contratante_id(nome, cnpj)')
            .eq('id', unidadeId)
            .maybeSingle();
          if (error) throw error;
          if (data) {
            setUnidade({
              nome: (data as any).nome,
              tipo: (data as any).tipo ?? null,
              cnes: (data as any).cnes ?? null,
              cidade: (data as any).cidade ?? null,
              estado: (data as any).estado ?? null,
            });
            const c = (data as any).contratantes;
            if (c && (c.nome || c.cnpj)) {
              setContratante({ nome: c.nome ?? null, cnpj: c.cnpj ?? null });
            } else {
              setContratante(null);
            }
            unidadeOk = true;
          }
        } catch (joinErr) {
          console.warn('[ConfiguracoesPage] JOIN com contratantes falhou, usando fallback:', joinErr);
        }

        if (!unidadeOk) {
          try {
            const { data, error } = await supabase
              .from('unidades')
              .select('nome, tipo, cnes, cidade, estado')
              .eq('id', unidadeId)
              .maybeSingle();
            if (error) throw error;
            if (data) {
              setUnidade({
                nome: data.nome,
                tipo: data.tipo ?? null,
                cnes: (data as any).cnes ?? null,
                cidade: data.cidade ?? null,
                estado: data.estado ?? null,
              });
              setContratante(null);
              unidadeOk = true;
            }
          } catch (fallbackErr) {
            console.error('[ConfiguracoesPage] Fallback unidades falhou:', fallbackErr);
            setErroUnidade(true);
          }
        }

        // Card 2 — equipe (independente do Card 1)
        try {
          const { data: profs } = await supabase
            .from('profissionais')
            .select('nome, created_at, acesso_revogado, perfil_institucional')
            .eq('unidade_id', unidadeId);
          const ativos = (profs || []).filter((p: any) =>
            p.perfil_institucional === 'institucional' &&
            (p.acesso_revogado === false || p.acesso_revogado == null)
          );
          ativos.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setEquipe({
            total: ativos.length,
            ultimaInclusao: ativos[0]
              ? { nome: ativos[0].nome, created_at: ativos[0].created_at }
              : null,
          });
        } catch (eqErr) {
          console.warn('[ConfiguracoesPage] erro ao carregar equipe:', eqErr);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isVitrine, user]);

  const localizacao = (() => {
    if (!unidade) return null;
    const { cidade, estado } = unidade;
    if (cidade && estado) return `${cidade} - ${estado}`;
    if (cidade) return cidade;
    if (estado) return estado;
    return '—';
  })();

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="font-heading text-2xl font-bold text-foreground">Configurações da unidade</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visão geral dos dados, equipe e preferências da sua unidade.</p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Card 1 — Dados da Unidade */}
          <CardShell>
            <CardHeader Icon={Building2} title="Dados da Unidade" subtitle="Para alterar estes dados, contate o suporte." />

            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <SkeletonLine className="h-3 w-20" />
                    <SkeletonLine className="h-4 w-40" />
                  </div>
                ))}
              </div>
            ) : erroUnidade || !unidade ? (
              <p className="text-sm text-muted-foreground">Não foi possível carregar os dados da unidade. Tente recarregar a página.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Nome da unidade" value={unidade.nome} />
                  <Field label="Tipo" value={capitalize(unidade.tipo) || '—'} />
                  <Field label="Localização" value={localizacao} />
                  {unidade.cnes && unidade.cnes.trim() && (
                    <Field label="CNES" value={unidade.cnes} />
                  )}
                  {contratante && contratante.nome && (
                    <Field label="Contratante" value={contratante.nome} />
                  )}
                  {contratante && contratante.cnpj && (
                    <Field label="CNPJ" value={formatCNPJ(contratante.cnpj)} />
                  )}
                </div>
                <p className="mt-4 text-xs text-[#64748B]">
                  Modelo de contratação: Contrato institucional — gerenciado externamente.
                </p>
              </>
            )}

            <div className="mt-5 border-t border-[#E2E8F0] pt-4 text-xs text-muted-foreground">
              Para corrigir ou atualizar estes dados, entre em contato com o suporte:{' '}
              <a href={`mailto:${SUPORTE_EMAIL}`} className="font-medium text-[#7C4DBA] hover:underline">
                {SUPORTE_EMAIL}
              </a>
            </div>
          </CardShell>

          {/* Card 2 — Equipe */}
          <CardShell>
            <CardHeader Icon={Users} title="Equipe" subtitle="Profissionais ativos na sua unidade." />

            {loading ? (
              <div className="space-y-3">
                <SkeletonLine className="h-9 w-48" />
                <SkeletonLine className="h-4 w-64" />
              </div>
            ) : (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="font-heading font-bold text-[#5B3A8C] text-[28px] md:text-[36px] leading-none">
                    {equipe.total}
                  </span>
                  <span className="text-sm text-foreground">
                    {equipe.total === 1 ? 'profissional ativo' : 'profissionais ativos'}
                  </span>
                </div>
                {equipe.ultimaInclusao && equipe.total > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Última inclusão: {equipe.ultimaInclusao.nome} em {formatDateBR(equipe.ultimaInclusao.created_at)}
                  </p>
                )}
              </>
            )}

            <div className="mt-5">
              <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/equipe`)}>
                Gerenciar equipe <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardShell>

          {/* Card 3 — Preferências da Unidade */}
          <CardShell>
            <CardHeader Icon={Sparkles} title="Preferências da Unidade" subtitle="Em breve." />

            <div className="rounded-lg bg-[#F5F3FA] p-4">
              <p className="text-sm text-foreground">
                Em breve, sua unidade poderá personalizar laudos com identidade própria — logo, dados de contato no rodapé e e-mail alternativo de notificações.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-foreground">
                <li className="flex items-start gap-2">
                  <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                  <span><span className="font-medium">Logo da unidade nos laudos</span> — substituir o logo padrão da MARI por um da sua unidade.</span>
                </li>
                <li className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                  <span><span className="font-medium">Rodapé customizado</span> — adicionar CNPJ, endereço e telefone da unidade ao final do laudo.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B]" />
                  <span><span className="font-medium">E-mail alternativo de notificações</span> — receber avisos do sistema em endereço diferente do login.</span>
                </li>
              </ul>
            </div>
          </CardShell>
        </div>
      </div>
    </div>
  );
}
