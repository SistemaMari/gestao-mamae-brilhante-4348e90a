import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart3, Download, Loader2, Users, AlertTriangle,
  FileText, Activity, Baby, Clock, Stethoscope, CheckCircle
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  lilas: '#9b87f5',
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
  borderLilasPrimario: '#9b87f5',
  borderVerdeAgua: '#5EEAD4',
  borderRosa: '#FBCFE8',
  textNumero: '#2D2B55',
  textLabel: '#64748B',
};

export default function DashboardMetricasPage() {
  const { profissionalData, loading: profLoading } = useProfissionalData();
  const location = useLocation();
  const navigate = useNavigate();
  const isPreview = location.pathname.startsWith('/vitrine');

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [exames, setExames] = useState<ExameGlicemia[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultEnd = new Date();
  const defaultStart = subDays(defaultEnd, 90);
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

    let pacQuery = supabase.from('pacientes').select('id, nome, status_ficha, created_at, data_proximo_retorno, profissional_id, unidade_id');
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

  // DMG na GJ: cenario_1 or cenario_8 on retorno_1
  const dmgByGJ = filteredConsultas.filter(c =>
    c.cenario_clinico === 'cenario_1' || (c.cenario_clinico === 'cenario_8' && c.tipo === 'retorno_1')
  ).length;

  // DMG no GTT: cenario_6 or cenario_6b
  const dmgByGTT = filteredConsultas.filter(c =>
    c.cenario_clinico === 'cenario_6' || c.cenario_clinico === 'cenario_6b'
  ).length;

  const dmgAfastado = filteredPacientes.filter(p => p.status_ficha === 'dmg_afastado').length;

  // Pie chart — diagnosis moment
  const filteredExames = useMemo(() => {
    const patientIds = new Set(filteredPacientes.map(p => p.id));
    return exames.filter(e => patientIds.has(e.paciente_id));
  }, [exames, filteredPacientes]);

  const gttNormal = filteredConsultas.filter(c => {
    if (c.cenario_clinico !== 'cenario_6' && c.cenario_clinico !== 'cenario_6b') return false;
    const ex = filteredExames.find(e => e.consulta_id === c.id);
    return !ex || !ex.ig_semanas_na_data || ex.ig_semanas_na_data <= 28;
  }).length;

  const gttTardio = filteredConsultas.filter(c => {
    if (c.cenario_clinico !== 'cenario_6' && c.cenario_clinico !== 'cenario_6b') return false;
    const ex = filteredExames.find(e => e.consulta_id === c.id);
    return ex && ex.ig_semanas_na_data && ex.ig_semanas_na_data > 28;
  }).length;

  const diagPieData = [
    { name: 'Diagnóstico na GJ', value: dmgByGJ, color: BRAND.lilas },
    { name: 'GTT (24-28 sem)', value: gttNormal, color: BRAND.verdaAgua },
    { name: 'GTT tardio (>29 sem)', value: gttTardio, color: BRAND.lilasClaro },
  ].filter(d => d.value > 0);

  // --- TRATAMENTO ---
  const patientsWithInsulin = new Set(
    filteredConsultas
      .filter(c => c.cenario_clinico === 'cenario_3' || c.cenario_clinico === 'cenario_7')
      .map(c => c.paciente_id)
  );
  const withInsulin = patientsWithInsulin.size;
  const endocrino = filteredPacientes.filter(p => p.status_ficha === 'encaminhada_endocrino').length;
  const dietOnly = dmgConfirmados.filter(p => !patientsWithInsulin.has(p.id)).length;

  const dmgTratamento = dmgCount > 0 ? dmgCount : 1;
  const dietOnlyPercent = Math.round((dietOnly / dmgTratamento) * 100);
  const withInsulinPercent = Math.round((withInsulin / dmgTratamento) * 100);
  const endocrinoPercent = Math.round((endocrino / dmgTratamento) * 100);

  // --- DESFECHOS ---
  const partoPacientes = filteredPacientes.filter(p => p.status_ficha === 'resultado_parto');
  const hasPartos = partoPacientes.length > 0;

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
        name: format(m, 'MMM/yy', { locale: ptBR }),
        novas: total - dmg,
        dmg,
      };
    });
  }, [pacientes, months]);

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
    pdf.text(`Dashboard Clínico — Dr(a). ${isPreview ? 'Mari' : profissionalData?.nome || ''}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(`Período: ${format(new Date(dateStart), 'dd/MM/yyyy')} a ${format(new Date(dateEnd), 'dd/MM/yyyy')}`, 14, 28);
    pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);

    const imgW = pdfW - 28;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(imgData, 'PNG', 14, 42, imgW, imgH);

    const pageH = pdf.internal.pageSize.getHeight();
    pdf.setFontSize(8);
    pdf.text(`Gerado por Dra. Mari DMG Diagnóstica — ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, pageH - 10);

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
          Seu dashboard aparecerá aqui
        </p>
        <p className="mt-1 text-sm" style={{ color: BRAND.textLabel }}>
          Cadastre pacientes e registre consultas para visualizar suas métricas clínicas.
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

  return (
    <div>
      {/* 1. Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: BRAND.textNumero }}>
          Meu Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-[150px] text-sm" />
          <span className="text-sm text-muted-foreground">a</span>
          <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-[150px] text-sm" />
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* 2. Barra operacional (compacta, alinhada à direita) */}
      <div className="mb-6 flex justify-end gap-3">
        <button
          onClick={handleRetornosClick}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:opacity-80"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '14px',
            backgroundColor: retornosVencidos > 0 ? '#FFF0F6' : 'transparent',
            borderColor: retornosVencidos > 0 ? '#FBCFE8' : BRAND.borderCinza,
            color: retornosVencidos > 0 ? '#9D174D' : '#94A3B8',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Retornos vencidos: {retornosVencidos}
        </button>
        <div
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '14px',
            backgroundColor: BRAND.bgBranco,
            borderColor: BRAND.borderCinza,
            color: BRAND.textLabel,
          }}
        >
          <FileText className="h-3.5 w-3.5" />
          Laudos gerados: {laudosUsados}/{laudosLimite}
        </div>
      </div>

      <div id="dashboard-metricas-content">
        {/* 3. Visão Geral — 6 cards de status clínico (3x2) */}
        <SectionTitle>Visão Geral</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatusCard
            icon={<Clock className="h-4 w-4" style={{ color: BRAND.textLabel }} />}
            label="Aguardando GJ"
            value={statusCounts.aguardando_gj}
            detail={`${pct(statusCounts.aguardando_gj)}% do total`}
            bg={BRAND.bgBranco} border={BRAND.borderCinza}
          />
          <StatusCard
            icon={<Clock className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
            label="Aguardando GTT"
            value={statusCounts.aguardando_gtt}
            detail={`${pct(statusCounts.aguardando_gtt)}% do total`}
            bg={BRAND.bgLavanda} border={BRAND.borderLilas}
          />
          <StatusCard
            icon={<Activity className="h-4 w-4" style={{ color: BRAND.lilas }} />}
            label="DMG confirmado"
            value={statusCounts.dmg_confirmado + statusCounts.encaminhada_endocrino}
            detail={`${pct(statusCounts.dmg_confirmado + statusCounts.encaminhada_endocrino)}% do total`}
            bg={BRAND.bgLavandaDef} border={BRAND.borderLilasPrimario}
          />
          <StatusCard
            icon={<CheckCircle className="h-4 w-4" style={{ color: BRAND.verdaAgua }} />}
            label="DMG afastado"
            value={statusCounts.dmg_afastado}
            detail={`${pct(statusCounts.dmg_afastado)}% do total`}
            bg={BRAND.bgVerdeSuave} border={BRAND.borderVerdeAgua}
          />
          <StatusCard
            icon={<Baby className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
            label="Resultado do parto"
            value={statusCounts.resultado_parto}
            detail={`${pct(statusCounts.resultado_parto)}% do total`}
            bg={BRAND.bgLavanda} border={BRAND.borderLilas}
          />
          <StatusCard
            icon={<Stethoscope className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
            label="Associar endocrino"
            value={statusCounts.encaminhada_endocrino}
            detail={`${pct(statusCounts.encaminhada_endocrino)}% do total`}
            bg={BRAND.bgRosaSuave} border={BRAND.borderRosa}
          />
        </div>

        {/* 4. Diagnóstico */}
        <SectionTitle>Diagnóstico</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatusCard
            icon={<Users className="h-4 w-4" style={{ color: BRAND.textLabel }} />}
            label="Total de pacientes"
            value={allPacientesCount}
            bg={BRAND.bgBranco} border={BRAND.borderCinza}
          />
          <StatusCard
            icon={<Activity className="h-4 w-4" style={{ color: BRAND.lilas }} />}
            label="DMG confirmado na GJ"
            value={dmgByGJ}
            detail={`${allPacientesCount > 0 ? Math.round((dmgByGJ / allPacientesCount) * 100) : 0}% do total`}
            bg={BRAND.bgLavandaDef} border={BRAND.borderLilasPrimario}
          />
          <StatusCard
            icon={<Activity className="h-4 w-4" style={{ color: BRAND.lilas }} />}
            label="DMG confirmado no GTT"
            value={dmgByGTT}
            detail={`${allPacientesCount > 0 ? Math.round((dmgByGTT / allPacientesCount) * 100) : 0}% do total`}
            bg={BRAND.bgLavanda} border={BRAND.borderLilasPrimario}
          />
          <StatusCard
            icon={<CheckCircle className="h-4 w-4" style={{ color: BRAND.verdaAgua }} />}
            label="DMG afastado no GTT"
            value={dmgAfastado}
            detail={`${allPacientesCount > 0 ? Math.round((dmgAfastado / allPacientesCount) * 100) : 0}% do total`}
            bg={BRAND.bgVerdeSuave} border={BRAND.borderVerdeAgua}
          />
        </div>

        {/* Pie: Momento do diagnóstico */}
        {diagPieData.length > 0 && (
          <div className="mb-8 rounded-xl border bg-card p-4" style={{ borderColor: BRAND.borderCinza }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: BRAND.textNumero }}>
              Momento do diagnóstico
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={diagPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {diagPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 5. Tratamento */}
        <SectionTitle>Tratamento</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <StatusCard
            icon={<CheckCircle className="h-4 w-4" style={{ color: BRAND.verdaAgua }} />}
            label="Controle só com dieta"
            value={dietOnly}
            detail={`${dietOnlyPercent}% dos DMG`}
            bg={BRAND.bgVerdeSuave} border={BRAND.borderVerdeAgua}
          />
          <StatusCard
            icon={<Activity className="h-4 w-4" style={{ color: BRAND.lilas }} />}
            label="Pacientes com insulina"
            value={withInsulin}
            detail={`${withInsulinPercent}% dos DMG`}
            bg={BRAND.bgLavanda} border={BRAND.borderLilasPrimario}
          />
          <StatusCard
            icon={<Stethoscope className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
            label="Associadas ao endocrino"
            value={endocrino}
            detail={`${endocrinoPercent}% dos DMG`}
            bg={BRAND.bgRosaSuave} border={BRAND.borderRosa}
          />
        </div>

        {/* 6. Desfechos */}
        <SectionTitle>Desfechos</SectionTitle>
        {!hasPartos ? (
          <div className="rounded-xl border bg-card p-8 text-center mb-8" style={{ borderColor: BRAND.borderCinza }}>
            <Baby className="mx-auto h-10 w-10" style={{ color: '#94A3B8' }} />
            <p className="mt-2 text-sm" style={{ color: BRAND.textLabel }}>
              Nenhum registro de parto no período selecionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <StatusCard
              icon={<Baby className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
              label="Partos registrados"
              value={partoPacientes.length}
              bg={BRAND.bgLavanda} border={BRAND.borderLilas}
            />
          </div>
        )}

        {/* 7. Evolução Mensal (stacked bars — LAST) */}
        {showChart && (
          <div className="mb-8 rounded-xl border bg-card p-4" style={{ borderColor: BRAND.borderCinza }}>
            <h2 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: BRAND.textNumero }}>
              Evolução mensal
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: BRAND.textLabel }} />
                <YAxis tick={{ fontSize: 12, fill: BRAND.textLabel }} allowDecimals={false} />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="novas" name="Novas pacientes" stackId="a" fill={BRAND.lilas} radius={[0, 0, 0, 0]}>
                  <LabelList dataKey="novas" content={renderLabel} />
                </Bar>
                <Bar dataKey="dmg" name="DMG confirmado" stackId="a" fill={BRAND.roxoEscuro} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="dmg" content={renderLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// --- StatusCard component ---
function StatusCard({ icon, label, value, detail, bg, border }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail?: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm" style={{ color: BRAND.textLabel, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{label}</span>
      </div>
      <p className="text-[28px] font-bold" style={{ color: BRAND.textNumero }}>{value}</p>
      {detail && <p className="text-sm mt-1" style={{ color: BRAND.textLabel }}>{detail}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: BRAND.textNumero }}>
      {children}
    </h2>
  );
}

// ==========================================================================
// PREVIEW DATA — 8 pacientes fictícias com dados internamente consistentes
// TODO: remover mock e conectar ao Supabase quando em produção
// ==========================================================================

/*
 * Paciente 1 - Moara de Carvalho:       DMG confirmado (GJ ≥92, cenário 1) — Mar/26
 * Paciente 2 - Maria Luísa Ferreira:    Aguardando GJ (consulta 1 registrada) — Abr/26
 * Paciente 3 - Ana Carolina Souza:      Aguardando GTT (GJ <92 no retorno 1) — Mar/26
 * Paciente 4 - Juliana de Oliveira:     DMG afastado (GTT normal, IG 25sem) — Fev/26
 * Paciente 5 - Patrícia Almeida Santos: DMG confirmado (GTT alterado, IG 26sem, cenário 6) — Fev/26
 * Paciente 6 - Camila Rodrigues:        DMG confirmado (GTT alterado tardio, IG 30sem, cenário 6b) — Mar/26
 * Paciente 7 - Fernanda Costa Lima:     Resultado do parto (DMG na GJ, cenário 1, parto) — Fev/26
 * Paciente 8 - Beatriz Mendes:          Associar endocrino (GTT alterado, cenário 6 + cenário 7 insulina) — Mar/26
 *
 * Visão Geral: Ag.GJ=1, Ag.GTT=1, DMG confirmado=3 (Moara+Patrícia+Camila), DMG afastado=1, Parto=1, Endocrino=1
 * Diagnóstico: Total=8, DMG na GJ=2 (Moara+Fernanda), DMG no GTT=3 (Patrícia+Camila+Beatriz), DMG afastado GTT=1 (Juliana)
 * Pizza: GJ=2(40%), GTT 24-28=2(40%) (Patrícia+Beatriz), GTT tardio=1(20%) (Camila)
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
    // Moara (p1): Consulta 1 → Retorno 1 com GJ ≥92 → cenário 1
    { id: 'c1a', paciente_id: 'p1', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-10T10:00:00Z' },
    { id: 'c1b', paciente_id: 'p1', cenario_clinico: 'cenario_1', tipo: 'retorno_1', created_at: '2026-03-17T10:00:00Z' },

    // Maria Luísa (p2): Apenas consulta 1
    { id: 'c2a', paciente_id: 'p2', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-04-05T10:00:00Z' },

    // Ana Carolina (p3): Consulta 1 → Retorno 1 GJ <92 → aguardando GTT
    { id: 'c3a', paciente_id: 'p3', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-15T10:00:00Z' },
    { id: 'c3b', paciente_id: 'p3', cenario_clinico: 'cenario_2', tipo: 'retorno_1', created_at: '2026-03-22T10:00:00Z' },

    // Juliana (p4): Consulta 1 → Retorno 1 GJ <92 → GTT normal → cenário 5 (afastado)
    { id: 'c4a', paciente_id: 'p4', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-02-12T10:00:00Z' },
    { id: 'c4b', paciente_id: 'p4', cenario_clinico: 'cenario_2', tipo: 'retorno_1', created_at: '2026-02-19T10:00:00Z' },
    { id: 'c4c', paciente_id: 'p4', cenario_clinico: 'cenario_5', tipo: 'retorno_2', created_at: '2026-03-05T10:00:00Z' },

    // Patrícia (p5): GTT alterado IG 26sem → cenário 6
    { id: 'c5a', paciente_id: 'p5', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-02-20T10:00:00Z' },
    { id: 'c5b', paciente_id: 'p5', cenario_clinico: 'cenario_2', tipo: 'retorno_1', created_at: '2026-02-27T10:00:00Z' },
    { id: 'c5c', paciente_id: 'p5', cenario_clinico: 'cenario_6', tipo: 'retorno_2', created_at: '2026-03-15T10:00:00Z' },

    // Camila (p6): GTT alterado tardio IG 30sem → cenário 6b
    { id: 'c6a', paciente_id: 'p6', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-22T10:00:00Z' },
    { id: 'c6b', paciente_id: 'p6', cenario_clinico: 'cenario_2', tipo: 'retorno_1', created_at: '2026-03-29T10:00:00Z' },
    { id: 'c6c', paciente_id: 'p6', cenario_clinico: 'cenario_6b', tipo: 'retorno_2', created_at: '2026-04-08T10:00:00Z' },
    // Camila also has insulin
    { id: 'c6d', paciente_id: 'p6', cenario_clinico: 'cenario_3', tipo: 'retorno_3', created_at: '2026-04-10T10:00:00Z' },

    // Fernanda (p7): DMG na GJ → cenário 1 → parto
    { id: 'c7a', paciente_id: 'p7', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-02-05T10:00:00Z' },
    { id: 'c7b', paciente_id: 'p7', cenario_clinico: 'cenario_1', tipo: 'retorno_1', created_at: '2026-02-12T10:00:00Z' },

    // Beatriz (p8): GTT alterado → cenário 6 → insulina → cenário 7 (endocrino)
    { id: 'c8a', paciente_id: 'p8', cenario_clinico: null, tipo: 'consulta_1', created_at: '2026-03-28T10:00:00Z' },
    { id: 'c8b', paciente_id: 'p8', cenario_clinico: 'cenario_2', tipo: 'retorno_1', created_at: '2026-04-04T10:00:00Z' },
    { id: 'c8c', paciente_id: 'p8', cenario_clinico: 'cenario_6', tipo: 'retorno_2', created_at: '2026-04-08T10:00:00Z' },
    { id: 'c8d', paciente_id: 'p8', cenario_clinico: 'cenario_7', tipo: 'retorno_3', created_at: '2026-04-10T10:00:00Z' },
  ];
}

function generatePreviewExames(): ExameGlicemia[] {
  return [
    // Patrícia (p5): GTT at 26 weeks (normal range 24-28)
    { id: 'ex5', paciente_id: 'p5', ig_semanas_na_data: 26, consulta_id: 'c5c' },
    // Camila (p6): GTT at 30 weeks (tardio >28)
    { id: 'ex6', paciente_id: 'p6', ig_semanas_na_data: 30, consulta_id: 'c6c' },
    // Beatriz (p8): GTT at 26 weeks (normal range 24-28)
    { id: 'ex8', paciente_id: 'p8', ig_semanas_na_data: 26, consulta_id: 'c8c' },
  ];
}
