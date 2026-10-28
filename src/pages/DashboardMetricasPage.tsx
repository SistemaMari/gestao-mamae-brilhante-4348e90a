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
  Syringe, Target, Timer, Cake, History, CalendarCheck, ClipboardList, Scale,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import { parseDateLocal } from '@/lib/dateUtils';
import { isPacienteEncerrada } from '@/lib/fichaUtils';
import { resolverMotivoEfetivo, type MotivoEncerramento } from '@/lib/motivoEncerramento';
import {
  perfilGestantes, controleGlicemico, extrairPartos, desfechosParto, engajamento,
  type PerfilMetrica, type PartoTabela, type FaixaEtaria,
} from '@/lib/dashboardConsultorioMetricas';

interface Paciente {
  id: string;
  nome: string;
  status_ficha: string;
  created_at: string;
  data_proximo_retorno: string | null;
  profissional_id: string;
  unidade_id: string | null;
  motivo_encerramento?: string | null;
  data_nascimento?: string | null;
  dmg_gestacao_anterior?: boolean | null;
  data_encerramento?: string | null;
  data_ultima_consulta?: string | null;
}

interface Consulta {
  id: string;
  paciente_id: string;
  cenario_clinico: string | null;
  tipo: string;
  created_at: string;
  data?: string | null;
  ig_semanas?: number | null;
  ig_dias?: number | null;
  observacoes?: string | null;
}

interface ExameGlicemia {
  id: string;
  paciente_id: string;
  ig_semanas_na_data: number | null;
  consulta_id: string;
}

// Paleta "Bento médico" — teal protagonista, roxo como acento
const BRAND = {
  teal: '#2F7E98',
  tealEscuro: '#25667C',
  verdaAgua: '#99F6E4',
  lilas: '#7E69AB',
  lilasClaro: '#C4B5FD',
  roxoEscuro: '#7E69AB',
  bgBranco: '#FFFFFF',
  bgTealSuave: '#F1FAFB',
  bgLavanda: '#F1F0FB',
  bgLavandaDef: '#E5DEFF',
  bgVerdeSuave: '#D1FAE5',
  bgRosaSuave: '#FFF0F6',
  borderCinza: '#DCEEF2',
  borderTeal: '#CCE8EE',
  borderLilas: '#D6BCFA',
  borderVerdeAgua: '#99F6E4',
  borderRosa: '#FBCFE8',
  textNumero: '#1E293B',
  textLabel: '#64748B',
};

const DATE_LOCALES: Record<string, Locale> = {
  'pt-BR': ptBR,
  'en-US': enUS,
  'es': es,
};

