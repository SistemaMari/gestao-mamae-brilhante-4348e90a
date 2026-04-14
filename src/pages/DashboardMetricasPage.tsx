import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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
  // Card backgrounds
  bgBranco: '#FFFFFF',
  bgLavanda: '#F1F0FB',
  bgLavandaDef: '#E5DEFF',
  bgVerdeSuave: '#D1FAE5',
  bgRosaSuave: '#FFF0F6',
  // Card borders
  borderCinza: '#E2E8F0',
  borderLilas: '#D6BCFA',
  borderLilasPrimario: '#9b87f5',
  borderVerdeAgua: '#5EEAD4',
  borderRosa: '#FBCFE8',
  // Text
  textNumero: '#2D2B55',
  textLabel: '#64748B',
};

export default function DashboardMetricasPage() {
  const { profissionalData, loading: profLoading } = useProfissionalData();
  const location = useLocation();
  const isPreview = location.pathname.startsWith('/vitrine');

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [exames, setExames] = useState<ExameGlicemia[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultEnd = new Date();
  const defaultStart = subDays(defaultEnd, 30);
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

  // --- SECTION 1: Visão Geral (8 cards by status) ---
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
      else if (p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino') {
        counts[p.status_ficha]++;
      }
    });
    // DMG confirmado includes encaminhada_endocrino for the status card? No, they're separate cards.
    return counts;
  }, [filteredPacientes]);

  const pct = (n: number) => allPacientesCount > 0 ? Math.round((n / allPacientesCount) * 100) : 0;

  // Retornos vencidos (all pacientes, not filtered by date)
  const retornosVencidos = pacientes.filter(p => {
    if (!p.data_proximo_retorno) return false;
    return differenceInDays(new Date(), new Date(p.data_proximo_retorno)) > 0;
  }).length;

  const laudosGerados = isPreview ? 7 : (profissionalData?.laudos_usados ?? 0);

  // --- SECTION 2: Diagnóstico ---
  const dmgConfirmados = filteredPacientes.filter(p =>
    p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino'
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

  // DMG no GTT: cenario_6 or cenario_6b or cenario_8 on retorno_2/consulta with GTT
  const dmgByGTT = filteredConsultas.filter(c =>
    c.cenario_clinico === 'cenario_6' || c.cenario_clinico === 'cenario_6b' ||
    (c.cenario_clinico === 'cenario_8' && c.tipo !== 'retorno_1')
  ).length;

  const dmgAfastado = filteredPacientes.filter(p => p.status_ficha === 'dmg_afastado').length;
  const dmgAfastadoPercent = pct(dmgAfastado);
  const dmgByGJPercent = pct(dmgByGJ);
  const dmgByGTTPercent = pct(dmgByGTT);

  // Pie chart — diagnosis moment (use exames ig_semanas for GTT normal vs tardio)
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
    { name: 'Diagnóstico no GTT (24 a 28 semanas)', value: gttNormal, color: BRAND.verdaAgua },
    { name: 'Diagnóstico no GTT tardio (acima de 29 semanas)', value: gttTardio, color: BRAND.lilasClaro },
  ].filter(d => d.value > 0);

  // --- SECTION 3: Tratamento (keep logic) ---
  const withInsulin = filteredConsultas.filter(c => c.cenario_clinico === 'cenario_3').length;
  const withInsulinPercent = dmgCount > 0 ? Math.round((withInsulin / dmgCount) * 100) : 0;

  const endocrino = filteredPacientes.filter(p => p.status_ficha === 'encaminhada_endocrino').length;
  const endocrinoPercent = dmgCount > 0 ? Math.round((endocrino / dmgCount) * 100) : 0;

  const patientsWithInsulin = new Set(
    filteredConsultas
      .filter(c => c.cenario_clinico === 'cenario_3' || c.cenario_clinico === 'cenario_7')
      .map(c => c.paciente_id)
  );
  const dietOnly = dmgConfirmados.filter(p => !patientsWithInsulin.has(p.id)).length;
  const dietOnlyPercent = dmgCount > 0 ? Math.round((dietOnly / dmgCount) * 100) : 0;

  // --- SECTION 4: Desfechos ---
  const partoPacientes = filteredPacientes.filter(p => p.status_ficha === 'resultado_parto');
  const hasPartos = partoPacientes.length > 0;

  // --- SECTION 5: Evolução Mensal (stacked bars, LAST section) ---
  const startDate = new Date(dateStart);
  const endDate = new Date(dateEnd);
  const months = eachMonthOfInterval({ start: startDate, end: endDate });
  const showChart = months.length >= 2;

  const monthlyData = useMemo(() => {
    return months.map(m => {
      const mStart = startOfMonth(m);
      const mEnd = endOfMonth(m);
      const total = pacientes.filter(p => {
        const d = new Date(p.created_at);
        return isWithinInterval(d, { start: mStart, end: mEnd });
      }).length;
      const dmg = pacientes.filter(p => {
        const d = new Date(p.created_at);
        return isWithinInterval(d, { start: mStart, end: mEnd }) &&
          (p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino');
      }).length;
      // For stacked: base = total - dmg, stacked = dmg
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

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div id="dashboard-metricas-content">
        {/* SECTION 1: Visão Geral — 8 cards */}
        <SectionTitle>Visão Geral</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
          <StatusCard
            icon={<AlertTriangle className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
            label="Retornos vencidos"
            value={retornosVencidos}
            bg={BRAND.bgRosaSuave} border={BRAND.borderRosa}
          />
          <StatusCard
            icon={<FileText className="h-4 w-4" style={{ color: BRAND.roxoEscuro }} />}
            label="Laudos gerados"
            value={laudosGerados}
            bg={BRAND.bgBranco} border={BRAND.borderCinza}
          />
        </div>

        {/* SECTION 2: Diagnóstico */}
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
            detail={`${dmgByGJPercent}% do total`}
            bg={BRAND.bgLavandaDef} border={BRAND.borderLilasPrimario}
          />
          <StatusCard
            icon={<Activity className="h-4 w-4" style={{ color: BRAND.lilas }} />}
            label="DMG confirmado no GTT"
            value={dmgByGTT}
            detail={`${dmgByGTTPercent}% do total`}
            bg={BRAND.bgLavanda} border={BRAND.borderLilasPrimario}
          />
          <StatusCard
            icon={<CheckCircle className="h-4 w-4" style={{ color: BRAND.verdaAgua }} />}
            label="DMG afastado no GTT"
            value={dmgAfastado}
            detail={`${dmgAfastadoPercent}% do total`}
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

        {/* SECTION 3: Tratamento (keep) */}
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

        {/* SECTION 4: Desfechos (keep) */}
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

        {/* SECTION 5: Evolução Mensal (LAST, stacked bars) */}
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

// --- Preview data generators ---
function generatePreviewData(): Paciente[] {
  const statuses = ['aguardando_gj', 'aguardando_gtt', 'dmg_afastado', 'dmg_confirmado', 'resultado_parto', 'encaminhada_endocrino'];
  const now = new Date();
  return Array.from({ length: 15 }, (_, i) => ({
    id: `preview-${i}`,
    nome: `Paciente ${i + 1}`,
    status_ficha: statuses[i % statuses.length],
    created_at: subDays(now, i * 5).toISOString(),
    data_proximo_retorno: i === 3 ? subDays(now, 2).toISOString() : null,
    profissional_id: 'preview',
    unidade_id: null,
  }));
}

function generatePreviewConsultas(): Consulta[] {
  const cenarios = ['cenario_1', 'cenario_3', 'cenario_6', 'cenario_6b', 'cenario_7', 'cenario_8', null];
  const now = new Date();
  return Array.from({ length: 20 }, (_, i) => ({
    id: `con-${i}`,
    paciente_id: `preview-${i % 15}`,
    cenario_clinico: cenarios[i % cenarios.length],
    tipo: i % 2 === 0 ? 'retorno_1' : 'retorno_2',
    created_at: subDays(now, i * 3).toISOString(),
  }));
}

function generatePreviewExames(): ExameGlicemia[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `ex-${i}`,
    paciente_id: `preview-${i % 15}`,
    ig_semanas_na_data: i % 3 === 0 ? 30 : 26,
    consulta_id: `con-${i}`,
  }));
}
