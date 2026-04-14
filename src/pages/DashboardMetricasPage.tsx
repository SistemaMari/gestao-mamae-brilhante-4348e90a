import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfissionalData } from '@/hooks/useProfissionalData';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart3, Download, Loader2, Users, AlertTriangle,
  FileText, Activity, Baby
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
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

const COLORS = {
  lilas: '#9b87f5',
  laranja: '#F59E0B',
  verde: '#22C55E',
  vermelho: '#EF4444',
  roxo: '#7E69AB',
  azul: '#3B82F6',
};

export default function DashboardMetricasPage() {
  const { profissionalData, loading: profLoading } = useProfissionalData();
  const location = useLocation();
  const navigate = useNavigate();
  const isPreview = location.pathname.startsWith('/vitrine');

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);

  const defaultEnd = new Date();
  const defaultStart = subDays(defaultEnd, 30);
  const [dateStart, setDateStart] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(defaultEnd, 'yyyy-MM-dd'));

  useEffect(() => {
    if (isPreview) {
      setPacientes(generatePreviewData());
      setConsultas(generatePreviewConsultas());
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

    const [pacRes, conRes] = await Promise.all([pacQuery, conQuery]);

    setPacientes((pacRes.data as Paciente[]) || []);

    // For institutional, filter consultas to only include unit patients
    let filteredConsultas = (conRes.data as Consulta[]) || [];
    if (isInstitucional && pacRes.data) {
      const patientIds = new Set(pacRes.data.map((p: any) => p.id));
      filteredConsultas = filteredConsultas.filter(c => patientIds.has(c.paciente_id));
    }
    setConsultas(filteredConsultas);
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

  // DMG confirmed = dmg_confirmado or encaminhada_endocrino
  const dmgConfirmados = filteredPacientes.filter(p =>
    p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino'
  );
  const dmgCount = dmgConfirmados.length;
  const dmgPercent = allPacientesCount > 0 ? Math.round((dmgCount / allPacientesCount) * 100) : 0;

  // Retornos vencidos
  const retornosVencidos = pacientes.filter(p => {
    if (p.status_ficha !== 'dmg_confirmado') return false;
    if (!p.data_proximo_retorno) return false;
    return differenceInDays(new Date(p.data_proximo_retorno), new Date()) < 0;
  }).length;

  // Laudos
  const laudosGerados = isPreview ? 7 : (profissionalData?.laudos_usados ?? 0);

  // Monthly evolution
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
      return {
        name: format(m, 'MMM/yy', { locale: ptBR }),
        total,
        dmg,
      };
    });
  }, [pacientes, months]);

  // Diagnosis metrics
  const dmgAfastado = filteredPacientes.filter(p => p.status_ficha === 'dmg_afastado').length;
  const dmgAfastadoPercent = allPacientesCount > 0 ? Math.round((dmgAfastado / allPacientesCount) * 100) : 0;

  // Overt from consultas
  const filteredConsultas = useMemo(() => {
    const patientIds = new Set(filteredPacientes.map(p => p.id));
    return consultas.filter(c => patientIds.has(c.paciente_id));
  }, [consultas, filteredPacientes]);

  const overt = filteredConsultas.filter(c => c.cenario_clinico === 'cenario_8').length;
  const overtPercent = dmgCount > 0 ? Math.round((overt / dmgCount) * 100) : 0;

  // DMG by diagnosis moment
  const dmgByGJ = filteredConsultas.filter(c => c.cenario_clinico === 'cenario_1').length;
  const dmgByGTT = filteredConsultas.filter(c => c.cenario_clinico === 'cenario_6').length;
  const dmgByGTTTardio = filteredConsultas.filter(c => c.cenario_clinico === 'cenario_6b').length;
  const diagPieData = [
    { name: 'GJ (Cenário 1)', value: dmgByGJ, color: COLORS.lilas },
    { name: 'GTT (Cenário 6)', value: dmgByGTT, color: COLORS.laranja },
    { name: 'GTT Tardio (Cenário 6B)', value: dmgByGTTTardio, color: COLORS.verde },
  ].filter(d => d.value > 0);

  // Treatment metrics
  const withInsulin = filteredConsultas.filter(c => c.cenario_clinico === 'cenario_3').length;
  const withInsulinPercent = dmgCount > 0 ? Math.round((withInsulin / dmgCount) * 100) : 0;

  const endocrino = filteredPacientes.filter(p => p.status_ficha === 'encaminhada_endocrino').length;
  const endocrinoPercent = dmgCount > 0 ? Math.round((endocrino / dmgCount) * 100) : 0;

  // Diet-only control: DMG patients without cenario_3 or cenario_7
  const dmgPatientIds = new Set(dmgConfirmados.map(p => p.id));
  const patientsWithInsulin = new Set(
    filteredConsultas
      .filter(c => c.cenario_clinico === 'cenario_3' || c.cenario_clinico === 'cenario_7')
      .map(c => c.paciente_id)
  );
  const dietOnly = dmgConfirmados.filter(p => !patientsWithInsulin.has(p.id)).length;
  const dietOnlyPercent = dmgCount > 0 ? Math.round((dietOnly / dmgCount) * 100) : 0;

  // Outcome metrics (parto)
  const partoPacientes = filteredPacientes.filter(p => p.status_ficha === 'resultado_parto');
  const hasPartos = partoPacientes.length > 0;

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

    // Header
    pdf.setFontSize(16);
    pdf.text(`Dashboard Clínico — Dr(a). ${isPreview ? 'Mari' : profissionalData?.nome || ''}`, 14, 20);
    pdf.setFontSize(10);
    pdf.text(`Período: ${format(new Date(dateStart), 'dd/MM/yyyy')} a ${format(new Date(dateEnd), 'dd/MM/yyyy')}`, 14, 28);
    pdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);

    const imgW = pdfW - 28;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(imgData, 'PNG', 14, 42, imgW, imgH);

    // Footer
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

  // Empty state
  if (!loading && pacientes.length === 0 && !isPreview) {
    return (
      <div className="rounded-xl border p-12 text-center" style={{ backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }}>
        <BarChart3 className="mx-auto h-14 w-14" style={{ color: '#94A3B8' }} />
        <p className="mt-4 text-lg font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: '#2D2B55' }}>
          Seu dashboard aparecerá aqui
        </p>
        <p className="mt-1 text-sm" style={{ color: '#64748B' }}>
          Cadastre pacientes e registre consultas para visualizar suas métricas clínicas.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: '#2D2B55' }}>
          Meu Dashboard
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateStart}
            onChange={e => setDateStart(e.target.value)}
            className="w-[150px] text-sm"
          />
          <span className="text-sm text-muted-foreground">a</span>
          <Input
            type="date"
            value={dateEnd}
            onChange={e => setDateEnd(e.target.value)}
            className="w-[150px] text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="h-4 w-4 mr-1" /> Exportar PDF
          </Button>
        </div>
      </div>

      <div id="dashboard-metricas-content">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={<Users className="h-5 w-5" style={{ color: COLORS.lilas }} />}
            label="Total de pacientes"
            value={allPacientesCount}
          />
          <MetricCard
            icon={<Activity className="h-5 w-5" style={{ color: COLORS.laranja }} />}
            label="Pacientes com DMG"
            value={dmgCount}
            detail={`${dmgPercent}% do total`}
          />
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5" style={{ color: COLORS.vermelho }} />}
            label="Retornos vencidos"
            value={retornosVencidos}
            alert={retornosVencidos > 0}
          />
          <MetricCard
            icon={<FileText className="h-5 w-5" style={{ color: COLORS.roxo }} />}
            label="Laudos gerados"
            value={laudosGerados}
          />
        </div>

        {/* Monthly evolution chart */}
        {showChart && (
          <div className="mb-8 rounded-xl border bg-card p-4" style={{ borderColor: '#E2E8F0' }}>
            <h2 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: '#2D2B55' }}>
              Evolução mensal
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748B' }} allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="total" name="Total" fill={COLORS.lilas} radius={[4, 4, 0, 0]} />
                <Bar dataKey="dmg" name="DMG" fill={COLORS.laranja} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Diagnosis section */}
        <SectionTitle>Diagnóstico</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <MetricCard
            icon={<Activity className="h-5 w-5" style={{ color: COLORS.laranja }} />}
            label="DMG confirmado"
            value={dmgCount}
            detail={`${dmgPercent}% do total`}
            borderColor={COLORS.laranja}
          />
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5" style={{ color: COLORS.vermelho }} />}
            label="Overt Diabetes"
            value={overt}
            detail={`${overtPercent}% dos diagnósticos`}
            borderColor={COLORS.vermelho}
          />
          <MetricCard
            icon={<Activity className="h-5 w-5" style={{ color: COLORS.verde }} />}
            label="DMG afastado"
            value={dmgAfastado}
            detail={`${dmgAfastadoPercent}% do total`}
            borderColor={COLORS.verde}
          />
        </div>

        {/* Pie chart: diagnosis moment */}
        {diagPieData.length > 0 && (
          <div className="mb-8 rounded-xl border bg-card p-4" style={{ borderColor: '#E2E8F0' }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: '#2D2B55' }}>
              DMG por momento do diagnóstico
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

        {/* Treatment section */}
        <SectionTitle>Tratamento</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <MetricCard
            icon={<Activity className="h-5 w-5" style={{ color: COLORS.verde }} />}
            label="Controle só com dieta"
            value={dietOnly}
            detail={`${dietOnlyPercent}% dos DMG`}
            borderColor={COLORS.verde}
          />
          <MetricCard
            icon={<Activity className="h-5 w-5" style={{ color: COLORS.lilas }} />}
            label="Pacientes com insulina"
            value={withInsulin}
            detail={`${withInsulinPercent}% dos DMG`}
            borderColor={COLORS.lilas}
          />
          <MetricCard
            icon={<AlertTriangle className="h-5 w-5" style={{ color: COLORS.vermelho }} />}
            label="Associadas ao endocrino"
            value={endocrino}
            detail={`${endocrinoPercent}% dos DMG`}
            borderColor={COLORS.vermelho}
          />
        </div>

        {/* Outcomes section */}
        <SectionTitle>Desfechos</SectionTitle>
        {!hasPartos ? (
          <div className="rounded-xl border bg-card p-8 text-center mb-8" style={{ borderColor: '#E2E8F0' }}>
            <Baby className="mx-auto h-10 w-10" style={{ color: '#94A3B8' }} />
            <p className="mt-2 text-sm" style={{ color: '#64748B' }}>
              Nenhum registro de parto no período selecionado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <MetricCard
              icon={<Baby className="h-5 w-5" style={{ color: COLORS.roxo }} />}
              label="Partos registrados"
              value={partoPacientes.length}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, alert, borderColor }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail?: string;
  alert?: boolean;
  borderColor?: string;
}) {
  return (
    <div
      className="rounded-xl border bg-card p-4 shadow-sm"
      style={{
        borderColor: alert ? COLORS.vermelho : borderColor || '#E2E8F0',
        borderLeftWidth: borderColor ? '4px' : undefined,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm" style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{label}</span>
      </div>
      <p className="text-[28px] font-bold" style={{ color: '#2D2B55' }}>{value}</p>
      {detail && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{detail}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-base font-semibold" style={{ fontFamily: 'Sora, sans-serif', color: '#2D2B55' }}>
      {children}
    </h2>
  );
}

// Preview data generators
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
    tipo: 'consulta_1',
    created_at: subDays(now, i * 3).toISOString(),
  }));
}
