import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  BarChart3, Download, Loader2, Users, AlertTriangle, ChevronRight,
  FileText, Activity, Baby, Clock, Stethoscope, CheckCircle, HelpCircle,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, differenceInDays } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';

interface Paciente {
  id: string;
  nome: string;
  status_ficha: string;
  created_at: string;
  data_proximo_retorno: string | null;
  profissional_id: string;
  unidade_id: string | null;
  motivo_encerramento?: string | null;
}

interface Consulta {
  id: string;
  paciente_id: string;
  cenario_clinico: string | null;
  tipo: string;
  created_at: string;
}

interface ExameGlicemia {
  id: string;
  paciente_id: string;
  ig_semanas_na_data: number | null;
  consulta_id: string;
}

// Brand palette — NO semantic colors (orange/green/red) on this dashboard
const BRAND = {
  lilas: '#7C4DBA',
  verdaAgua: '#5EEAD4',
  lilasClaro: '#D6BCFA',
  roxoEscuro: '#7E69AB',
  bgBranco: '#FFFFFF',
  bgLavanda: '#F1F0FB',
  bgLavandaDef: '#E5DEFF',
  bgVerdeSuave: '#D1FAE5',
  bgRosaSuave: '#FFF0F6',
  borderCinza: '#E2E8F0',
  borderLilas: '#D6BCFA',
  borderLilasPrimario: '#7C4DBA',
  borderVerdeAgua: '#5EEAD4',
  borderRosa: '#FBCFE8',
  textNumero: '#2D2B55',
  textLabel: '#64748B',
};

const DATE_LOCALES: Record<string, Locale> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es': es,
};

