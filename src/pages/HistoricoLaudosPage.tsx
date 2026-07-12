import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { FileText, Loader2, Search, Filter, History, Eye, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { downloadLaudoPdf, laudoConteudoToText } from '@/lib/laudoPdf';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import RealtimeIndicator from '@/components/RealtimeIndicator';

interface LaudoRow {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  conteudo_laudo: string | null;
  status: string;
  created_at: string;
  profissional_id: string | null;
  medico_nome: string | null;
  medico_crm: string | null;
}

const DATE_LOCALES: Record<string, typeof ptBR> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  es,
};

function fmtData(iso: string, lang: string, at: string) {
  try {
    const locale = DATE_LOCALES[lang] ?? ptBR;
    return format(new Date(iso), `dd/MM/yyyy '${at}' HH:mm`, { locale });
  } catch {
    return iso;
  }
}

export default function HistoricoLaudosPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatMedico = useCallback(
    (nome: string | null, crm: string | null): string => {
      if (!nome) return '—';
      const partes = [t('historicoLaudos.doctorPrefix', { nome })];
      if (crm) partes.push(t('historicoLaudos.crm', { crm }));
      return partes.join(' — ');
    },
    [t],
  );
  const [loading, setLoading] = useState(true);
  const [laudos, setLaudos] = useState<LaudoRow[]>([]);
  const [busca, setBusca] = useState('');

  const fetchLaudos = useCallback(async () => {
    if (!user) return;

    const { data: prof } = await supabase
      .from('profissionais')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!prof) {
      setLaudos([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('laudos')
      .select('id, paciente_id, profissional_id, status, conteudo_laudo, created_at, pacientes:paciente_id(nome)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      setLaudos([]);
      setLoading(false);
      return;
    }

    const profissionalIds = Array.from(
      new Set((data ?? []).map((l: any) => l.profissional_id).filter(Boolean)),
    );

    const medicoById = new Map<string, { nome: string | null; crm: string | null }>();
    if (profissionalIds.length > 0) {
      const { data: equipe } = await supabase
        .from('equipe_unidade_view' as any)
        .select('id, nome, crm')
        .in('id', profissionalIds);
      (equipe ?? []).forEach((m: any) => {
        medicoById.set(m.id, { nome: m.nome ?? null, crm: m.crm ?? null });
      });
    }

    const rows: LaudoRow[] = (data ?? []).map((l: any) => {
      const med = l.profissional_id ? medicoById.get(l.profissional_id) : null;
      return {
        id: l.id,
        paciente_id: l.paciente_id,
        paciente_nome: l.pacientes?.nome ?? '—',
        conteudo_laudo: l.conteudo_laudo,
        status: l.status,
        created_at: l.created_at,
        profissional_id: l.profissional_id,
        medico_nome: med?.nome ?? null,
        medico_crm: med?.crm ?? null,
      };
    });

    setLaudos(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchLaudos();
  }, [fetchLaudos]);

  // Realtime: laudos da unidade inteira (RLS já filtra o que cada usuário vê)
  const rtStatus = useRealtimeRefresh({
    tables: ['laudos', 'pacientes'],
    onChange: fetchLaudos,
    enabled: !!user,
    channelName: 'historico-laudos',
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return laudos;
    return laudos.filter((l) => l.paciente_nome.toLowerCase().includes(q));
  }, [laudos, busca]);

  return (
    <div>
      <div className="mb-6 flex items-center gap-2 text-sm text-primary">
        <History className="h-4 w-4" />
        <span>{t('nav.history')}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {t('historicoLaudos.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('historicoLaudos.subtitle')}
          </p>
        </div>
        <RealtimeIndicator status={rtStatus} />
      </div>

      {/* Filtros */}
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{t('common.filters')}</h2>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('historicoLaudos.searchPlaceholder')}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </section>

      {/* Tabela */}
      <section className="mt-6 rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              {laudos.length === 0
                ? t('historicoLaudos.emptyTitle')
                : t('historicoLaudos.noMatchTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {laudos.length === 0
                ? t('historicoLaudos.emptyDesc')
                : t('historicoLaudos.noMatchDesc')}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('management.patient')}</TableHead>
                <TableHead>{t('historicoLaudos.colDoctor')}</TableHead>
                <TableHead className="w-[200px]">{t('historicoLaudos.colGeneratedAt')}</TableHead>
                <TableHead className="w-[200px] text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((l) => {
                const podeBaixar =
                  (l.status === 'gerado' || l.status === 'concluido') && !!l.conteudo_laudo;
                const emProcessamento = l.status === 'processando' || l.status === 'pendente' || l.status === 'gerando';
                const comErro = l.status === 'erro';

                const handleDownload = () => {
                  if (!l.conteudo_laudo) {
                    toast.error(t('historicoLaudos.noContentToast'));
                    return;
                  }
                  downloadLaudoPdf({
                    pacienteNome: l.paciente_nome,
                    medicoNome: l.medico_nome,
                    medicoCrm: l.medico_crm,
                    geradoEm: fmtData(l.created_at, i18n.language, t('historicoLaudos.dateAt')),
                    conteudo: laudoConteudoToText(l.conteudo_laudo),
                  });
                };

                return (
                  <TableRow key={l.id} className="hover:bg-muted/40">
                    <TableCell>
                      <Link to={`/paciente/${l.paciente_id}`} className="font-medium text-foreground hover:underline">
                        {l.paciente_nome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {formatMedico(l.medico_nome, l.medico_crm)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fmtData(l.created_at, i18n.language, t('historicoLaudos.dateAt'))}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {emProcessamento ? (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {t('historicoLaudos.generating')}
                          </Badge>
                        ) : comErro ? (
                          <Badge variant="destructive">{t('historicoLaudos.generationFailed')}</Badge>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/laudo/${l.id}`)}
                              title={t('historicoLaudos.viewReport')}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">{t('historicoLaudos.view')}</span>
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleDownload}
                              disabled={!podeBaixar}
                              title={podeBaixar ? t('report.downloadPdf') : t('historicoLaudos.notReady')}
                            >
                              <Download className="h-4 w-4" />
                              <span className="sr-only md:not-sr-only md:ml-2">{t('historicoLaudos.pdf')}</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
