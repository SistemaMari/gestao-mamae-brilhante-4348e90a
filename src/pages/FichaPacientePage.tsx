import { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
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
  encaminhada_endocrino: { label: 'Encaminhada — endocrino', color: 'bg-red-500' },
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

    // Real mode
    (async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', id)
        .single();

      if (pac) {
        setPaciente({
          ...pac,
          data_nascimento: (pac as any).data_nascimento || null,
          consultas: [],
        } as any);

        const { data: cons } = await supabase
          .from('consultas' as any)
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

  // Current IG: from consulta 1 IG + days elapsed
  const igAtual = useMemo(() => {
    if (!consultas.length) return null;
    const c1 = consultas.find((c) => c.tipo === 'consulta_1');
    if (!c1 || c1.ig_semanas == null) return null;
    const diasC1 = c1.ig_semanas * 7 + (c1.ig_dias || 0);
    const elapsed = differenceInDays(new Date(), new Date(c1.data));
    const totalDias = diasC1 + elapsed;
    return { semanas: Math.floor(totalDias / 7), dias: totalDias % 7 };
  }, [consultas]);

  // DUM calculada
  const dumCalculada = useMemo(() => {
    if (!consultas.length) return null;
    const c1 = consultas.find((c) => c.tipo === 'consulta_1');
    if (!c1 || c1.ig_semanas == null) return null;
    const totalDias = c1.ig_semanas * 7 + (c1.ig_dias || 0);
    return addDays(new Date(c1.data), -totalDias);
  }, [consultas]);

  // GTT window: 24-28 weeks from DUM
  const janelaGTT = useMemo(() => {
    if (!dumCalculada) return null;
    const inicio = addDays(dumCalculada, 24 * 7);
    const fim = addDays(dumCalculada, 28 * 7);
    return { inicio, fim };
  }, [dumCalculada]);

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

  const primeiraConsulta = consultas.find((c) => c.tipo === 'consulta_1');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-xl font-bold text-foreground">{paciente.nome}</h1>
          {status && (
            <Badge className={`${status.color} text-white border-0 shrink-0`}>
              {status.label}
            </Badge>
          )}
        </div>

        {/* Dados da paciente */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {paciente.data_nascimento && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Nascimento:</span>{' '}
                {format(new Date(paciente.data_nascimento), 'dd/MM/yyyy')}
                {idade !== null && ` (${idade} anos)`}
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
          {igAtual && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">IG atual:</span>{' '}
                {igAtual.semanas}s {igAtual.dias}d
              </span>
            </div>
          )}
          {primeiraConsulta && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">Data da consulta:</span>{' '}
                {format(new Date(primeiraConsulta.data), 'dd/MM/yyyy')}
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
          {dumCalculada && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="font-medium text-foreground">DUM calculada:</span>{' '}
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

      {/* DMG anterior banner */}
      {paciente.dmg_gestacao_anterior && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              ⚠️ DMG em gestação anterior
            </p>
            <p className="mt-0.5 text-xs text-orange-700">
              Esta paciente já teve diagnóstico de Diabete Mellitus Gestacional em gestação prévia. Atenção redobrada ao rastreamento.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation card — orientações */}
      {paciente.status_ficha === 'aguardando_gj' && (
        <div className="rounded-xl border border-emerald-200 bg-[#DCFCE7] p-5 space-y-4">
          <h2 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Pedido de exame — Consulta 1
          </h2>

          {/* Glicemia de jejum */}
          <div className="rounded-lg bg-white/70 p-3">
            <p className="text-sm font-semibold text-emerald-900">Glicemia de jejum</p>
            <p className="mt-1 text-xs text-emerald-800">
              Solicitar glicemia plasmática de jejum (8-14h de jejum). Resultado esperado antes do próximo retorno.
            </p>
          </div>

          {/* Janela GTT */}
          {janelaGTT && (
            <div className="rounded-lg bg-white/70 p-3">
              <p className="text-sm font-semibold text-emerald-900">Janela para GTT 75g</p>
              <p className="mt-1 text-xs text-emerald-800">
                Se GJ &lt; 92 mg/dL, solicitar GTT 75g entre{' '}
                <strong>{format(janelaGTT.inicio, 'dd/MM/yyyy')}</strong> e{' '}
                <strong>{format(janelaGTT.fim, 'dd/MM/yyyy')}</strong>{' '}
                (24ª a 28ª semana).
              </p>
            </div>
          )}

          {/* Notas técnicas */}
          <div className="rounded-lg bg-white/70 p-3">
            <p className="text-sm font-semibold text-emerald-900">Notas técnicas</p>
            <ul className="mt-1 list-disc pl-4 text-xs text-emerald-800 space-y-0.5">
              <li>GJ ≥ 92 mg/dL → diagnóstico de DMG na primeira consulta</li>
              <li>GJ ≥ 126 mg/dL → diabetes prévio (encaminhar endocrinologia)</li>
              <li>GJ &lt; 92 mg/dL → aguardar GTT na janela indicada</li>
            </ul>
          </div>
        </div>
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

        {/* Botão nova consulta de retorno (placeholder) */}
        <Button
          variant="outline"
          className="mt-4 w-full"
          disabled
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova consulta de retorno (em breve)
        </Button>
      </div>
    </div>
  );
}
