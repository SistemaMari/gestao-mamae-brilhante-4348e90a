import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import {
  getPreviewPacienteById,
  type PreviewPaciente,
  type PreviewConsulta,
} from '@/lib/previewPatients';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, Calendar, Clock, FileText, Plus, User,
} from 'lucide-react';
import { differenceInYears, differenceInDays, addDays, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  aguardando_gj: { label: 'Aguardando GJ', color: 'bg-gray-500' },
  aguardando_gtt: { label: 'Aguardando GTT', color: 'bg-blue-500' },
  dmg_afastado: { label: 'DMG afastado', color: 'bg-emerald-500' },
  dmg_confirmado: { label: 'DMG confirmado', color: 'bg-orange-500' },
  resultado_parto: { label: 'Resultado do parto', color: 'bg-purple-500' },
  encaminhada_endocrino: { label: 'Associar endocrino', color: 'bg-red-500' },
};

export default function FichaPacientePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isPreview = location.pathname.startsWith('/vitrine');
  useAuth();
  useProfissionalData();

  const [paciente, setPaciente] = useState<PreviewPaciente | null>(null);
  const [consultas, setConsultas] = useState<PreviewConsulta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    if (isPreview) {
      const p = getPreviewPacienteById(id);
      if (p) {
        setPaciente(p);
        setConsultas(p.consultas || []);
      }
      setLoading(false);
      return;
    }

    (async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', id)
        .single();

      if (pac) {
        setPaciente({
          ...pac,
          data_nascimento: pac.data_nascimento || null,
          consultas: [],
        } as any);

        const { data: cons } = await supabase
          .from('consultas')
          .select('*')
          .eq('paciente_id', id)
          .order('data', { ascending: true });

        setConsultas(
          (cons || []).map((c: any) => ({
            id: c.id,
            tipo: c.tipo,
            numero_sequencial: c.numero_sequencial,
            data: c.data,
            ig_semanas: c.ig_semanas,
            ig_dias: c.ig_dias,
            observacoes: c.observacoes,
            status_gerado: c.status_gerado,
          }))
        );
      }
      setLoading(false);
    })();
  }, [id, isPreview]);

  const idade = useMemo(() => {
    if (!paciente?.data_nascimento) return null;
    return differenceInYears(new Date(), new Date(paciente.data_nascimento));
  }, [paciente?.data_nascimento]);

  const primeiraConsulta = consultas.find((c) => c.tipo === 'consulta_1');

  // Current IG calculated from consulta 1
  const igAtual = useMemo(() => {
    if (!primeiraConsulta || primeiraConsulta.ig_semanas == null) return null;
    const diasC1 = primeiraConsulta.ig_semanas * 7 + (primeiraConsulta.ig_dias || 0);
    const elapsed = differenceInDays(new Date(), new Date(primeiraConsulta.data));
    const totalDias = diasC1 + elapsed;
    return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7 };
  }, [primeiraConsulta]);

  // DUM calculada
  const dumCalculada = useMemo(() => {
    if (!primeiraConsulta || primeiraConsulta.ig_semanas == null) return null;
    const totalDias = primeiraConsulta.ig_semanas * 7 + (primeiraConsulta.ig_dias || 0);
    return addDays(new Date(primeiraConsulta.data), -totalDias);
  }, [primeiraConsulta]);

  // GTT window: 24-28 weeks from DUM
  const janelaGTT = useMemo(() => {
    if (!dumCalculada) return null;
    const inicio = addDays(dumCalculada, 24 * 7);
    const fim = addDays(dumCalculada, 28 * 7);
    return { inicio, fim };
  }, [dumCalculada]);

  // Is IG >= 24 weeks?
  const igMaior24 = igAtual ? igAtual.semanas >= 24 : false;

  const status = paciente ? STATUS_CONFIG[paciente.status_ficha] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!paciente) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <p className="text-muted-foreground">Paciente não encontrada.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate(isPreview ? '/vitrine/dashboard' : '/dashboard')}
        >
          Voltar ao dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* DMG anterior banner — fixed at top, not closeable */}
      {paciente.dmg_gestacao_anterior && (
        <div className="flex items-start gap-3 rounded-xl border-2 border-orange-400 bg-orange-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <p className="text-sm font-semibold text-orange-800">
            ATENÇÃO — Histórico de DMG em gestação anterior. Fator de risco elevado para recorrência. Monitorar com atenção redobrada.
          </p>
        </div>
      )}

      {/* Header card */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">{paciente.nome}</h1>
            {idade !== null && (
              <span className="text-sm text-muted-foreground">{idade} anos</span>
            )}
          </div>
          {status && (
            <Badge className={`${status.color} text-white border-0 shrink-0`}>
              {status.label}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {paciente.data_nascimento && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Nascimento:</span>{' '}
                {format(new Date(paciente.data_nascimento), 'dd/MM/yyyy')}
              </span>
            </div>
          )}
          {paciente.numero_identificacao && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Identificação:</span>{' '}
                {paciente.numero_identificacao}
              </span>
            </div>
          )}
          {primeiraConsulta && primeiraConsulta.ig_semanas != null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">IG na consulta 1:</span>{' '}
                {primeiraConsulta.ig_semanas}s {primeiraConsulta.ig_dias || 0}d
              </span>
            </div>
          )}
          {igAtual && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">IG hoje:</span>{' '}
                {igAtual.semanas} sem + {igAtual.dias} dias
              </span>
            </div>
          )}
          {primeiraConsulta && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Data da consulta 1:</span>{' '}
                {format(new Date(primeiraConsulta.data), 'dd/MM/yyyy')}
              </span>
            </div>
          )}
          {dumCalculada && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">DUM:</span>{' '}
                {format(dumCalculada, 'dd/MM/yyyy')}
              </span>
            </div>
          )}
        </div>

        {/* Observações da consulta 1 */}
        {primeiraConsulta?.observacoes && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground mb-1">Observações clínicas:</p>
            <p className="text-sm text-muted-foreground italic">{primeiraConsulta.observacoes}</p>
          </div>
        )}
      </div>

      {/* Confirmation card — green */}
      {paciente.status_ficha === 'aguardando_gj' && (
        <>
          <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7] p-5 space-y-4">
            <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pedido de exame — Consulta 1
            </h2>

            {/* Parte 1 — Orientação do exame */}
            <div className="rounded-lg bg-white/70 p-3">
              <p className="text-sm font-semibold text-emerald-900">Orientação do exame</p>
              <p className="mt-1 text-xs text-emerald-800">
                Consulta 1 registrada com sucesso. Solicitar glicemia plasmática de jejum. Jejum de 8 a 12 horas. Coleta venosa processada em laboratório — glicemia capilar em ponta de dedo não é válida para fins diagnósticos.
              </p>
            </div>

            {/* Parte 2 — Janela GTT */}
            {janelaGTT && (
              <div className="rounded-lg bg-white/70 p-3">
                <p className="text-sm font-semibold text-emerald-900">Janela para GTT 75g</p>
                <p className="mt-1 text-xs text-emerald-800">
                  {igMaior24 ? (
                    'O GTT 75g já está na janela — solicitar o mais breve possível.'
                  ) : (
                    <>
                      O GTT 75g deverá ser realizado o mais próximo possível da 24ª semana (entre{' '}
                      <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e{' '}
                      <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>
                      ). Oriente a paciente desde já.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Parte 3 — Notas técnicas — card cinza separado */}
          <div className="rounded-xl border border-border bg-[#F1F5F9] p-5">
            <p className="text-sm font-semibold text-foreground mb-2">Notas técnicas</p>
            <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
              <li>Não repetir glicemia de jejum para fins diagnósticos — em nenhum cenário, seja resultado positivo ou negativo.</li>
              <li>Glicemia plasmática é OBRIGATÓRIA para diagnóstico — glicemia capilar em ponta de dedo não é válida para este fim.</li>
              <li>Glicemia capilar de jejum e pós-prandiais são utilizadas exclusivamente para acompanhamento do perfil glicêmico — nunca para diagnóstico.</li>
            </ul>
          </div>
        </>
      )}

      {/* Histórico de consultas */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de consultas
        </h2>

        {consultas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
        ) : (
          <div className="space-y-3">
            {consultas.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {c.tipo === 'consulta_1' ? 'Consulta 1' : `Retorno ${c.numero_sequencial}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.data), 'dd/MM/yyyy')}
                  </span>
                </div>
                {c.ig_semanas != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    IG: {c.ig_semanas}s {c.ig_dias || 0}d
                  </p>
                )}
                {c.observacoes && (
                  <p className="mt-1 text-xs text-muted-foreground italic">{c.observacoes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botão nova consulta de retorno */}
        <Button
          variant="outline"
          className="mt-4 w-full"
          onClick={() => toast('Consulta de retorno ainda não implementada (Prompt 9).')}
        >
          <Plus className="mr-2 h-4 w-4" />
          + Nova consulta de retorno
        </Button>
      </div>
    </div>
  );
}