// Chave i18n de cada faixa etária (o rótulo exibido vem do locale).
const FAIXA_KEY: Record<FaixaEtaria, string> = {
  '<25': 'lt25',
  '25–29': 'a25_29',
  '30–34': 'a30_34',
  '35–39': 'a35_39',
  '≥40': 'gte40',
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
  const [perfis, setPerfis] = useState<PerfilMetrica[]>([]);
  const [partosTabela, setPartosTabela] = useState<PartoTabela[]>([]);
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
      setPerfis(generatePreviewPerfis());
      setPartosTabela([]);
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

    let pacQuery = supabase.from('pacientes').select('id, nome, status_ficha, created_at, data_proximo_retorno, profissional_id, unidade_id, motivo_encerramento, data_nascimento, dmg_gestacao_anterior, data_encerramento, data_ultima_consulta').eq('is_rascunho', false);
    if (isInstitucional) {
      pacQuery = pacQuery.eq('unidade_id', profissionalData.unidade_id!);
    } else {
      pacQuery = pacQuery.eq('profissional_id', profissionalData.id);
    }

    // observacoes: o registro de parto guarda ali o JSON com via, peso, IG etc.
    let conQuery = supabase.from('consultas').select('id, paciente_id, cenario_clinico, tipo, created_at, data, ig_semanas, ig_dias, observacoes').eq('is_rascunho', false);
    if (!isInstitucional) {
      conQuery = conQuery.eq('profissional_id', profissionalData.id);
    }

    let perfQuery = supabase.from('perfis_glicemicos').select('paciente_id, percentual_meta, data_inicio, created_at');
    let partoQuery = supabase.from('partos').select('paciente_id, via_parto, classificacao_rn, peso_rn_g, ig_parto_semanas, ig_parto_dias, intercorrencia_materna, intercorrencia_neonatal').eq('is_rascunho', false);
    if (isInstitucional) {
      partoQuery = partoQuery.eq('unidade_id', profissionalData.unidade_id!);
    } else {
      perfQuery = perfQuery.eq('profissional_id', profissionalData.id);
      partoQuery = partoQuery.eq('profissional_id', profissionalData.id);
    }

    let exQuery = supabase.from('exames_glicemia').select('id, paciente_id, ig_semanas_na_data, consulta_id');
    if (!isInstitucional) {
      exQuery = exQuery.eq('profissional_id', profissionalData.id);
    }

    const [pacRes, conRes, exRes, perfRes, partoRes] = await Promise.all([pacQuery, conQuery, exQuery, perfQuery, partoQuery]);

    const pacs = (pacRes.data) || [];
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

    // Perfis/partos: restringe às gestantes carregadas (no institucional a RLS
    // pode trazer outras unidades).
    const idsPac = new Set(pacs.map(p => p.id));
    setPerfis(((perfRes.data as PerfilMetrica[]) || []).filter(pf => idsPac.has(pf.paciente_id)));
    setPartosTabela(((partoRes.data as PartoTabela[]) || []).filter(pt => idsPac.has(pt.paciente_id)));
    setLoading(false);
  };

  // Filter by date range. As datas do filtro são 'yyyy-MM-dd' e precisam ser lidas
  // no fuso LOCAL: `new Date('2026-10-19')` vira 18/10 21:00 em BRT e o "até hoje"
  // deixava de fora as gestantes cadastradas no próprio dia.
  const filteredPacientes = useMemo(() => {
    const start = startOfDay(parseDateLocal(dateStart) ?? new Date());
    const end = endOfDay(parseDateLocal(dateEnd) ?? new Date());
    return pacientes.filter(p => {
      const d = new Date(p.created_at);
      return d >= start && d <= end;
    });
  }, [pacientes, dateStart, dateEnd]);

  const [lista, setLista] = useState<{ titulo: string; pacientes: Paciente[] } | null>(null);


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

  const encerrada = (p: Paciente) =>
    isPacienteEncerrada({ status_ficha: p.status_ficha, motivo_encerramento: p.motivo_encerramento as MotivoEncerramento | null });

  // Operational bar data — mesma regra do selo "Vencido há N dias" da lista de
  // gestantes (DMG confirmado, não encerrada, retorno antes de hoje).
  const hoje = startOfDay(new Date());
  const pacsRetornoVencido = pacientes.filter(p => {
    if (p.status_ficha !== 'dmg_confirmado' || encerrada(p)) return false;
    const retorno = parseDateLocal(p.data_proximo_retorno);
    return !!retorno && retorno < hoje;
  });
  const retornosVencidos = pacsRetornoVencido.length;

  const laudosUsados = isPreview ? 5 : (profissionalData?.laudos_usados ?? 0);

  const filteredConsultas = useMemo(() => {
    const patientIds = new Set(filteredPacientes.map(p => p.id));
    return consultas.filter(c => patientIds.has(c.paciente_id));
  }, [consultas, filteredPacientes]);

  // Formato do cenário é CRU no banco ('1','6','6B','8','3','7'), não 'cenario_1'.
  // (Mesmo bug corrigido no admin #57 — aqui nunca tinha sido.) Normaliza p/ maiúsculo.
  const cc = (c: Consulta) => (c.cenario_clinico ?? '').toUpperCase();
  const ehGtt = (c: Consulta) => cc(c) === '6' || cc(c) === '6B';

  // --- DIAGNÓSTICO ---
  // DMG = a gestante teve o diagnóstico em algum momento, não só "status atual é
  // dmg_confirmado": quem encerrou por insulinização (status encerrada_insulinizacao)
  // ficava de fora, e todo parto (resultado_parto) contava como DMG mesmo sem
  // diagnóstico. Agora vale o histórico: GJ ≥92 no Retorno 1 ('1'), GTT alterado
  // ('6'/'6B'), Overt ('8'), insulina ('3'/'7') ou qualquer ficha de perfil glicêmico
  // (A–E, que só existem no caminho do DMG).
  const consultaIndicaDmg = (c: Consulta) =>
    c.tipo.startsWith('ficha_') ||
    (cc(c) === '1' && c.tipo === 'retorno_1') ||
    ehGtt(c) || cc(c) === '8' || cc(c) === '3' || cc(c) === '7';
  const idsComDmgNoHistorico = new Set(consultas.filter(consultaIndicaDmg).map(c => c.paciente_id));
  const motivoEfetivo = (p: Paciente) =>
    resolverMotivoEfetivo({ status_ficha: p.status_ficha, motivo_encerramento: p.motivo_encerramento as MotivoEncerramento | null });
  const temDmg = (p: Paciente) =>
    p.status_ficha === 'dmg_confirmado' ||
    p.status_ficha === 'encaminhada_endocrino' ||
    motivoEfetivo(p) === 'insulinizacao' ||
    idsComDmgNoHistorico.has(p.id);

  const dmgConfirmados = filteredPacientes.filter(temDmg);
  const dmgCount = dmgConfirmados.length;

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

  const ehGttTardio = (c: Consulta) => {
    const ex = filteredExames.find(e => e.consulta_id === c.id);
    return !!ex?.ig_semanas_na_data && ex.ig_semanas_na_data > 28;
  };
  const consultasGttNormal = filteredConsultas.filter(c => ehGtt(c) && !ehGttTardio(c));
  const consultasGttTardio = filteredConsultas.filter(c => ehGtt(c) && ehGttTardio(c));
  const gttNormal = consultasGttNormal.length;
  const gttTardio = consultasGttTardio.length;

  const diagPieData = [
    { name: t('dashboardMetricas.pie.diagGj'), value: dmgByGJ, color: BRAND.teal },
    { name: t('dashboardMetricas.pie.gttNormal'), value: gttNormal, color: BRAND.verdaAgua },
    { name: t('dashboardMetricas.pie.gttTardio'), value: gttTardio, color: BRAND.lilas },
  ].filter(d => d.value > 0);

  // --- CONTROLE GLICÊMICO ---
  // A MARI acompanha o DMG com dieta + perfil glicêmico; quando a insulina é
  // indicada, o acompanhamento encerra (Família 42). Por isso não existe mais
  // "associada ao endócrino": o bloco mostra dieta × indicação de insulina.
  const patientsWithInsulin = new Set([
    ...filteredConsultas
      .filter(c => cc(c) === '3' || cc(c) === '7')
      .map(c => c.paciente_id),
    ...filteredPacientes.filter(p => motivoEfetivo(p) === 'insulinizacao').map(p => p.id),
  ]);
  const idsFiltrados = new Set(filteredPacientes.map(p => p.id));
  const filteredPerfis = perfis.filter(pf => idsFiltrados.has(pf.paciente_id));
  const controle = controleGlicemico(dmgConfirmados, patientsWithInsulin, filteredPerfis, filteredConsultas);
  const pctDe = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 100) : 0);

  // --- PERFIL DAS GESTANTES ---
  const perfil = perfilGestantes(filteredPacientes, temDmg, filteredConsultas);

  // --- DESFECHOS DO PARTO ---
  const partos = extrairPartos(filteredConsultas, partosTabela.filter(pt => idsFiltrados.has(pt.paciente_id)));
  const desfechos = desfechosParto(partos);
  const pacsDosPartos = (lista: { paciente_id: string }[]) => {
    const ids = new Set(lista.map(x => x.paciente_id));
    return filteredPacientes.filter(p => ids.has(p.id));
  };

  // Formatação curta (locale do usuário)
  const fmtNum = (x: number | null, casas = 0) =>
    x == null ? '—' : x.toLocaleString(i18n.language, { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const fmtIg = (x: number | null) => {
    if (x == null) return '—';
    const totalDias = Math.round(x * 7);
    return t('dashboardMetricas.igFormat', { s: Math.floor(totalDias / 7), d: totalDias % 7 });
  };

  // --- ENCERRAMENTOS & ACOMPANHAMENTO ---
  // Motivo derivado: status resultado_parto → parto; encaminhada_endocrino ou
  // insulinização (motivo OU status encerrada_insulinizacao) → insulinização;
  // senão o motivo_encerramento cru.
  const motivoDe = (p: Paciente): string | null => {
    if (p.status_ficha === 'resultado_parto') return 'parto';
    if (p.status_ficha === 'encaminhada_endocrino') return 'insulinizacao';
    return motivoEfetivo(p);
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
  // "Em acompanhamento" = a mesma regra do filtro "Mostrar fichas encerradas" da
  // lista (DMG afastado também encerra o acompanhamento, no próprio GTT).
  const pacsAtivas = filteredPacientes.filter(p => !encerrada(p));
  const ativasCount = pacsAtivas.length;
  const pacsAfastadasEncerradas = filteredPacientes.filter(p => encerrada(p) && !motivoDe(p));
  encerradasCount += pacsAfastadasEncerradas.length;
  const naoRetornouTaxa = encerradasCount > 0 ? Math.round((encerramentos.nao_retornou / encerradasCount) * 100) : 0;
  const taxaDmg = allPacientesCount > 0 ? Math.round((dmgCount / allPacientesCount) * 100) : 0;
  const temEncerramentos = encerradasCount > 0;

  // --- ENGAJAMENTO ---
  const engaj = engajamento(filteredPacientes, filteredConsultas, filteredPerfis, dmgCount, encerrada);
  // Retornos em dia: gestantes com DMG em acompanhamento que têm retorno marcado.
  const pacsComRetorno = filteredPacientes.filter(p =>
    p.status_ficha === 'dmg_confirmado' && !encerrada(p) && !!p.data_proximo_retorno
  );
  const idsVencidas = new Set(pacsRetornoVencido.map(p => p.id));
  const pacsRetornoEmDia = pacsComRetorno.filter(p => !idsVencidas.has(p.id));

  // --- EVOLUÇÃO MENSAL ---
  const startDate = parseDateLocal(dateStart) ?? new Date();
  const endDate = parseDateLocal(dateEnd) ?? new Date();
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
      const dmg = monthPacs.filter(temDmg).length;
      return {
        name: format(m, 'MMM/yy', { locale: dateLocale }),
        novas: total - dmg,
        dmg,
      };
    });
  }, [pacientes, months, dateLocale, consultas]);

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
    pdf.text(t('dashboardMetricas.pdf.period', { inicio: format(parseDateLocal(dateStart) ?? new Date(), 'dd/MM/yyyy'), fim: format(parseDateLocal(dateEnd) ?? new Date(), 'dd/MM/yyyy') }), 14, 28);
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
    const { x, y, width, height, value, fill } = props;
    if (!value || value === 0) return null;
    // Barra clara (verde-água) pede texto escuro; barra teal pede texto branco.
    const textColor = fill === BRAND.verdaAgua ? '#0F3B47' : '#FFFFFF';
    return (
      <text x={x + width / 2} y={y + height / 2} fill={textColor} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="bold">
        {value}
      </text>
    );
  };


  // ---- Modal com lista de pacientes por card ----------------------------
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
  // Quem encerrou por insulinização já conta no card "Encerrada por insulinização";
  // o encerramento manual (42E) mantém status dmg_confirmado e contava nos dois.
  const pacsDmgConfirmado = filteredPacientes.filter(p =>
    (p.status_ficha === 'dmg_confirmado' || p.status_ficha === 'encaminhada_endocrino') &&
    motivoDe(p) !== 'insulinizacao'
  );

  // Diagnóstico — usa consulta_id p/ inferir origem
  const patientIdsByGJ = new Set(filteredConsultas.filter(c => cc(c) === '1' || (cc(c) === '8' && c.tipo === 'retorno_1')).map(c => c.paciente_id));
  const patientIdsByGTT = new Set(filteredConsultas.filter(ehGtt).map(c => c.paciente_id));
  const pacsDmgByGJ = filteredPacientes.filter(p => patientIdsByGJ.has(p.id));
  const pacsDmgByGTT = filteredPacientes.filter(p => patientIdsByGTT.has(p.id));
  // Fatias do "Momento do diagnóstico": cada uma abre só as suas gestantes
  // (antes as duas fatias do GTT abriam a lista inteira do GTT).
  const pacsDasConsultas = (cs: Consulta[]) => {
    const ids = new Set(cs.map(c => c.paciente_id));
    return filteredPacientes.filter(p => ids.has(p.id));
  };
  const pacsGttNormal = pacsDasConsultas(consultasGttNormal);
  const pacsGttTardio = pacsDasConsultas(consultasGttTardio);
  const pacsDmgAfastado = filteredPacientes.filter(p => p.status_ficha === 'dmg_afastado');
  // "Aguardando diagnóstico" = pacientes ainda sem desfecho diagnóstico
  const pacsAguardandoDiagnostico = filteredPacientes.filter(p =>
    p.status_ficha === 'aguardando_gj' || p.status_ficha === 'aguardando_gtt'
  );
  const aguardandoDiagnosticoCount = pacsAguardandoDiagnostico.length;


  // Encerramentos
  const pacsPorMotivo = (m: string) => filteredPacientes.filter(p => motivoDe(p) === m);
  const pacsEncerradas = filteredPacientes.filter(encerrada);

  // Retornos vencidos → abre só as gestantes com retorno vencido (antes levava
  // para a lista inteira de gestantes).
  const handleRetornosClick = () => {
    if (!retornosVencidos) return;
    abrirLista(t('dashboardMetricas.kpi.overdue'), pacsRetornoVencido);
  };


  return (
    <div className="-m-4 flex flex-col gap-6 bg-[#F1FAFB] p-4 sm:-m-6 sm:p-6 lg:p-8">
      {/* 1. Header — bento médico (teal protagonista) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-[28px] font-bold leading-tight tracking-tight"
            style={{ fontFamily: 'Sora, sans-serif', color: BRAND.teal }}
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
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-2 shadow-sm" style={{ borderColor: BRAND.borderTeal }}>
          <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="h-9 w-[150px] rounded-xl border-transparent bg-[#F1FAFB] text-sm" />
          <span className="text-sm" style={{ color: '#94A3B8' }}>{t('dashboardMetricas.dateRangeSep')}</span>
          <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="h-9 w-[150px] rounded-xl border-transparent bg-[#F1FAFB] text-sm" />
          <Button
            size="sm"
            onClick={handleExportPDF}
            className="h-9 rounded-xl bg-[#2F7E98] text-white shadow-md hover:bg-[#25667C]"
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
          {t('dashboardMetricas.reportsGeneratedTotal', { count: laudosUsados })}
        </div>
      </div>

      <div id="dashboard-metricas-content" className="flex flex-col gap-8">
        {/* KPIs principais — bento com um card herói em teal */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricaCard
            label={t('dashboardMetricas.kpi.tracked')}
            valor={allPacientesCount}
            sublabel={t('dashboardMetricas.kpi.trackedSub')}
            cor={BRAND.teal}
          />
          <AdminMetricaCard
            destaque
            label={t('dashboardMetricas.kpi.dmgRate')}
            valor={`${taxaDmg}%`}
            sublabel={t('dashboardMetricas.kpi.dmgRateSub', { count: dmgCount })}
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

        {/* Visão Geral — um único tile bento com os 6 status */}
        <BentoPanel
          title={t('dashboardMetricas.sections.overview')}
          eyebrow={t('dashboardMetricas.sections.overview')}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <BentoItem accent="#94A3B8" label={t('dashboardMetricas.overview.awaitingGj')} value={statusCounts.aguardando_gj} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.aguardando_gj) })} onClick={() => abrirLista(t('dashboardMetricas.overview.awaitingGj'), pacsByStatus('aguardando_gj'))} />
            <BentoItem accent={BRAND.verdaAgua} label={t('dashboardMetricas.overview.awaitingGtt')} value={statusCounts.aguardando_gtt} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.aguardando_gtt) })} onClick={() => abrirLista(t('dashboardMetricas.overview.awaitingGtt'), pacsByStatus('aguardando_gtt'))} />
            <BentoItem accent={BRAND.teal} highlight label={t('dashboardMetricas.overview.dmgConfirmed')} value={pacsDmgConfirmado.length} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(pacsDmgConfirmado.length) })} onClick={() => abrirLista(t('dashboardMetricas.overview.dmgConfirmed'), pacsDmgConfirmado)} />
            <BentoItem accent="#5EEAD4" label={t('dashboardMetricas.overview.dmgRuledOut')} value={statusCounts.dmg_afastado} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.dmg_afastado) })} onClick={() => abrirLista(t('dashboardMetricas.overview.dmgRuledOut'), pacsByStatus('dmg_afastado'))} />
            <BentoItem accent={BRAND.lilas} label={t('dashboardMetricas.overview.deliveryResult')} value={statusCounts.resultado_parto} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(statusCounts.resultado_parto) })} onClick={() => abrirLista(t('dashboardMetricas.overview.deliveryResult'), pacsByStatus('resultado_parto'))} />
            <BentoItem accent={BRAND.lilasClaro} label={t('dashboardMetricas.overview.associateEndo')} value={encerramentos.insulinizacao} detail={t('dashboardMetricas.pctOfTotal', { pct: pct(encerramentos.insulinizacao) })} onClick={() => abrirLista(t('dashboardMetricas.overview.associateEndo'), filteredPacientes.filter(p => motivoDe(p) === 'insulinizacao'))} />
          </div>
        </BentoPanel>


        {/* Diagnóstico — cards + gráfico dentro de CardContainer */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.diagnosis')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <CleanStatCard dotColor="#94A3B8" icon={Users} label={t('dashboardMetricas.diagnosis.totalPatients')} value={allPacientesCount} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.totalPatients'), filteredPacientes)} />
            <CleanStatCard dotColor={BRAND.teal} icon={Activity} label={t('dashboardMetricas.diagnosis.dmgConfirmedGj')} value={dmgByGJ} detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((dmgByGJ / allPacientesCount) * 100) : 0 })} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.dmgConfirmedGj'), pacsDmgByGJ)} />
            <CleanStatCard dotColor={BRAND.lilas} icon={Activity} label={t('dashboardMetricas.diagnosis.dmgConfirmedGtt')} value={dmgByGTT} detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((dmgByGTT / allPacientesCount) * 100) : 0 })} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.dmgConfirmedGtt'), pacsDmgByGTT)} />
            <CleanStatCard dotColor={"#5EEAD4"} icon={CheckCircle} label={t('dashboardMetricas.diagnosis.dmgRuledOutGtt')} value={dmgAfastado} detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((dmgAfastado / allPacientesCount) * 100) : 0 })} onClick={() => abrirLista(t('dashboardMetricas.diagnosis.dmgRuledOutGtt'), pacsDmgAfastado)} />
            <CleanStatCard
              dotColor="#F59E0B"
              icon={HelpCircle}
              label={t('dashboardMetricas.diagnosis.awaitingDiagnosis', 'Aguardando diagnóstico')}
              value={aguardandoDiagnosticoCount}
              detail={t('dashboardMetricas.pctOfTotal', { pct: allPacientesCount > 0 ? Math.round((aguardandoDiagnosticoCount / allPacientesCount) * 100) : 0 })}
              onClick={() => abrirLista(t('dashboardMetricas.diagnosis.awaitingDiagnosis', 'Aguardando diagnóstico'), pacsAguardandoDiagnostico)}
            />
          </div>

          {(() => {
            const diagTotal = diagPieData.reduce((s, d) => s + d.value, 0);
            const listaDe = (name: string) => {
              if (name === t('dashboardMetricas.pie.diagGj')) return pacsDmgByGJ;
              if (name === t('dashboardMetricas.pie.gttNormal')) return pacsGttNormal;
              if (name === t('dashboardMetricas.pie.gttTardio')) return pacsGttTardio;
              return [];
            };
            return diagTotal > 0 ? (
              <AdminChartCard title={t('dashboardMetricas.pie.title')}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr] md:items-center">
                  {/* Donut com total no centro */}
                  <div className="relative mx-auto h-[240px] w-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={diagPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={100}
                          paddingAngle={2}
                          isAnimationActive={false}
                          stroke="#FFFFFF"
                          strokeWidth={2}
                        >
                          {diagPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: 10,
                            border: '1px solid #E2E8F0',
                            fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: 12,
                          }}
                          formatter={(value: number, name: string) => [
                            `${value} (${Math.round((value / diagTotal) * 100)}%)`,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span
                        className="text-3xl font-bold leading-none"
                        style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
                      >
                        {diagTotal}
                      </span>
                      <span
                        className="mt-1 text-[11px] uppercase tracking-wide"
                        style={{ color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                      >
                        {t('dashboardMetricas.pie.centerLabel', { defaultValue: 'diagnósticos' })}
                      </span>
                    </div>
                  </div>

                  {/* Legenda detalhada clicável */}
                  <ul className="flex flex-col gap-1.5">
                    {diagPieData.map((entry) => {
                      const pacs = listaDe(entry.name);
                      const pct = Math.round((entry.value / diagTotal) * 100);
                      const clickable = pacs.length > 0;
                      const Tag: any = clickable ? 'button' : 'div';
                      return (
                        <Tag
                          key={entry.name}
                          onClick={clickable ? () => abrirLista(entry.name, pacs) : undefined}
                          className={`group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-all ${clickable ? 'hover:border-[#E2E8F0] hover:bg-[#F8FAFC]' : ''}`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span
                            className="flex-1 text-sm"
                            style={{ color: '#334155', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                          >
                            {entry.name}
                          </span>
                          <span
                            className="text-sm font-semibold tabular-nums"
                            style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
                          >
                            {entry.value}
                          </span>
                          <span
                            className="w-12 text-right text-xs tabular-nums"
                            style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                          >
                            {pct}%
                          </span>
                          {clickable && (
                            <ChevronRight
                              className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100"
                              style={{ color: '#94A3B8' }}
                            />
                          )}
                        </Tag>
                      );
                    })}
                  </ul>
                </div>
              </AdminChartCard>
            ) : null;
          })()}

        </section>

        {/* Perfil das gestantes */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.profile')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CleanStatCard dotColor={BRAND.teal} icon={Cake} label={t('dashboardMetricas.profile.avgAge')} value={perfil.idadeMedia == null ? '—' : t('dashboardMetricas.profile.years', { n: fmtNum(perfil.idadeMedia, 1) })} detail={perfil.comIdade ? t('dashboardMetricas.profile.basedOn', { count: perfil.comIdade }) : t('dashboardMetricas.profile.noBirthDate')} />
            <CleanStatCard dotColor={BRAND.lilas} icon={History} label={t('dashboardMetricas.profile.previousDmg')} value={perfil.dmgComAnterior.length} detail={t('dashboardMetricas.profile.ofDmg', { n: perfil.dmgComAnterior.length, de: perfil.dmgTotal, pct: pctDe(perfil.dmgComAnterior.length, perfil.dmgTotal) })} onClick={() => abrirLista(t('dashboardMetricas.profile.previousDmg'), perfil.dmgComAnterior)} />
            <CleanStatCard dotColor="#F472B6" icon={Activity} label={t('dashboardMetricas.profile.recurrence')} value={perfil.comDmgAnterior.length ? `${pctDe(perfil.dmgComAnterior.length, perfil.comDmgAnterior.length)}%` : '—'} detail={perfil.comDmgAnterior.length ? t('dashboardMetricas.profile.recurrenceDetail', { n: perfil.dmgComAnterior.length, de: perfil.comDmgAnterior.length }) : t('dashboardMetricas.profile.noPreviousDmg')} onClick={() => abrirLista(t('dashboardMetricas.profile.recurrence'), perfil.comDmgAnterior)} />
            <CleanStatCard dotColor="#F59E0B" icon={Clock} label={t('dashboardMetricas.profile.gaAtDiagnosis')} value={fmtIg(perfil.igMediaDiagnostico)} detail={perfil.comIgDiagnostico ? t('dashboardMetricas.profile.basedOnDmg', { count: perfil.comIgDiagnostico }) : undefined} />
          </div>

          {perfil.comIdade > 0 && (
            <AdminChartCard title={t('dashboardMetricas.profile.ageChartTitle')}>
              {perfil.faixaMaiorPrevalencia && (
                <div className="-mt-2 mb-5 inline-flex flex-wrap items-center gap-2 rounded-full px-4 py-2 text-sm" style={{ backgroundColor: BRAND.bgTealSuave, color: BRAND.tealEscuro, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  <Target className="h-4 w-4" />
                  {t('dashboardMetricas.profile.highestPrevalence', {
                    faixa: t(`dashboardMetricas.profile.ageBands.${FAIXA_KEY[perfil.faixaMaiorPrevalencia.faixa]}`),
                    n: perfil.faixaMaiorPrevalencia.dmg,
                    de: perfil.faixaMaiorPrevalencia.total,
                    pct: pctDe(perfil.faixaMaiorPrevalencia.dmg, perfil.faixaMaiorPrevalencia.total),
                  })}
                </div>
              )}
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={perfil.faixas.map(f => ({ name: t(`dashboardMetricas.profile.ageBands.${FAIXA_KEY[f.faixa]}`), semDmg: f.total - f.dmg, dmg: f.dmg }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: BRAND.textLabel }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: BRAND.textLabel }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <RechartsTooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12 }} />
                  <Bar dataKey="semDmg" name={t('dashboardMetricas.profile.withoutDmg')} stackId="a" fill={BRAND.verdaAgua}>
                    <LabelList dataKey="semDmg" content={renderLabel} />
                  </Bar>
                  <Bar dataKey="dmg" name={t('dashboardMetricas.profile.withDmg')} stackId="a" fill={BRAND.teal} radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="dmg" content={renderLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </AdminChartCard>
          )}
        </section>

        {/* Controle glicêmico (substitui "Tratamento": insulina encerra a MARI) */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.control')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CleanStatCard dotColor={BRAND.verdaAgua} icon={CheckCircle} label={t('dashboardMetricas.control.dietOnly')} value={controle.soDieta.length} detail={t('dashboardMetricas.pctOfDmg', { pct: pctDe(controle.soDieta.length, dmgCount) })} onClick={() => abrirLista(t('dashboardMetricas.control.dietOnly'), controle.soDieta)} />
            <CleanStatCard dotColor={BRAND.lilas} icon={Syringe} label={t('dashboardMetricas.control.insulin')} value={controle.comInsulina.length} detail={t('dashboardMetricas.pctOfDmg', { pct: pctDe(controle.comInsulina.length, dmgCount) })} onClick={() => abrirLista(t('dashboardMetricas.control.insulin'), controle.comInsulina)} />
            <CleanStatCard dotColor={BRAND.teal} icon={Target} label={t('dashboardMetricas.control.inTarget')} value={controle.mediaNaMeta == null ? '—' : `${fmtNum(controle.mediaNaMeta)}%`} detail={controle.comPerfil ? t('dashboardMetricas.control.inTargetDetail', { count: controle.comPerfil }) : t('dashboardMetricas.control.noProfiles')} />
            <CleanStatCard dotColor="#F59E0B" icon={Timer} label={t('dashboardMetricas.control.daysToInsulin')} value={controle.diasAteInsulina == null ? '—' : t('dashboardMetricas.control.days', { n: fmtNum(controle.diasAteInsulina) })} detail={controle.comDiasAteInsulina ? t('dashboardMetricas.control.daysToInsulinDetail', { count: controle.comDiasAteInsulina }) : undefined} />
          </div>
        </section>

        {/* Desfechos do parto */}
        <BentoPanel title={t('dashboardMetricas.sections.outcomes')} eyebrow={t('dashboardMetricas.outcomes.deliveriesCount', { count: desfechos.total })}>
          {desfechos.total === 0 ? (
            <p className="text-sm" style={{ color: BRAND.textLabel, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {t('dashboardMetricas.outcomes.noDeliveries')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <BentoItem accent={BRAND.lilas} label={t('dashboardMetricas.outcomes.cesarean')} value={`${pctDe(desfechos.cesarea.length, desfechos.total)}%`} detail={t('dashboardMetricas.outcomes.nOfTotal', { n: desfechos.cesarea.length, de: desfechos.total })} onClick={() => abrirLista(t('dashboardMetricas.outcomes.cesarean'), pacsDosPartos(desfechos.cesarea))} />
              <BentoItem accent={BRAND.teal} label={t('dashboardMetricas.outcomes.gaAtBirth')} value={fmtIg(desfechos.igMedia)} detail={t('dashboardMetricas.outcomes.preterm', { count: desfechos.prematuros.length })} onClick={desfechos.prematuros.length ? () => abrirLista(t('dashboardMetricas.outcomes.pretermTitle'), pacsDosPartos(desfechos.prematuros)) : undefined} />
              <BentoItem accent={BRAND.verdaAgua} label={t('dashboardMetricas.outcomes.birthWeight')} value={desfechos.pesoMedio == null ? '—' : `${fmtNum(desfechos.pesoMedio)} g`} detail={t('dashboardMetricas.outcomes.macrosomia', { count: desfechos.macrossomia.length })} onClick={desfechos.macrossomia.length ? () => abrirLista(t('dashboardMetricas.outcomes.macrosomiaTitle'), pacsDosPartos(desfechos.macrossomia)) : undefined} />
              <BentoItem accent="#F472B6" label={t('dashboardMetricas.outcomes.lga')} value={desfechos.gig.length} detail={t('dashboardMetricas.outcomes.rnClass', { aig: desfechos.aig.length, pig: desfechos.pig.length })} onClick={() => abrirLista(t('dashboardMetricas.outcomes.lga'), pacsDosPartos(desfechos.gig))} />
              <BentoItem accent="#F59E0B" label={t('dashboardMetricas.outcomes.complications')} value={pacsDosPartos([...desfechos.intercorrenciaMaterna, ...desfechos.intercorrenciaNeonatal]).length} detail={t('dashboardMetricas.outcomes.complicationsDetail', { mat: desfechos.intercorrenciaMaterna.length, neo: desfechos.intercorrenciaNeonatal.length })} onClick={() => abrirLista(t('dashboardMetricas.outcomes.complications'), pacsDosPartos([...desfechos.intercorrenciaMaterna, ...desfechos.intercorrenciaNeonatal]))} />
              <BentoItem accent="#5EEAD4" label={t('dashboardMetricas.outcomes.breastfeeding')} value={desfechos.comAleitamento ? `${pctDe(desfechos.aleitamento, desfechos.comAleitamento)}%` : '—'} detail={desfechos.comAleitamento ? t('dashboardMetricas.outcomes.nOfTotal', { n: desfechos.aleitamento, de: desfechos.comAleitamento }) : undefined} />
            </div>
          )}
        </BentoPanel>

        {/* Encerramentos & acompanhamento */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.closures')}</AdminSectionTitle>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <CleanStatCard dotColor="#0EA5A5" icon={CheckCircle} label={t('dashboardMetricas.closures.active')} value={ativasCount} detail={t('dashboardMetricas.closures.activeDetail')} onClick={() => abrirLista(t('dashboardMetricas.closures.active'), pacsAtivas)} />
            <CleanStatCard dotColor={BRAND.roxoEscuro} icon={Baby} label={t('dashboardMetricas.closures.delivery')} value={encerramentos.parto} onClick={() => abrirLista(t('dashboardMetricas.closures.delivery'), pacsPorMotivo('parto'))} />
            <CleanStatCard dotColor="#F472B6" icon={Stethoscope} label={t('dashboardMetricas.closures.toEndo')} value={encerramentos.insulinizacao} onClick={() => abrirLista(t('dashboardMetricas.closures.toEndo'), pacsPorMotivo('insulinizacao'))} />
            <CleanStatCard dotColor="#94A3B8" icon={Activity} label={t('dashboardMetricas.closures.miscarriage')} value={encerramentos.aborto} onClick={() => abrirLista(t('dashboardMetricas.closures.miscarriage'), pacsPorMotivo('aborto'))} />
            <CleanStatCard dotColor="#94A3B8" icon={Clock} label={t('dashboardMetricas.closures.noReturn')} value={encerramentos.nao_retornou} detail={temEncerramentos ? t('dashboardMetricas.closures.noReturnRate', { pct: naoRetornouTaxa }) : undefined} onClick={() => abrirLista(t('dashboardMetricas.closures.noReturn'), pacsPorMotivo('nao_retornou'))} />
            <CleanStatCard dotColor="#94A3B8" icon={Users} label={t('dashboardMetricas.closures.total')} value={encerradasCount} detail={pacsAfastadasEncerradas.length ? t('dashboardMetricas.closures.totalInclRuledOut', { count: pacsAfastadasEncerradas.length }) : undefined} onClick={() => abrirLista(t('dashboardMetricas.closures.total'), pacsEncerradas)} />
          </div>
        </section>

        {/* Engajamento */}
        <section className="flex flex-col gap-4">
          <AdminSectionTitle>{t('dashboardMetricas.sections.engagement')}</AdminSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CleanStatCard dotColor={BRAND.teal} icon={ClipboardList} label={t('dashboardMetricas.engagement.consults')} value={engaj.consultas} detail={engaj.consultasPorGestante == null ? undefined : t('dashboardMetricas.engagement.perPatient', { n: fmtNum(engaj.consultasPorGestante, 1) })} />
            <CleanStatCard dotColor={BRAND.lilas} icon={Scale} label={t('dashboardMetricas.engagement.profiles')} value={engaj.perfis} detail={engaj.perfisPorDmg == null ? undefined : t('dashboardMetricas.engagement.perDmg', { n: fmtNum(engaj.perfisPorDmg, 1) })} />
            <CleanStatCard dotColor="#0EA5A5" icon={CalendarCheck} label={t('dashboardMetricas.engagement.onTime')} value={pacsComRetorno.length ? `${pctDe(pacsRetornoEmDia.length, pacsComRetorno.length)}%` : '—'} detail={pacsComRetorno.length ? t('dashboardMetricas.engagement.onTimeDetail', { n: pacsRetornoEmDia.length, de: pacsComRetorno.length }) : undefined} onClick={pacsRetornoEmDia.length ? () => abrirLista(t('dashboardMetricas.engagement.onTime'), pacsRetornoEmDia) : undefined} />
            <CleanStatCard dotColor="#F59E0B" icon={Clock} label={t('dashboardMetricas.engagement.followUp')} value={engaj.semanasAcompanhamento == null ? '—' : t('dashboardMetricas.engagement.weeks', { n: fmtNum(engaj.semanasAcompanhamento, 1) })} detail={t('dashboardMetricas.engagement.followUpDetail')} />
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
                <Bar dataKey="novas" name={t('dashboardMetricas.chart.newPatients')} stackId="a" fill={BRAND.verdaAgua} radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="novas" content={renderLabel} />
                </Bar>
                <Bar dataKey="dmg" name={t('dashboardMetricas.chart.dmgConfirmed')} stackId="a" fill={BRAND.teal} radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="dmg" content={renderLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </AdminChartCard>
        )}
      </div>

      {/* Modal com lista de pacientes ao clicar em um card */}
      <Dialog open={!!lista} onOpenChange={(o) => !o && setLista(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Sora, sans-serif', color: '#1E293B' }}>
              {lista?.titulo}
            </DialogTitle>
            <DialogDescription>
              {t('dashboardMetricas.list.count', {
                defaultValue: '{{count}} gestante(s) neste grupo',
                count: lista?.pacientes.length ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto rounded-lg border" style={{ borderColor: '#E2E8F0' }}>
            {lista?.pacientes.length ? (
              <ul className="divide-y" style={{ borderColor: '#E2E8F0' }}>
                {[...lista.pacientes]
                  .sort((a, b) => a.nome.localeCompare(b.nome, i18n.language))
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => irParaPaciente(p.id)}
                        disabled={isPreview}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#F5F0FF] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <span
                          className="text-sm font-medium"
                          style={{ color: '#1E293B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                        >
                          {p.nome}
                        </span>
                        {!isPreview && <ChevronRight className="h-4 w-4" style={{ color: '#94A3B8' }} />}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm" style={{ color: '#64748B' }}>
                {t('dashboardMetricas.list.empty', { defaultValue: 'Nenhuma gestante neste grupo.' })}
              </p>
            )}
          </div>
          {isPreview && (
            <p className="text-xs" style={{ color: '#94A3B8' }}>
              {t('dashboardMetricas.list.previewNote', { defaultValue: 'Modo demonstração — clique desativado.' })}
            </p>
          )}
        </DialogContent>
      </Dialog>
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
  destaque,
  onClick,
}: {
  label: string;
  valor: string | number;
  sublabel?: string;
  cor?: string;
  destaque?: boolean;
  onClick?: () => void;
}) {
  const Tag: any = onClick ? 'button' : 'div';
  if (destaque) {
    return (
      <Tag
        onClick={onClick}
        className={`rounded-[2rem] p-6 text-left shadow-lg transition-all ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
        style={{ backgroundColor: BRAND.teal, boxShadow: '0 18px 32px -18px rgba(47,126,152,0.65)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-medium text-white/80" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {label}
          </span>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: BRAND.verdaAgua }} />
          </span>
        </div>
        <div className="mt-3 text-[38px] font-bold leading-none text-white" style={{ fontFamily: 'Sora, sans-serif' }}>
          {valor}
        </div>
        {sublabel && (
          <div className="mt-3 text-xs text-white/75" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {sublabel}
          </div>
        )}
      </Tag>
    );
  }
  return (
    <Tag
      onClick={onClick}
      className={`rounded-[2rem] border bg-white p-6 text-left shadow-sm transition-all ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : ''}`}
      style={{ borderColor: BRAND.borderTeal }}
    >
      <div
        className="text-sm font-medium"
        style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        {label}
      </div>
      <div
        className="mt-3 text-[34px] leading-none font-bold"
        style={{ color: cor ?? '#1E293B', fontFamily: 'Sora, sans-serif' }}
      >
        {valor}
      </div>
      {sublabel && (
        <div
          className="mt-3 text-xs"
          style={{ color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {sublabel}
        </div>
      )}
    </Tag>
  );
}

/** Tile bento branco com título e faixa de rótulo discreta. */
function BentoPanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-[2.5rem] border bg-white p-6 shadow-sm sm:p-8"
      style={{ borderColor: BRAND.borderTeal }}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}>
          {title}
        </h2>
        {eyebrow && (
          <span
            className="hidden text-[11px] font-semibold uppercase tracking-widest sm:inline"
            style={{ color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {eyebrow}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Métrica compacta dentro de um tile bento — barra de acento à esquerda. */
function BentoItem({
  label,
  value,
  detail,
  accent,
  highlight,
  onClick,
}: {
  label: string;
  value: number | string;
  detail?: string;
  accent: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const clickable = !!onClick && (typeof value === 'number' ? value > 0 : value !== '—');
  const Tag: any = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={clickable ? onClick : undefined}
      className={`group flex w-full items-start gap-3 rounded-2xl py-2 pl-4 pr-3 text-left transition-all ${clickable ? 'cursor-pointer hover:bg-[#F1FAFB]' : ''}`}
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug" style={{ color: '#64748B', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {label}
        </p>
        <p
          className="mt-1 text-[26px] font-bold leading-none"
          style={{ color: highlight ? BRAND.teal : '#1E293B', fontFamily: 'Sora, sans-serif' }}
        >
          {value}
        </p>
        {detail && (
          <p className="mt-1 text-xs" style={{ color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {detail}
          </p>
        )}
      </div>
      {clickable && (
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: '#94A3B8' }} />
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
  value: number | string;
  detail?: string;
  dotColor: string;
  onClick?: () => void;
}) {
  const clickable = !!onClick && (typeof value === 'number' ? value > 0 : value !== '—');
  const Tag: any = clickable ? 'button' : 'div';
  return (
    <Tag
      onClick={clickable ? onClick : undefined}
      className={`group relative w-full rounded-[2rem] border bg-white p-6 text-left shadow-sm transition-all ${clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#2F7E98] hover:shadow-md' : ''}`}
      style={{ borderColor: BRAND.borderTeal }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ backgroundColor: `${dotColor}26` }}
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
        className="text-[30px] font-bold leading-none"
        style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
      >
        {value}
      </p>
      {detail && (
        <p
          className="mt-2 text-xs"
          style={{ color: '#94A3B8', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
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
      className="text-lg font-bold"
      style={{ color: '#1E293B', fontFamily: 'Sora, sans-serif' }}
    >
      {children}
    </h2>
  );
}

function AdminChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[2.5rem] border bg-white p-6 shadow-sm sm:p-8"
      style={{ borderColor: BRAND.borderTeal }}
    >
      <h3
        className="mb-6 text-xl font-bold"
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

// Campos extras da vitrine (idade, DMG anterior, encerramento) para os blocos
// Perfil das gestantes / Controle glicêmico / Engajamento.
const PREVIEW_EXTRA: Record<string, Partial<Paciente>> = {
  p1: { data_nascimento: '1992-05-14', dmg_gestacao_anterior: true },
  p2: { data_nascimento: '1999-02-03', dmg_gestacao_anterior: false },
  p3: { data_nascimento: '1995-08-21', dmg_gestacao_anterior: false },
  p4: { data_nascimento: '2001-11-30', dmg_gestacao_anterior: false },
  p5: { data_nascimento: '1989-03-09', dmg_gestacao_anterior: true },
  p6: { data_nascimento: '1990-07-17', dmg_gestacao_anterior: false },
  p7: { data_nascimento: '1993-12-01', dmg_gestacao_anterior: false, data_encerramento: '2026-09-02' },
  p8: { data_nascimento: '1984-06-25', dmg_gestacao_anterior: true, data_encerramento: '2026-04-10' },
};

function generatePreviewData(): Paciente[] {
  return ([
    { id: 'p1', nome: 'Moara de Carvalho', status_ficha: 'dmg_confirmado', created_at: '2026-03-10T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p2', nome: 'Maria Luísa Ferreira', status_ficha: 'aguardando_gj', created_at: '2026-04-05T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p3', nome: 'Ana Carolina Souza', status_ficha: 'aguardando_gtt', created_at: '2026-03-15T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p4', nome: 'Juliana de Oliveira', status_ficha: 'dmg_afastado', created_at: '2026-02-12T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p5', nome: 'Patrícia Almeida Santos', status_ficha: 'dmg_confirmado', created_at: '2026-02-20T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p6', nome: 'Camila Rodrigues', status_ficha: 'dmg_confirmado', created_at: '2026-03-22T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p7', nome: 'Fernanda Costa Lima', status_ficha: 'resultado_parto', created_at: '2026-02-05T10:00:00Z', data_proximo_retorno: null, profissional_id: 'preview', unidade_id: null },
    { id: 'p8', nome: 'Beatriz Mendes', status_ficha: 'encaminhada_endocrino', created_at: '2026-03-28T10:00:00Z', data_proximo_retorno: '2026-04-10T10:00:00Z', profissional_id: 'preview', unidade_id: null },
  ]).map(p => ({ ...p, ...PREVIEW_EXTRA[p.id] }));
}

// IG (semanas) das consultas diagnósticas da vitrine.
const PREVIEW_IG: Record<string, number> = { c1b: 14, c5c: 26, c6c: 30, c7b: 12, c8c: 26 };

function generatePreviewConsultas(): Consulta[] {
  return ([
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

    // Fernanda (p7): registro de parto (dados em observacoes, como no app)
    {
      id: 'c7c', paciente_id: 'p7', cenario_clinico: '5', tipo: 'registro_parto', created_at: '2026-09-02T10:00:00Z',
      observacoes: JSON.stringify({
        via_parto: 'vaginal', ig_semanas: 38, ig_dias: 4, peso_rn_g: 3420, classificacao_rn: 'AIG',
        intercorrencias_maternas: false, intercorrencias_neonatais: false, aleitamento_sala_parto: true,
      }),
    },
  ] as Consulta[]).map(c => ({
    ...c,
    data: c.created_at.slice(0, 10),
    ig_semanas: PREVIEW_IG[c.id] ?? null,
    ig_dias: PREVIEW_IG[c.id] != null ? 0 : null,
  }));
}

function generatePreviewPerfis(): PerfilMetrica[] {
  return [
    { paciente_id: 'p1', percentual_meta: 72, data_inicio: '2026-03-18', created_at: '2026-03-25T10:00:00Z' },
    { paciente_id: 'p1', percentual_meta: 88, data_inicio: '2026-04-01', created_at: '2026-04-08T10:00:00Z' },
    { paciente_id: 'p5', percentual_meta: 81, data_inicio: '2026-03-16', created_at: '2026-03-23T10:00:00Z' },
    { paciente_id: 'p6', percentual_meta: 54, data_inicio: '2026-04-09', created_at: '2026-04-16T10:00:00Z' },
    { paciente_id: 'p7', percentual_meta: 90, data_inicio: '2026-02-13', created_at: '2026-02-20T10:00:00Z' },
    { paciente_id: 'p8', percentual_meta: 48, data_inicio: '2026-04-08', created_at: '2026-04-09T10:00:00Z' },
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