export default function DashboardMetricasPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = DATE_LOCALES[i18n.language] || ptBR;
  const { profissionalData, loading: profLoading } = useProfissionalData();
  const location = useLocation();
  const navigate = useNavigate();
  const isPreview = location.pathname.startsWith('/vitrine');

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [exames, setExames] = useState<ExameGlicemia[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultEnd = new Date();
  const defaultStart = subDays(defaultEnd, 365);
  const [dateStart, setDateStart] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(defaultEnd, 'yyyy-MM-dd'));

  useEffect(() => {
    if (isPreview) {
      setPacientes(generatePreviewData());
      setConsultas(generatePreviewConsultas());
      setExames(generatePreviewExames());
      setLoading(false);
      return;
    }
    if (!profissionalData) { setLoading(false); return; }
    fetchData();
  }, [isPreview, profissionalData]);

  const fetchData = async () => {
    if (!profissionalData) return;
    setLoading(true);

    const isInstitucional = !!profissionalData.unidade_id;

    let pacQuery = supabase.from('pacientes').select('id, nome, status_ficha, created_at, data_proximo_retorno, profissional_id, unidade_id, motivo_encerramento').eq('is_rascunho', false);
    if (isInstitucional) {
      pacQuery = pacQuery.eq('unidade_id', profissionalData.unidade_id!);
    } else {
      pacQuery = pacQuery.eq('profissional_id', profissionalData.id);
    }

    let conQuery = supabase.from('consultas').select('id, paciente_id, cenario_clinico, tipo, created_at');
    if (!isInstitucional) {
      conQuery = conQuery.eq('profissional_id', profissionalData.id);
    }

    let exQuery = supabase.from('exames_glicemia').select('id, paciente_id, ig_semanas_na_data, consulta_id');
    if (!isInstitucional) {
      exQuery = exQuery.eq('profissional_id', profissionalData.id);
    }

    const [pacRes, conRes, exRes] = await Promise.all([pacQuery, conQuery, exQuery]);

    const pacs = (pacRes.data as Paciente[]) || [];
    setPacientes(pacs);

    let filteredConsultas = (conRes.data as Consulta[]) || [];
    if (isInstitucional && pacRes.data) {
      const patientIds = new Set(pacRes.data.map((p: any) => p.id));
      filteredConsultas = filteredConsultas.filter(c => patientIds.has(c.paciente_id));
    }
    setConsultas(filteredConsultas);

    let filteredExames = (exRes.data as ExameGlicemia[]) || [];
    if (isInstitucional && pacRes.data) {
      const patientIds = new Set(pacRes.data.map((p: any) => p.id));
      filteredExames = filteredExames.filter(e => patientIds.has(e.paciente_id));
    }
    setExames(filteredExames);
    setLoading(false);
  };

  // Filter by date range
  const filteredPacientes = useMemo(() => {
    const start = new Date(dateStart);
    const end = new Date(dateEnd);
    end.setHours(23, 59, 59);
    return pacientes.filter(p => {
      const d = new Date(p.created_at);
      return d >= start && d <= end;
    });
  }, [pacientes, dateStart, dateEnd]);

  const allPacientesCount = filteredPacientes.length;

  // --- VISÃO GERAL: 6 status cards ---
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      aguardando_gj: 0,
      aguardando_gtt: 0,
      dmg_confirmado: 0,
      dmg_afastado: 0,
      resultado_parto: 0,
      encaminhada_endocrino: 0,
    };
    filteredPacientes.forEach(p => {
      if (counts[p.status_ficha] !== undefined) counts[p.status_ficha]++;
    });
    return counts;
  }, [filteredPacientes]);

  const pct = (n: number) => allPacientesCount > 0 ? Math.round((n / allPacientesCount) * 100) : 0;

  // Operational bar data
  const retornosVencidos = pacientes.filter(p => {
    if (!p.data_proximo_retorno) return false;
    return differenceInDays(new Date(), new Date(p.data_proximo_retorno)) > 0;
  }).length;

  const laudosUsados = isPreview ? 5 : (profissionalData?.laudos_usados ?? 0);
  const laudosLimite = isPreview ? 50 : (profissionalData?.laudos_limite ?? 3);

  // --- DIAGNÓSTICO ---
  const dmgConfirmados = filteredPacientes.filter(p =>
    p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino' || p.status_ficha === 'resultado_parto'
  );
  const dmgCount = dmgConfirmados.length;

  const filteredConsultas = useMemo(() => {
    const patientIds = new Set(filteredPacientes.map(p => p.id));
    return consultas.filter(c => patientIds.has(c.paciente_id));
  }, [consultas, filteredPacientes]);

  // Formato do cenário é CRU no banco ('1','6','6B','8','3','7'), não 'cenario_1'.
  // (Mesmo bug corrigido no admin #57 — aqui nunca tinha sido.) Normaliza p/ maiúsculo.
  const cc = (c: Consulta) => (c.cenario_clinico ?? '').toUpperCase();
  const ehGtt = (c: Consulta) => cc(c) === '6' || cc(c) === '6B';

  // DMG na GJ: cenário 1, ou 8 (overt) no retorno_1
  const dmgByGJ = filteredConsultas.filter(c =>
    cc(c) === '1' || (cc(c) === '8' && c.tipo === 'retorno_1')
  ).length;

  // DMG no GTT 75g: cenário 6 ou 6B
  const dmgByGTT = filteredConsultas.filter(ehGtt).length;

  const dmgAfastado = filteredPacientes.filter(p => p.status_ficha === 'dmg_afastado').length;

  // Pie chart — diagnosis moment
  const filteredExames = useMemo(() => {
    const patientIds = new Set(filteredPacientes.map(p => p.id));
    return exames.filter(e => patientIds.has(e.paciente_id));
  }, [exames, filteredPacientes]);

  const gttNormal = filteredConsultas.filter(c => {
    if (!ehGtt(c)) return false;
    const ex = filteredExames.find(e => e.consulta_id === c.id);
    return !ex || !ex.ig_semanas_na_data || ex.ig_semanas_na_data <= 28;
  }).length;

  const gttTardio = filteredConsultas.filter(c => {
    if (!ehGtt(c)) return false;
    const ex = filteredExames.find(e => e.consulta_id === c.id);
    return ex && ex.ig_semanas_na_data && ex.ig_semanas_na_data > 28;
  }).length;

  const diagPieData = [
    { name: t('dashboardMetricas.pie.diagGj'), value: dmgByGJ, color: BRAND.lilas },
    { name: t('dashboardMetricas.pie.gttNormal'), value: gttNormal, color: BRAND.verdaAgua },
    { name: t('dashboardMetricas.pie.gttTardio'), value: gttTardio, color: BRAND.lilasClaro },
  ].filter(d => d.value > 0);

  // --- TRATAMENTO ---
  const patientsWithInsulin = new Set(
    filteredConsultas
      .filter(c => cc(c) === '3' || cc(c) === '7')
      .map(c => c.paciente_id)
  );
  const withInsulin = patientsWithInsulin.size;
  const endocrino = filteredPacientes.filter(p => p.status_ficha === 'encaminhada_endocrino').length;
  const dietOnly = dmgConfirmados.filter(p => !patientsWithInsulin.has(p.id)).length;

  const dmgTratamento = dmgCount > 0 ? dmgCount : 1;
  const dietOnlyPercent = Math.round((dietOnly / dmgTratamento) * 100);
  const withInsulinPercent = Math.round((withInsulin / dmgTratamento) * 100);
  const endocrinoPercent = Math.round((endocrino / dmgTratamento) * 100);

  // --- ENCERRAMENTOS & ACOMPANHAMENTO ---
  // Motivo derivado: status resultado_parto → parto; encaminhada_endocrino ou
  // motivo insulinizacao → insulinização; senão o motivo_encerramento cru.
  const motivoDe = (p: Paciente): string | null => {
    if (p.status_ficha === 'resultado_parto') return 'parto';
    if (p.status_ficha === 'encaminhada_endocrino' || p.motivo_encerramento === 'insulinizacao') return 'insulinizacao';
    return p.motivo_encerramento ?? null;
  };
  const encerramentos = { parto: 0, aborto: 0, insulinizacao: 0, nao_retornou: 0, outro: 0 };
  let encerradasCount = 0;
  filteredPacientes.forEach(p => {
    const m = motivoDe(p);
    if (m && (m in encerramentos)) {
      encerramentos[m as keyof typeof encerramentos]++;
      encerradasCount++;
    }
  });
  const ativasCount = Math.max(allPacientesCount - encerradasCount, 0);
  const naoRetornouTaxa = encerradasCount > 0 ? Math.round((encerramentos.nao_retornou / encerradasCount) * 100) : 0;
  const taxaDmg = allPacientesCount > 0 ? Math.round((dmgCount / allPacientesCount) * 100) : 0;
  const temEncerramentos = encerradasCount > 0;

  // --- EVOLUÇÃO MENSAL ---
  const startDate = new Date(dateStart);
  const endDate = new Date(dateEnd);
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  const showChart = months.length >= 2;

  const monthlyData = useMemo(() => {
    return months.map(m => {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const monthPacs = pacientes.filter(p => {
        const d = new Date(p.created_at);
        return isWithinInterval(d, { start: mStart, end: mEnd });
      });
      const total = monthPacs.length;
      const dmg = monthPacs.filter(p =>
        p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino' || p.status_ficha === 'resultado_parto'
      ).length;
      return {
        name: format(m, 'MMM/yy', { locale: dateLocale }),
        novas: total - dmg,
        dmg,
      };
    });
  }, [pacientes, months, dateLocale]);

  // PDF export
  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    const el = document.getElementById('dashboard-metricas-content');
    if (!el) return;

    const canvas = await html2canvas(el, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();

    pdf.setFontSize(16);
    pdf.text(t('dashboardMetricas.pdf.title', { nome: isPreview ? 'Mari' : profissionalData?.nome || '' }), 14, 20);
    pdf.setFontSize(10);
    pdf.text(t('dashboardMetricas.pdf.period', { inicio: format(new Date(dateStart), 'dd/MM/yyyy'), fim: format(new Date(dateEnd), 'dd/MM/yyyy') }), 14, 28);
    pdf.text(t('dashboardMetricas.pdf.generatedOn', { data: format(new Date(), 'dd/MM/yyyy HH:mm') }), 14, 34);

    const imgW = pdfW - 28;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(imgData, 'PNG', 14, 42, imgW, imgH);

    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8);
    pdf.text(t('dashboardMetricas.pdf.generatedBy', { data: format(new Date(), 'dd/MM/yyyy HH:mm') }), 14, pageH - 10);

    pdf.save(`dashboard-clinico-${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if ((profLoading || loading) && !isPreview) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!loading && pacientes.length === 0 && !isPreview) {
    return (
      <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: '#F8FAFC', borderColor: BRAND.borderCinza }}>
        <BarChart3 className="mx-auto h-14 w-14" style={{ color: '#94A3B8' }} />
        <p className="mt-4 text-lg font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: BRAND.textNumero }}>
          {t('dashboardMetricas.empty.title')}
        </p>
        <p className="mt-1 text-sm" style={{ color: BRAND.textLabel }}>
          {t('dashboardMetricas.empty.desc')}
        </p>
      </div>
    );
  }

  const renderLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (!value || value === 0) return null;
    return (
      <text x={x + width / 2} y={y + height / 2} fill="#FFFFFF" textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
        {value}
      </text>
    );
  };

  const handleRetornosClick = () => {
    navigate(isPreview ? '/vitrine/dashboard' : '/dashboard');
  };

  // ---- Modal com lista de pacientes por card ----------------------------
  const [lista, setLista] = useState<{ titulo: string; pacientes: Paciente[] } | null>(null);
  const abrirLista = (titulo: string, pacientes: Paciente[]) => {
    if (!pacientes.length) return;
    setLista({ titulo, pacientes });
  };
  const irParaPaciente = (id: string) => {
    if (isPreview) return;
    navigate(`/paciente/${id}`);
    setLista(null);
  };

  // Listas derivadas por card (Visão Geral por status_ficha)
  const pacsByStatus = (status: string) => filteredPacientes.filter(p => p.status_ficha === status);
  const pacsDmgConfirmado = filteredPacientes.filter(p => p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino');

  // Diagnóstico — usa consulta_id p/ inferir origem
  const patientIdsByGJ = new Set(filteredConsultas.filter(c => cc(c) === '1' || (cc(c) === '8' && c.tipo === 'retorno_1')).map(c => c.paciente_id));
  const patientIdsByGTT = new Set(filteredConsultas.filter(ehGtt).map(c => c.paciente_id));
  const pacsDmgByGJ = filteredPacientes.filter(p => patientIdsByGJ.has(p.id));
  const pacsDmgByGTT = filteredPacientes.filter(p => patientIdsByGTT.has(p.id));
  const pacsDmgAfastado = filteredPacientes.filter(p => p.status_ficha === 'dmg_afastado');
  // "Aguardando diagnóstico" = pacientes ainda sem desfecho diagnóstico
  const pacsAguardandoDiagnostico = filteredPacientes.filter(p =>
    p.status_ficha === 'aguardando_gj' || p.status_ficha === 'aguardando_gtt'
  );
  const aguardandoDiagnosticoCount = pacsAguardandoDiagnostico.length;

  // Tratamento
  const pacsDietOnly = pacsDmgConfirmado.filter(p => !patientsWithInsulin.has(p.id));
  const pacsWithInsulin = filteredPacientes.filter(p => patientsWithInsulin.has(p.id));
  const pacsEndocrino = filteredPacientes.filter(p => p.status_ficha === 'encaminhada_endocrino');

  // Encerramentos
  const pacsAtivas = filteredPacientes.filter(p => !motivoDe(p));
  const pacsPorMotivo = (m: string) => filteredPacientes.filter(p => motivoDe(p) === m);
  const pacsEncerradas = filteredPacientes.filter(p => !!motivoDe(p));


  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header — mesma estrutura do admin (título + subtítulo + ações à direita) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-[26px] font-bold leading-tight"
            style={{ fontFamily: 'Sora, sans-serif', color: '#1E293B' }}
          >
            {t('dashboardMetricas.title')}
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {t('dashboardMetricas.kpi.trackedSub')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-[150px] text-sm" />
          <span className="text-sm" style={{ color: '#94A3B8' }}>{t('dashboardMetricas.dateRangeSep')}</span>
          <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-[150px] text-sm" />
          <Button
            size="sm"
            onClick={handleExportPDF}
            className="h-9 bg-[#7C4DBA] text-white hover:bg-[#6A3FA0]"
          >
            <Download className="mr-1 h-4 w-4" /> {t('dashboardMetricas.exportPdf')}
          </Button>
        </div>
      </div>

      {/* 2. Barra operacional — chips discretos alinhados à direita */}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={handleRetornosClick}
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-90"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            backgroundColor: retornosVencidos > 0 ? '#FEF2F2' : '#F8FAFC',
            borderColor: retornosVencidos > 0 ? '#FCA5A5' : '#E2E8F0',
            color: retornosVencidos > 0 ? '#B91C1C' : '#64748B',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('dashboardMetricas.overdueReturns', { count: retornosVencidos })}
        </button>
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            backgroundColor: '#F8FAFC',
            borderColor: '#E2E8F0',
            color: '#64748B',
          }}
        >
          <FileText className="h-3.5 w-3.5" />
          {t('dashboardMetricas.reportsGenerated', { usados: laudosUsados, limite: laudosLimite })}
        </div>
      </div>

      <div id="dashboard-metricas-content" className="flex flex-col gap-8">
        {/* KPIs principais — cards brancos limpos, idênticos ao admin */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <AdminMetricaCard
            label={t('dashboardMetricas.kpi.tracked')}
            valor={allPacientesCount}
            sublabel={t('dashboardMetricas.kpi.trackedSub')}
          />
          <AdminMetricaCard
            label={t('dashboardMetricas.kpi.dmgRate')}
            valor={`${taxaDmg}%`}
            sublabel={t('dashboardMetricas.kpi.dmgRateSub', { count: dmgCount })}
            cor={BRAND.lilas}
          />
          <AdminMetricaCard
            label={t('dashboardMetricas.kpi.active')}
            valor={ativasCount}
            sublabel={t('dashboardMetricas.kpi.activeSub')}
          />
          <AdminMetricaCard
            label={t('dashboardMetricas.kpi.overdue')}
            valor={retornosVencidos}
            sublabel={t('dashboardMetricas.kpi.overdueSub')}
            cor={retornosVencidos > 0 ? '#DC2626' : '#94A3B8'}
            onClick={retornosVencidos > 0 ? handleRetornosClick : undefined}
          />
        </div>

        {/* Visão Geral — 6 status clínicos como cards limpos com bolinha colorida */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.overview')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CleanStatCard dotColor="#94A3B8" icon={Clock} label={t('dashboardMetricas.overview.awaitingGj')} value={statusCounts.aguardando_gj} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.aguardando_gj) })} onClick={() => abrirLista(t('dashboardMetricas.overview.awaitingGj'), pacsByStatus('aguardando_gj'))} />
            <CleanStatCard dotColor="#3B82F6" icon={Clock} label={t('dashboardMetricas.overview.awaitingGtt')} value={statusCounts.aguardando_gtt} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.aguardando_gtt) })} onClick={() => abrirLista(t('dashboardMetricas.overview.awaitingGtt'), pacsByStatus('aguardando_gtt'))} />
            <CleanStatCard dotColor={BRAND.lilas} icon={Activity} label={t('dashboardMetricas.overview.dmgConfirmed')} value={statusCounts.dmg_confirmado + statusCounts.encaminhada_endocrino} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.dmg_confirmado + statusCounts.encaminhada_endocrino) })} onClick={() => abrirLista(t('dashboardMetricas.overview.dmgConfirmed'), pacsDmgConfirmado)} />
            <CleanStatCard dotColor={BRAND.verdaAgua} icon={CheckCircle} label={t('dashboardMetricas.overview.dmgRuledOut')} value={statusCounts.dmg_afastado} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.dmg_afastado) })} onClick={() => abrirLista(t('dashboardMetricas.overview.dmgRuledOut'), pacsByStatus('dmg_afastado'))} />
            <CleanStatCard dotColor={BRAND.roxoEscuro} icon={Baby} label={t('dashboardMetricas.overview.deliveryResult')} value={statusCounts.resultado_parto} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.resultado_parto) })} onClick={() => abrirLista(t('dashboardMetricas.overview.deliveryResult'), pacsByStatus('resultado_parto'))} />
            <CleanStatCard dotColor="#F472B6" icon={Stethoscope} label={t('dashboardMetricas.overview.associateEndo')} value={statusCounts.encaminhada_endocrino} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.encaminhada_endocrino) })} onClick={() => abrirLista(t('dashboardMetricas.overview.associateEndo'), pacsByStatus('encaminhada_endocrino'))} />
          </div>
        </section>

        {/* Diagnóstico — cards + gráfico dentro de CardContainer */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.diagnosis')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <CleanStatCard dotColor="#94A3B8" icon={Users} label={t('dashboardMetricas.diagnosis.totalPatients')} value={allPacientesCount} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.totalPatients'), filteredPacientes)} />
            <CleanStatCard dotColor={BRAND.lilas} icon={Activity} label={t('dashboardMetricas.diagnosis.dmgConfirmedGj')} value={dmgByGJ} detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((dmgByGJ / allPacientesCount) * 100) : 0 })} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.dmgConfirmedGj'), pacsDmgByGJ)} />
            <CleanStatCard dotColor={BRAND.roxoEscuro} icon={Activity} label={t('dashboardMetricas.diagnosis.dmgConfirmedGtt')} value={dmgByGTT} detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((dmgByGTT / allPacientesCount) * 100) : 0 })} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.dmgConfirmedGtt'), pacsDmgByGTT)} />
            <CleanStatCard dotColor={BRAND.verdaAgua} icon={CheckCircle} label={t('dashboardMetricas.diagnosis.dmgRuledOutGtt')} value={dmgAfastado} detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((dmgAfastado / allPacientesCount) * 100) : 0 })} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.dmgRuledOutGtt'), pacsDmgAfastado)} />
            <CleanStatCard
              dotColor="#F59E0B"
              icon={HelpCircle}
              label={t('dashboardMetricas.diagnosis.awaitingDiagnosis', 'Aguardando diagnóstico')}
              value={aguardandoDiagnosticoCount}
              detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((aguardandoDiagnosticoCount / allPacientesCount) * 100) : 0 })}
              onClick={() => abrirLista(t('dashboardMetricas.diagnosis.awaitingDiagnosis', 'Aguardando diagnóstico'), pacsAguardandoDiagnostico)}
            />
          </div>

          {diagPieData.length > 0 && (
            <AdminChartCard title={t('dashboardMetricas.pie.title')}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={diagPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} isAnimationActive={false} stroke="#FFFFFF" strokeWidth={2}>
                    {diagPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </AdminChartCard>
          )}
        </section>

        {/* Tratamento */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.treatment')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CleanStatCard dotColor={BRAND.verdaAgua} icon={CheckCircle} label={t('dashboardMetricas.treatment.dietOnly')} value={dietOnly} detail={t('dashboardMetricas.pctOfDmg', { pct: dietOnlyPercent })} onClick={() => abrirLista(t('dashboardMetricas.treatment.dietOnly'), pacsDietOnly)} />
            <CleanStatCard dotColor={BRAND.lilas} icon={Activity} label={t('dashboardMetricas.treatment.withInsulin')} value={withInsulin} detail={t('dashboardMetricas.pctOfDmg', { pct: withInsulinPercent })} onClick={() => abrirLista(t('dashboardMetricas.treatment.withInsulin'), pacsWithInsulin)} />
            <CleanStatCard dotColor={BRAND.roxoEscuro} icon={Stethoscope} label={t('dashboardMetricas.treatment.withEndo')} value={endocrino} detail={t('dashboardMetricas.pctOfDmg', { pct: endocrinoPercent })} onClick={() => abrirLista(t('dashboardMetricas.treatment.withEndo'), pacsEndocrino)} />
          </div>
        </section>

        {/* Encerramentos & acompanhamento */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.closures')}</AdminSectionTitle>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <CleanStatCard dotColor="#0EA5A5" icon={CheckCircle} label={t('dashboardMetricas.closures.active')} value={ativasCount} detail={t('dashboardMetricas.closures.activeDetail')} onClick={() => abrirLista(t('dashboardMetricas.closures.active'), pacsAtivas)} />
            <CleanStatCard dotColor={BRAND.roxoEscuro} icon={Baby} label={t('dashboardMetricas.closures.delivery')} value={encerramentos.parto} onClick={() => abrirLista(t('dashboardMetricas.closures.delivery'), pacsPorMotivo('parto'))} />
            <CleanStatCard dotColor="#F472B6" icon={Stethoscope} label={t('dashboardMetricas.closures.toEndo')} value={encerramentos.insulinizacao} onClick={() => abrirLista(t('dashboardMetricas.closures.toEndo'), pacsPorMotivo('insulinizacao'))} />
            <CleanStatCard dotColor="#94A3B8" icon={Activity} label={t('dashboardMetricas.closures.miscarriage')} value={encerramentos.aborto} onClick={() => abrirLista(t('dashboardMetricas.closures.miscarriage'), pacsPorMotivo('aborto'))} />
            <CleanStatCard dotColor="#94A3B8" icon={Clock} label={t('dashboardMetricas.closures.noReturn')} value={encerramentos.nao_retornou} detail={temEncerramentos ? t('dashboardMetricas.closures.noReturnRate', { pct: naoRetornouTaxa }) : undefined} onClick={() => abrirLista(t('dashboardMetricas.closures.noReturn'), pacsPorMotivo('nao_retornou'))} />
            <CleanStatCard dotColor="#94A3B8" icon={Users} label={t('dashboardMetricas.closures.total')} value={encerradasCount} onClick={() => abrirLista(t('dashboardMetricas.closures.total'), pacsEncerradas)} />
          </div>
        </section>


        {/* Evolução Mensal */}
        {showChart && (
          <AdminChartCard title={t('dashboardMetricas.chart.title')}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: BRAND.textLabel }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: BRAND.textLabel }} allowDecimals={false} axisLine={false} tickLine={false} />
                <RechartsTooltip />
                <Legend iconType="circle" wrapperStyle={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }} />
                <Bar dataKey="novas" name={t('dashboardMetricas.chart.newPatients')} stackId="a" fill={BRAND.lilas} radius={[0, 0, 0, 0]}>
                  <LabelList dataKey="novas" content={renderLabel} />
                </Bar>
                <Bar dataKey="dmg" name={t('dashboardMetricas.chart.dmgConfirmed')} stackId="a" fill={BRAND.roxoEscuro} radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="dmg" content={renderLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AdminChartCard>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Componentes de UI alinhados à família visual do ADMIN
// (mesmo card branco, mesma tipografia, mesmo comportamento de hover).
// -----------------------------------------------------------------------------

function AdminMetricaCard({
  label,
  valor,
  sublabel,
  cor,
  onClick,
}: {
  label: string;
  valor: string | number;
  sublabel?: string;
  cor?: string;
  onClick?: () => void;
}) {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border bg-white p-5 text-left shadow-sm transition-all ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      style={{ borderColor: '#E2E8F0' }}
    >
      <div
        className="text-sm"
        style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[32px] leading-none font-bold"
        style={{ color: cor ?? '#1E293B', fontFamily: 'Sora, sans-serif' }}
      >
        {valor}
      </div>
      {sublabel && (
        <div
          className="mt-2 text-xs"
          style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {sublabel}
        </div>
      )}
    </Tag>
  );
}

function CleanStatCard({
  icon: Icon,
  label,
  value,
  detail,
  dotColor,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  detail?: string;
  dotColor: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick && value > 0;
  const Tag: any = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={clickable ? onClick : undefined}
      className={`group relative w-full rounded-xl border bg-white p-5 text-left shadow-sm transition-all ${clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#C4B5FD] hover:shadow-md' : ''}`}
      style={{ borderColor: '#E2E8F0' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: `${dotColor}1A` }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: dotColor }} />
        </span>
        <span
          className="text-sm"
          style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {label}
        </span>
        {clickable && (
          <ChevronRight
            className="ml-auto h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: '#94A3B8' }}
          />
        )}
      </div>
      <p
        className="text-[28px] font-bold leading-none"
        style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
      >
        {value}
      </p>
      {detail && (
        <p
          className="mt-2 text-xs"
          style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {detail}
        </p>
      )}
    </Tag>
  );
}


function AdminSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-lg font-semibold"
      style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
    >
      {children}
    </h2>
  );
}

function AdminChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderColor: '#E2E8F0' }}
    >
      <h3
        className="mb-4 text-base font-semibold"
        style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ==========================================================================
// PREVIEW DATA — 8 pacientes fictícias com dados internamente consistentes
// TODO: remover mock e conectar ao Supabase quando em produção
// ==========================================================================

/*
 * Paciente 1 - Moara de Carvalho:       DMG confirmado (GJ ≥92, cenário 1) — Mar/26
 * Paciente 2 - Maria Luísa Ferreira:    Aguardando GJ (caso novo registrada) — Abr/26
 * Paciente 3 - Ana Carolina Souza:      Aguardando GTT 75g (GJ <92 no retorno 1) — Mar/26
 * Paciente 4 - Juliana de Oliveira:     DMG afastado (GTT 75g normal, IG 25sem) — Fev/26
 * Paciente 5 - Patrícia Almeida Santos: DMG confirmado (GTT 75g alterado, IG 26sem, cenário 6) — Fev/26
 * Paciente 6 - Camila Rodrigues:        DMG confirmado (GTT 75g alterado tardio, IG 30sem, cenário 6b) — Mar/26
 * Paciente 7 - Fernanda Costa Lima:     Resultado do parto (DMG na GJ, cenário 1, parto) — Fev/26
 * Paciente 8 - Beatriz Mendes:          Associar endocrino (GTT 75g alterado, cenário 6 + cenário 7 insulina) — Mar/26
 *
 * Visão Geral: Ag.GJ=1, Ag.GTT 75g=1, DMG confirmado=3 (Moara+Patrícia+Camila), DMG afastado=1, Parto=1, Endocrino=1
 * Diagnóstico: Total=8, DMG na GJ=2 (Moara+Fernanda), DMG no GTT 75g=3 (Patrícia+Camila+Beatriz), DMG afastado GTT 75g=1 (Juliana)
 * Pizza: GJ=2(40%), GTT 75g 24-28=2(40%) (Patrícia+Beatriz), GTT 75g tardio=1(20%) (Camila)
 * Tratamento: Dieta=1 (Moara), Insulina=2 (Camila+Beatriz), Endocrino=1 (Beatriz)
 * Desfechos: 1 parto (Fernanda)
 * Evolução: Fev=3(2 DMG), Mar=4(3 DMG), Abr=1(0 DMG)
 */

