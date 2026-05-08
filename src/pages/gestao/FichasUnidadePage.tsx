import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileDown, FileText, ChevronLeft, ChevronRight, AlertTriangle, AlertCircle, AlertOctagon, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { STATUS_CONFIG, calcIdadeGestacional } from '@/lib/fichaUtils';
import { slugify } from '@/lib/slugify';

const STATUS_CHIP_KEYS = [
  'aguardando_gj',
  'aguardando_gtt',
  'dmg_confirmado',
  'dmg_afastado',
  'resultado_parto',
  'encaminhada_endocrino',
] as const;

interface Ficha {
  id: string;
  nome: string;
  status_ficha: string;
  profissional_id: string;
  profissional_nome: string;
  data_ultima_consulta: string | null;
  data_proximo_retorno: string | null;
  created_at: string;
  dum: string | null;
  usg_data: string | null;
  usg_ig_semanas: number | null;
  usg_ig_dias: number | null;
}

const PAGE_SIZE = 20;

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function buildVitrineFichas(): Ficha[] {
  const base = [
    { nome: 'Maria Souza', status_ficha: 'dmg_confirmado', prof: 'Dra. Ana Souza',  semWeeks: 28, semDays: 3, ult: 1, prox: 6 },
    { nome: 'Beatriz Alves', status_ficha: 'aguardando_gtt', prof: 'Dr. Carlos Lima', semWeeks: 24, semDays: 1, ult: 2, prox: 5 },
    { nome: 'Júlia Costa',   status_ficha: 'dmg_confirmado', prof: 'Dra. Bia Mello',  semWeeks: 32, semDays: 5, ult: 3, prox: 4 },
    { nome: 'Renata Lima',   status_ficha: 'dmg_afastado',   prof: 'Dr. Diego Reis',  semWeeks: 36, semDays: 2, ult: 4, prox: 9 },
    { nome: 'Camila Rocha',  status_ficha: 'aguardando_gj',  prof: 'Dra. Ana Souza',  semWeeks: 20, semDays: 0, ult: 5, prox: 2 },
  ];
  const extras = ['Mariana Silva','Patrícia Souza','Larissa Pinto','Fernanda Dias','Helena Pires','Roberta Cunha','Aline Tavares','Tatiana Reis','Sofia Mendes','Vivian Gomes','Carla Nogueira','Bianca Moura','Yasmin Borges','Eduarda Pacheco','Joana Vieira','Isabela Ramos','Karina Brito','Luana Sales'];
  const profs = ['Dra. Ana Souza', 'Dr. Carlos Lima', 'Dra. Bia Mello', 'Dr. Diego Reis'];
  const statuses = ['dmg_confirmado','aguardando_gtt','dmg_afastado','aguardando_gj','encaminhada_endocrino'];
  const today = Date.now();
  const day = 86400000;
  const all = [...base, ...extras.map((nome, i) => ({
    nome,
    status_ficha: statuses[i % statuses.length],
    prof: profs[i % profs.length],
    semWeeks: 18 + (i * 3) % 20,
    semDays: i % 7,
    ult: (i + 6) % 30,
    prox: ((i + 1) % 20) - 5,
  }))];
  return all.map((f, i) => {
    const totalDias = f.semWeeks * 7 + f.semDays;
    const dum = new Date(today - totalDias * day).toISOString().slice(0, 10);
    const proxDate = f.prox >= 0 ? new Date(today + f.prox * day) : new Date(today - Math.abs(f.prox) * day);
    return {
      // primeiras 10 fichas mapeiam para pacientes demo navegáveis
      id: i < 10 ? `demo-${i + 1}` : `vit-${i}`,
      nome: f.nome,
      status_ficha: f.status_ficha,
      profissional_id: `p-${f.prof}`,
      profissional_nome: f.prof,
      data_ultima_consulta: new Date(today - f.ult * day).toISOString().slice(0, 10),
      data_proximo_retorno: proxDate.toISOString().slice(0, 10),
      created_at: new Date(today - (f.ult + 30) * day).toISOString(),
      dum,
      usg_data: null,
      usg_ig_semanas: null,
      usg_ig_dias: null,
    };
  });
}

