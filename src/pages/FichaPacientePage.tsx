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
import Retorno1Form from '@/components/Retorno1Form';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
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
  const [showRetorno1, setShowRetorno1] = useState(false);

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
  const canShowRetorno1 = paciente?.status_ficha === 'aguardando_gj' && !!primeiraConsulta && !showRetorno1;
  const canShowRetorno1Form = showRetorno1 && paciente?.status_ficha === 'aguardando_gj' && !!primeiraConsulta;

  const reloadPaciente = () => {
    if (!id) return;
    if (isPreview) {
      const p = getPreviewPacienteById(id);
      if (p) {
        setPaciente(p);
        setConsultas(p.consultas || []);
      }
    }
    setShowRetorno1(false);
  };

  // IG calculated from DUM
  const igNaConsulta1 = useMemo(() => {
    if (!paciente?.dum || !primeiraConsulta) return null;
    const dias = differenceInDays(new Date(primeiraConsulta.data), new Date(paciente.dum));
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente?.dum, primeiraConsulta]);

  const igAtual = useMemo(() => {
    if (!paciente?.dum) return null;
    const dias = differenceInDays(new Date(), new Date(paciente.dum));
    if (dias < 0) return null;
    return { semanas: Math.floor(dias / 7), dias: dias % 7 };
  }, [paciente?.dum]);

  const dumDate = useMemo(() => {
    if (!paciente?.dum) return null;
    return new Date(paciente.dum);
  }, [paciente?.dum]);

  // GTT window: 24-28 weeks from DUM
  const janelaGTT = useMemo(() => {
    if (!dumDate) return null;
    const inicio = addDays(dumDate, 24 * 7);
    const fim = addDays(dumDate, 28 * 7);
    return { inicio, fim };
  }, [dumDate]);

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
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Nascimento:</span>{' '}
              {paciente.data_nascimento ? format(new Date(paciente.data_nascimento), 'dd/MM/yyyy') : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Identificação:</span>{' '}
              {paciente.numero_identificacao
                ? `${(paciente as any).tipo_identificacao?.toUpperCase() || ''}: ${paciente.numero_identificacao}`
                : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">IG na consulta 1:</span>{' '}
              {igNaConsulta1
                ? `${igNaConsulta1.semanas}s ${igNaConsulta1.dias}d`
                : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">IG hoje:</span>{' '}
              {igAtual ? `${igAtual.semanas} sem + ${igAtual.dias} dias` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">Data da consulta 1:</span>{' '}
              {primeiraConsulta ? format(new Date(primeiraConsulta.data), 'dd/MM/yyyy') : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-foreground">DUM:</span>{' '}
              {paciente.dum ? format(new Date(paciente.dum), 'dd/MM/yyyy') : '—'}
            </span>
          </div>
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
          <Accordion type="multiple" className="space-y-2">
            {consultas.map((c) => (
              <AccordionItem key={c.id} value={c.id} className="rounded-lg border border-border px-3 py-0">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex w-full items-center justify-between pr-2">
                    <span className="text-sm font-medium text-foreground">
                      {c.tipo === 'consulta_1' ? 'Consulta 1' : `Retorno ${c.numero_sequencial}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.data), 'dd/MM/yyyy')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  {c.ig_semanas != null && (
                    <p className="text-xs text-muted-foreground mb-1">
                      IG: {c.ig_semanas}s {c.ig_dias || 0}d
                    </p>
                  )}
                  {c.status_gerado && STATUS_CONFIG[c.status_gerado] && (
                    <Badge className={`${STATUS_CONFIG[c.status_gerado].color} text-white border-0 text-[10px] mb-2`}>
                      {STATUS_CONFIG[c.status_gerado].label}
                    </Badge>
                  )}
                  {c.observacoes ? (
                    <p className="text-xs text-muted-foreground italic">{c.observacoes}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sem observações.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}

        {/* Retorno 1 form */}
        {canShowRetorno1Form && primeiraConsulta && paciente && (
          <div className="mt-4">
            <Retorno1Form
              paciente={paciente}
              primeiraConsulta={primeiraConsulta}
              isPreview={isPreview}
              onSaved={reloadPaciente}
              onCancel={() => setShowRetorno1(false)}
            />
          </div>
        )}

        {/* Botão nova consulta de retorno */}
        {canShowRetorno1 && (
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setShowRetorno1(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            + Nova consulta de retorno
          </Button>
        )}

        {/* Botão para status que não são aguardando_gj (futuro) */}
        {paciente && paciente.status_ficha !== 'aguardando_gj' && (
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => toast('Próximo retorno ainda não implementado.')}
          >
            <Plus className="mr-2 h-4 w-4" />
            + Nova consulta de retorno
          </Button>
        )}
      </div>
    </div>
  );
}