function generatePreviewData(): Paciente[] {
  return [
    { id: 'p1', nome: 'Moara de Carvalho', status_ficha: 'dmg_confirmado', created_at: '2026-03-10T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p2', nome: 'Maria Luísa Ferreira', status_ficha: 'aguardando_gj', created_at: '2026-04-05T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p3', nome: 'Ana Carolina Souza', status_ficha: 'aguardando_gtt', created_at: '2026-03-15T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p4', nome: 'Juliana de Oliveira', status_ficha: 'dmg_afastado', created_at: '2026-02-12T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p5', nome: 'Patrícia Almeida Santos', status_ficha: 'dmg_confirmado', created_at: '2026-02-20T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p6', nome: 'Camila Rodrigues', status_ficha: 'dmg_confirmado', created_at: '2026-03-22T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p7', nome: 'Fernanda Costa Lima', status_ficha: 'resultado_parto', created_at: '2026-02-05T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p8', nome: 'Beatriz Mendes', status_ficha: 'encaminhada_endocrino', created_at: '2026-03-28T10:00:00Z', data_proximo_retorno: '2026-04-10T10:00:00Z', profissional_id: 'preview', unidade_id: null },
  ];
}

function generatePreviewConsultas(): Consulta[] {
  return [
    // Moara (p1): Caso Novo → Retorno 1 com GJ ≥92 → cenário 1
    { id: 'c1a', paciente_id: 'p1', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-10T10:00:00Z' },
    { id: 'c1b', paciente_id: 'p1', cenario_clinico: '1', tipo: 'retorno_1', created_at: '2026-03-17T10:00:00Z' },

    // Maria Luísa (p2): Apenas caso novo
    { id: 'c2a', paciente_id: 'p2', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-04-05T10:00:00Z' },

    // Ana Carolina (p3): Caso Novo → Retorno 1 GJ <92 → aguardando GTT 75g
    { id: 'c3a', paciente_id: 'p3', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-15T10:00:00Z' },
    { id: 'c3b', paciente_id: 'p3', cenario_clinico: '2', tipo: 'retorno_1', created_at: '2026-03-22T10:00:00Z' },

    // Juliana (p4): Caso Novo → Retorno 1 GJ <92 → GTT 75g normal → cenário 5 (afastado)
    { id: 'c4a', paciente_id: 'p4', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-02-12T10:00:00Z' },
    { id: 'c4b', paciente_id: 'p4', cenario_clinico: '2', tipo: 'retorno_1', created_at: '2026-02-19T10:00:00Z' },
    { id: 'c4c', paciente_id: 'p4', cenario_clinico: '5', tipo: 'retorno_2', created_at: '2026-03-05T10:00:00Z' },

    // Patrícia (p5): GTT 75g alterado IG 26sem → cenário 6
    { id: 'c5a', paciente_id: 'p5', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-02-20T10:00:00Z' },
    { id: 'c5b', paciente_id: 'p5', cenario_clinico: '2', tipo: 'retorno_1', created_at: '2026-02-27T10:00:00Z' },
    { id: 'c5c', paciente_id: 'p5', cenario_clinico: '6', tipo: 'retorno_2', created_at: '2026-03-15T10:00:00Z' },

    // Camila (p6): GTT 75g alterado tardio IG 30sem → cenário 6b
    { id: 'c6a', paciente_id: 'p6', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-22T10:00:00Z' },
    { id: 'c6b', paciente_id: 'p6', cenario_clinico: '2', tipo: 'retorno_1', created_at: '2026-03-29T10:00:00Z' },
    { id: 'c6c', paciente_id: 'p6', cenario_clinico: '6B', tipo: 'retorno_2', created_at: '2026-04-08T10:00:00Z' },
    // Camila also has insulin
    { id: 'c6d', paciente_id: 'p6', cenario_clinico: '3', tipo: 'retorno_3', created_at: '2026-04-10T10:00:00Z' },

    // Fernanda (p7): DMG na GJ → cenário 1 → parto
    { id: 'c7a', paciente_id: 'p7', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-02-05T10:00:00Z' },
    { id: 'c7b', paciente_id: 'p7', cenario_clinico: '1', tipo: 'retorno_1', created_at: '2026-02-12T10:00:00Z' },

    // Beatriz (p8): GTT 75g alterado → cenário 6 → insulina → cenário 7 (endocrino)
    { id: 'c8a', paciente_id: 'p8', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-28T10:00:00Z' },
    { id: 'c8b', paciente_id: 'p8', cenario_clinico: '2', tipo: 'retorno_1', created_at: '2026-04-04T10:00:00Z' },
    { id: 'c8c', paciente_id: 'p8', cenario_clinico: '6', tipo: 'retorno_2', created_at: '2026-04-08T10:00:00Z' },
    { id: 'c8d', paciente_id: 'p8', cenario_clinico: '7', tipo: 'retorno_3', created_at: '2026-04-10T10:00:00Z' },
  ];
}

function generatePreviewExames(): ExameGlicemia[] {
  return [
    // Patrícia (p5): GTT 75g at 26 weeks (normal range 24-28)
    { id: 'ex5', paciente_id: 'p5', ig_semanas_na_data: 26, consulta_id: 'c5c' },
    // Camila (p6): GTT 75g at 30 weeks (tardio >28)
    { id: 'ex6', paciente_id: 'p6', ig_semanas_na_data: 30, consulta_id: 'c6c' },
    // Beatriz (p8): GTT 75g at 26 weeks (normal range 24-28)
    { id: 'ex8', paciente_id: 'p8', ig_semanas_na_data: 26, consulta_id: 'c8c' },
  ];
}