export default function FichasUnidadePage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isVitrine = pathname.startsWith('/vitrine');
  const basePath = isVitrine ? '/vitrine/gestao' : '/gestao';

  const [fichas, setFichas] = useState<Ficha[]>(isVitrine ? buildVitrineFichas() : []);
  const [unidadeNome, setUnidadeNome] = useState(isVitrine ? 'Hospital Demo MARI' : '');
  const [gestorNome, setGestorNome] = useState('');
  const [loading, setLoading] = useState(!isVitrine);
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [searchParams, setSearchParams] = useSearchParams();
  const filtroParam = searchParams.get('filtro');
  const idsParam = searchParams.get('ids');
  const FILTRO_VALIDOS = ['sem_gj_primeira', 'atrasadas_gtt', 'sem_retorno'] as const;
  type FiltroKey = typeof FILTRO_VALIDOS[number];
  const filtroAtivo: FiltroKey | null =
    filtroParam && (FILTRO_VALIDOS as readonly string[]).includes(filtroParam)
      ? (filtroParam as FiltroKey)
      : null;
  const idsFiltro = useMemo(() => {
    if (!filtroAtivo || idsParam == null) return null;
    return new Set(idsParam.split(',').map(s => s.trim()).filter(Boolean));
  }, [filtroAtivo, idsParam]);

  const FILTRO_META: Record<FiltroKey, { titulo: string; cor: 'amarelo' | 'laranja' | 'vermelho'; Icon: typeof AlertTriangle }> = {
    sem_gj_primeira: { titulo: 'Sem GJ na primeira consulta', cor: 'amarelo', Icon: AlertTriangle },
    atrasadas_gtt: { titulo: 'GTT em atraso', cor: 'laranja', Icon: AlertCircle },
    sem_retorno: { titulo: 'DMG confirmado sem retorno', cor: 'vermelho', Icon: AlertOctagon },
  };
  const CHIP_STYLES: Record<'amarelo' | 'laranja' | 'vermelho', string> = {
    amarelo: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    laranja: 'bg-orange-50 border-orange-200 text-orange-900',
    vermelho: 'bg-red-50 border-red-200 text-red-900',
  };

  const limparFiltroGargalo = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('filtro');
    next.delete('ids');
    setSearchParams(next, { replace: true });
  };

  // debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPage(1);
  }, [buscaDebounced]);

  useEffect(() => {
    if (isVitrine || !user) return;
    (async () => {
      setLoading(true);
      // resolve unidade do gestor
      const { data: prof } = await supabase
        .from('profissionais')
        .select('nome, unidade_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!prof?.unidade_id) {
        setLoading(false);
        return;
      }
      setGestorNome(prof.nome || '');
      const [unidadeRes, profsRes] = await Promise.all([
        supabase.from('unidades').select('nome').eq('id', prof.unidade_id).single(),
        supabase.from('profissionais').select('id, nome').eq('unidade_id', prof.unidade_id),
      ]);
      setUnidadeNome(unidadeRes.data?.nome || '');
      const profsMap = new Map((profsRes.data || []).map(p => [p.id, p.nome]));

      const { data: pacs } = await supabase
        .from('pacientes')
        .select('id, nome, status_ficha, profissional_id, data_ultima_consulta, data_proximo_retorno, created_at, dum, usg_data, usg_ig_semanas, usg_ig_dias')
        .eq('unidade_id', prof.unidade_id)
        .eq('is_rascunho', false);

      setFichas((pacs || []).map((p: any) => ({
        id: p.id,
        nome: p.nome,
        status_ficha: p.status_ficha,
        profissional_id: p.profissional_id,
        profissional_nome: (profsMap.get(p.profissional_id) || 'Desconhecido') as string,
        data_ultima_consulta: p.data_ultima_consulta,
        data_proximo_retorno: p.data_proximo_retorno,
        created_at: p.created_at,
        dum: p.dum,
        usg_data: p.usg_data,
        usg_ig_semanas: p.usg_ig_semanas,
        usg_ig_dias: p.usg_ig_dias,
      })));
      setLoading(false);
    })();
  }, [isVitrine, user]);

  const contagensStatus = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const f of fichas) {
      acc[f.status_ficha] = (acc[f.status_ficha] || 0) + 1;
    }
    return acc;
  }, [fichas]);

  const kpiTotal = fichas.length;
  const kpiAguardandoGj = contagensStatus['aguardando_gj'] || 0;
  const kpiAcompanhamento =
    (contagensStatus['aguardando_gtt'] || 0) +
    (contagensStatus['dmg_confirmado'] || 0) +
    (contagensStatus['encaminhada_endocrino'] || 0);
  const kpiConcluidas =
    (contagensStatus['dmg_afastado'] || 0) +
    (contagensStatus['resultado_parto'] || 0);

  const filtradas = useMemo(() => {
    let base = fichas;
    if (idsFiltro) base = base.filter(f => idsFiltro.has(f.id));
    if (statusFiltro) base = base.filter(f => f.status_ficha === statusFiltro);
    if (!buscaDebounced.trim()) return base;
    const q = stripAccents(buscaDebounced.trim());
    return base.filter(f => stripAccents(f.nome).includes(q));
  }, [fichas, buscaDebounced, idsFiltro, statusFiltro]);

  useEffect(() => {
    setPage(1);
  }, [statusFiltro]);

  const limparTodosFiltros = () => {
    setStatusFiltro(null);
    setBusca('');
  };

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtradas.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);
  const inicio = filtradas.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1;
  const fim = Math.min(pageSafe * PAGE_SIZE, filtradas.length);

  const fmtBR = (v: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '—';
  const slugFiltro = statusFiltro ? slugify(STATUS_CONFIG[statusFiltro]?.label || statusFiltro) : 'todas';
  const fileBase = `fichas-unidade-${slugFiltro}_${(unidadeNome || 'unidade').replace(/\s+/g, '')}_${format(new Date(), 'yyyy-MM-dd')}`;

  const exportCSV = () => {
    if (isVitrine) {
      toast.info('Exportar CSV disponível no ambiente real.');
      return;
    }
    const headers = ['Paciente', 'IG', 'Status', 'Profissional', 'Última consulta', 'Próxima consulta', 'Data diagnóstico (status)', 'Criada em'];
    const rows = filtradas.map(f => [
      f.nome,
      calcIdadeGestacional(f),
      STATUS_CONFIG[f.status_ficha]?.label || f.status_ficha,
      f.profissional_nome,
      fmtBR(f.data_ultima_consulta),
      fmtBR(f.data_proximo_retorno),
      f.status_ficha,
      new Date(f.created_at).toLocaleDateString('pt-BR'),
    ]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo CSV gerado.');
  };

  const exportPDF = () => {
    if (isVitrine) {
      toast.info('Exportar PDF disponível no ambiente real.');
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 36;
    let y = margin;

    doc.setFontSize(14);
    doc.text('Fichas da unidade', margin, y);
    y += 18;
    doc.setFontSize(10);
    doc.text(`Unidade: ${unidadeNome || '—'}`, margin, y); y += 14;
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, margin, y); y += 14;
    if (gestorNome) { doc.text(`Gestor: ${gestorNome}`, margin, y); y += 14; }
    y += 8;

    const colWs = [120, 60, 90, 100, 70, 70];
    const headers = ['Paciente', 'IG', 'Status', 'Profissional', 'Últ.', 'Próx.'];
    const drawHeader = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      let x = margin;
      headers.forEach((h, i) => { doc.text(h, x + 2, y); x += colWs[i]; });
      y += 12;
      doc.setLineWidth(0.5);
      doc.line(margin, y - 4, margin + colWs.reduce((a, b) => a + b, 0), y - 4);
      doc.setFont('helvetica', 'normal');
    };
    drawHeader();

    filtradas.forEach(f => {
      if (y > pageH - margin - 30) {
        doc.addPage();
        y = margin;
        drawHeader();
      }
      const row = [
        f.nome,
        calcIdadeGestacional(f),
        STATUS_CONFIG[f.status_ficha]?.label || f.status_ficha,
        f.profissional_nome,
        fmtBR(f.data_ultima_consulta),
        fmtBR(f.data_proximo_retorno),
      ];
      let x = margin;
      row.forEach((cell, i) => {
        const text = doc.splitTextToSize(String(cell), colWs[i] - 4);
        doc.text(text, x + 2, y);
        x += colWs[i];
      });
      y += 14;
    });

    // rodapé "Página X de Y"
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.text(`Página ${p} de ${total}`, pageW - margin, pageH - margin / 2, { align: 'right' });
    }

    doc.save(`${fileBase}.pdf`);
    toast.success('Relatório PDF gerado.');
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Fichas da unidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lista completa de pacientes em acompanhamento.</p>
      </div>

      {/* Header de KPIs operacionais */}
      <div className="mb-4 grid grid-cols-2 divide-x divide-border rounded-xl border border-border bg-card p-5 sm:grid-cols-4">
        {[
          { label: 'Total', valor: kpiTotal },
          { label: 'Aguardando GJ', valor: kpiAguardandoGj },
          { label: 'Em acompanhamento', valor: kpiAcompanhamento },
          { label: 'Concluídas', valor: kpiConcluidas },
        ].map((kpi, i) => (
          <div key={kpi.label} className={`flex flex-col px-4 ${i === 0 ? 'sm:pl-0' : ''}`}>
            <span className="font-heading text-3xl font-bold text-foreground">{kpi.valor}</span>
            <span className="mt-1 text-xs text-muted-foreground">{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* Chips de filtro por tag */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => statusFiltro !== null && setStatusFiltro(null)}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
            statusFiltro === null
              ? 'bg-[#EDE7F6] border-[#7C4DBA] text-[#5B3A8C] font-medium'
              : 'bg-white border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer'
          }`}
        >
          Todos ({kpiTotal})
        </button>
        {STATUS_CHIP_KEYS.map(key => {
          const cfg = STATUS_CONFIG[key];
          if (!cfg) return null;
          const ativo = statusFiltro === key;
          const count = contagensStatus[key] || 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => !ativo && setStatusFiltro(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition ${
                ativo
                  ? 'bg-[#EDE7F6] border-[#7C4DBA] text-[#5B3A8C] font-medium'
                  : 'bg-white border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer'
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${cfg.color}`} />
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-[400px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome de paciente..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading || filtradas.length === 0}>
            <FileDown className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading || filtradas.length === 0}>
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
        </div>
      </div>

      {filtroAtivo && (() => {
        const meta = FILTRO_META[filtroAtivo];
        const count = filtradas.length;
        const Icon = meta.Icon;
        return (
          <div className="mb-4">
            <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${CHIP_STYLES[meta.cor]}`}>
              <Icon className="h-4 w-4" />
              <span className="font-medium">{meta.titulo}</span>
              <span className="font-normal">· {count} {count === 1 ? 'paciente' : 'pacientes'}</span>
              <button
                type="button"
                aria-label="Limpar filtro de gargalo"
                onClick={limparFiltroGargalo}
                className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })()}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#5B3A8E] hover:bg-[#5B3A8E]">
              <TableHead className="text-white">Paciente</TableHead>
              <TableHead className="text-white">IG</TableHead>
              <TableHead className="text-white">Status</TableHead>
              <TableHead className="text-white">Profissional</TableHead>
              <TableHead className="text-white">Última consulta</TableHead>
              <TableHead className="text-white">Próxima consulta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mb-3 mx-auto" />
                  {(statusFiltro || buscaDebounced.trim()) && fichas.length > 0 ? (
                    <>
                      <p className="text-sm text-muted-foreground">Nenhuma ficha corresponde aos filtros aplicados.</p>
                      <Button variant="outline" size="sm" className="mt-4" onClick={limparTodosFiltros}>
                        Limpar filtros
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {filtroAtivo
                        ? 'Sem pacientes neste gargalo no momento.'
                        : fichas.length === 0
                        ? 'Nenhuma ficha cadastrada nesta unidade ainda.'
                        : 'Nenhuma paciente encontrada com esse nome. Tente outra busca.'}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((f, idx) => {
                const cfg = STATUS_CONFIG[f.status_ficha];
                return (
                  <TableRow
                    key={f.id}
                    className={`cursor-pointer ${idx % 2 === 1 ? 'bg-[#F5F3FA]' : ''}`}
                    onClick={() => navigate(`${basePath}/fichas/${f.id}`)}
                  >
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{calcIdadeGestacional(f)}</TableCell>
                    <TableCell>
                      {cfg ? (
                        <Badge className={`${cfg.color} text-white border-0`}>{cfg.label}</Badge>
                      ) : (
                        <Badge variant="outline">{f.status_ficha}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{f.profissional_nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtBR(f.data_ultima_consulta)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtBR(f.data_proximo_retorno)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {filtradas.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Exibindo {inicio}-{fim} de {filtradas.length} fichas</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            <span>Página {pageSafe} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe >= totalPages}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
