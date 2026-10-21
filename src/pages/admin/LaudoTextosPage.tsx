import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Pencil, Loader2, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SUPPORTED_LANGUAGES, LANGUAGE_META, type SupportedLanguage } from '@/i18n';
import {
  VARIAVEIS_LAUDO, labelBloco, variaveisDesconhecidas, ajudaCenario,
  cenarioTecnicoOculto, familiaTipo, tipoRepresentante, notaFamilia,
  ordemFamilia, ordemDesfecho, rotuloCenario, ehPedidoExame, type LaudoTextoRow,
} from '@/lib/laudoTextosAdmin';
import type { Traducoes } from '../../../supabase/functions/_shared/traducaoLaudo';

// O português é a fonte: salvar um rascunho em PT gera os rascunhos traduzidos
// em EN/ES, e publicar o PT publica os três juntos.
const IDIOMA_ORIGEM: SupportedLanguage = 'pt-BR';
const IDIOMAS_TRADUZIDOS = ['en-US', 'es'] as const;

interface BlocoAgrupado {
  bloco: string;
  ordem_bloco: number;
  publicados: LaudoTextoRow[]; // 1 (Retorno 1/GTT) ou 2 (Ficha A/C e B/D)
  rascunhos: LaudoTextoRow[];
}
interface CenarioAgrupado {
  key: string;
  familia: string;
  desfecho_clinico: string;
  blocos: BlocoAgrupado[];
}

// Bandeiras (mesmas imagens do LanguageSwitcher — emoji não renderiza no Windows).
const FLAG_SRC: Record<SupportedLanguage, string> = {
  'pt-BR': 'https://flagcdn.com/w40/br.png',
  'en-US': 'https://flagcdn.com/w40/us.png',
  'es': 'https://flagcdn.com/w40/es.png',
};

export default function LaudoTextosPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fase 2 — idioma ativo do editor (PT/EN/ES). Cada idioma é uma coleção
  // independente de textos; edita-se um por vez pela aba selecionada.
  const [idioma, setIdioma] = useState<SupportedLanguage>('pt-BR');
  // Tradutor fixo no idioma da ABA — os rótulos (títulos dos cenários, blocos,
  // notas) saem no idioma selecionado, não no idioma da interface.
  const tt = useMemo(() => i18n.getFixedT(idioma), [i18n, idioma]);
  const [editando, setEditando] = useState<{ cenario: CenarioAgrupado; bloco: BlocoAgrupado } | null>(null);
  const [formTexto, setFormTexto] = useState('');
  const [formTitulo, setFormTitulo] = useState('');
  const [saving, setSaving] = useState(false);
  const [traduzindo, setTraduzindo] = useState(false);
  const [publicarAlvo, setPublicarAlvo] = useState<BlocoAgrupado | null>(null);
  const [descartarAlvo, setDescartarAlvo] = useState<BlocoAgrupado | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-laudo-textos', idioma],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('laudo_textos')
        .select('id, tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, versao, status, observacoes, idioma')
        .in('status', ['publicado', 'rascunho'])
        .eq('idioma', idioma)
        .order('ordem_bloco', { ascending: true });
      if (error) throw error;
      return (data ?? []) as LaudoTextoRow[];
    },
  });

  const cenarios = useMemo<CenarioAgrupado[]>(() => {
    const rows = data ?? [];
    const map = new Map<string, CenarioAgrupado>();
    for (const r of rows) {
      const familia = familiaTipo(r.tipo_consulta);
      const key = `${familia}::${r.desfecho_clinico}`;
      let cen = map.get(key);
      if (!cen) {
        cen = { key, familia, desfecho_clinico: r.desfecho_clinico, blocos: [] };
        map.set(key, cen);
      }
      let b = cen.blocos.find((x) => x.bloco === r.bloco);
      if (!b) {
        b = { bloco: r.bloco, ordem_bloco: r.ordem_bloco, publicados: [], rascunhos: [] };
        cen.blocos.push(b);
      }
      if (r.status === 'publicado') b.publicados.push(r);
      else if (r.status === 'rascunho') b.rascunhos.push(r);
    }
    for (const cen of map.values()) cen.blocos.sort((a, b) => a.ordem_bloco - b.ordem_bloco);
    // Oculta cenários técnicos/legados (rede de segurança) e ordena por família/desfecho.
    return [...map.values()]
      .filter((c) => !cenarioTecnicoOculto(tipoRepresentante(c.familia), c.desfecho_clinico))
      .sort(
        (a, b) =>
          ordemFamilia(a.familia) - ordemFamilia(b.familia) ||
          ordemDesfecho(a.desfecho_clinico) - ordemDesfecho(b.desfecho_clinico),
      );
  }, [data]);

  const totalRascunhos = useMemo(
    () => cenarios.reduce((acc, c) => acc + c.blocos.filter((b) => b.rascunhos.length > 0).length, 0),
    [cenarios],
  );

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-laudo-textos'] });

  // Registros EN/ES (publicados e rascunhos) do mesmo bloco do PT.
  const buscarTraducoesDoBloco = async (bloco: BlocoAgrupado) => {
    const ref = bloco.publicados[0] ?? bloco.rascunhos[0];
    const tipos = [...new Set([...bloco.publicados, ...bloco.rascunhos].map((r) => r.tipo_consulta))];
    const { data, error } = await supabase
      .from('laudo_textos')
      .select('id, tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, versao, status, observacoes, idioma')
      .in('idioma', [...IDIOMAS_TRADUZIDOS])
      .in('tipo_consulta', tipos)
      .eq('desfecho_clinico', ref.desfecho_clinico)
      .eq('bloco', ref.bloco)
      .in('status', ['publicado', 'rascunho']);
    if (error) throw error;
    return (data ?? []) as LaudoTextoRow[];
  };

  // Traduz o texto PT (Edge Function) e grava/atualiza os rascunhos EN/ES.
  // Devolve o código do erro, ou null se deu certo.
  const gerarRascunhosTraduzidos = async (bloco: BlocoAgrupado, titulo: string, texto: string) => {
    const { data, error } = await supabase.functions.invoke('traduzir-laudo-texto', {
      body: { titulo, texto },
    });
    if (error || data?.status !== 'ok') {
      let payload: { codigo?: string; mensagem?: string } | null = data ?? null;
      if (error) {
        try {
          payload = await (error as { context?: Response }).context?.json?.();
        } catch {
          payload = null;
        }
      }
      console.error('[laudo-textos] traduzir:', payload ?? error);
      return payload?.codigo ?? 'falha_servico';
    }
    const traducoes = data.traducoes as Traducoes;
    const existentes = await buscarTraducoesDoBloco(bloco);
    for (const lng of IDIOMAS_TRADUZIDOS) {
      const tr = traducoes[lng];
      for (const pub of bloco.publicados) {
        const doIdioma = existentes.filter((r) => r.idioma === lng && r.tipo_consulta === pub.tipo_consulta);
        const rasc = doIdioma.find((r) => r.status === 'rascunho');
        const pubAlvo = doIdioma.find((r) => r.status === 'publicado');
        if (rasc) {
          const { error: e } = await supabase
            .from('laudo_textos')
            .update({ texto: tr.texto, titulo_bloco: tr.titulo || null })
            .eq('id', rasc.id);
          if (e) throw e;
        } else {
          const { error: e } = await supabase.from('laudo_textos').insert({
            tipo_consulta: pub.tipo_consulta,
            desfecho_clinico: pub.desfecho_clinico,
            bloco: pub.bloco,
            ordem_bloco: pub.ordem_bloco,
            titulo_bloco: tr.titulo || null,
            texto: tr.texto,
            status: 'rascunho',
            versao: (pubAlvo?.versao ?? 0) + 1,
            criado_por: user?.id ?? null,
            idioma: lng,
          });
          if (e) throw e;
        }
      }
    }
    return null;
  };

  // Publica os rascunhos EN/ES do bloco (gerados a partir do PT). Devolve quantos publicou.
  const publicarTraducoes = async (bloco: BlocoAgrupado) => {
    const existentes = await buscarTraducoesDoBloco(bloco);
    const agora = new Date().toISOString();
    let publicados = 0;
    for (const rasc of existentes.filter((r) => r.status === 'rascunho')) {
      const pubAlvo = existentes.find(
        (r) => r.status === 'publicado' && r.idioma === rasc.idioma && r.tipo_consulta === rasc.tipo_consulta,
      );
      if (pubAlvo) {
        const { error: upErr } = await supabase
          .from('laudo_textos')
          .update({ texto: rasc.texto, titulo_bloco: rasc.titulo_bloco, publicado_em: agora, publicado_por: user?.id ?? null })
          .eq('id', pubAlvo.id);
        if (upErr) throw upErr;
        const { error: delErr } = await supabase.from('laudo_textos').delete().eq('id', rasc.id);
        if (delErr) throw delErr;
      } else {
        // Bloco ainda sem versão neste idioma: o próprio rascunho vira o publicado.
        const { error: upErr } = await supabase
          .from('laudo_textos')
          .update({ status: 'publicado', publicado_em: agora, publicado_por: user?.id ?? null })
          .eq('id', rasc.id);
        if (upErr) throw upErr;
      }
      publicados++;
    }
    return publicados;
  };

  const abrirEdicao = (cenario: CenarioAgrupado, bloco: BlocoAgrupado) => {
    const base = bloco.rascunhos[0] ?? bloco.publicados[0];
    setEditando({ cenario, bloco });
    setFormTexto(base?.texto ?? '');
    setFormTitulo(base?.titulo_bloco ?? '');
  };

  // Salva o mesmo texto/título como rascunho em TODOS os registros do bloco
  // (Ficha A/C e B/D = 2 registros; demais = 1).
  const salvarRascunho = async () => {
    if (!editando || editando.bloco.publicados.length === 0) return;
    if (!formTexto.trim()) {
      toast.error(t('admin.laudoTextos.textoVazioError'));
      return;
    }
    setSaving(true);
    try {
      for (const pub of editando.bloco.publicados) {
        const rasc = editando.bloco.rascunhos.find((r) => r.tipo_consulta === pub.tipo_consulta);
        if (rasc) {
          const { error } = await supabase
            .from('laudo_textos')
            .update({ texto: formTexto, titulo_bloco: formTitulo || null })
            .eq('id', rasc.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('laudo_textos').insert({
            tipo_consulta: pub.tipo_consulta,
            desfecho_clinico: pub.desfecho_clinico,
            bloco: pub.bloco,
            ordem_bloco: pub.ordem_bloco,
            titulo_bloco: formTitulo || null,
            texto: formTexto,
            status: 'rascunho',
            versao: (pub.versao ?? 1) + 1,
            criado_por: user?.id ?? null,
            idioma: pub.idioma,
          });
          if (error) throw error;
        }
      }

      // O rascunho em PT já está salvo; agora gera as traduções EN/ES. Se a
      // tradução falhar, o PT continua salvo e é só salvar de novo.
      if (idioma === IDIOMA_ORIGEM) {
        setTraduzindo(true);
        let codigo: string | null;
        try {
          codigo = await gerarRascunhosTraduzidos(editando.bloco, formTitulo.trim(), formTexto);
        } catch (e) {
          console.error('[laudo-textos] gravar traduções:', e);
          codigo = 'falha_gravar';
        }
        if (codigo === null) toast.success(t('admin.laudoTextos.rascunhoSalvoTraduzido'));
        else if (codigo === 'variaveis_alteradas') toast.warning(t('admin.laudoTextos.traducaoVariaveisError'));
        else toast.warning(t('admin.laudoTextos.traducaoError'));
      } else {
        toast.success(t('admin.laudoTextos.rascunhoSalvo'));
      }
      setEditando(null);
      refresh();
    } catch (e) {
      console.error('[laudo-textos] salvar rascunho:', e);
      toast.error(t('admin.laudoTextos.rascunhoSalvarError'));
    } finally {
      setSaving(false);
      setTraduzindo(false);
    }
  };

  // Aplica o rascunho ao(s) publicado(s) e remove o(s) rascunho(s).
  const publicar = async () => {
    const alvo = publicarAlvo;
    if (!alvo || alvo.rascunhos.length === 0) return;
    setSaving(true);
    try {
      for (const pub of alvo.publicados) {
        const rasc = alvo.rascunhos.find((r) => r.tipo_consulta === pub.tipo_consulta);
        if (!rasc) continue;
        const { error: upErr } = await supabase
          .from('laudo_textos')
          .update({
            texto: rasc.texto,
            titulo_bloco: rasc.titulo_bloco,
            publicado_em: new Date().toISOString(),
            publicado_por: user?.id ?? null,
          })
          .eq('id', pub.id);
        if (upErr) throw upErr;
        const { error: delErr } = await supabase.from('laudo_textos').delete().eq('id', rasc.id);
        if (delErr) throw delErr;
      }
      // Publicar o PT publica junto as traduções EN/ES em rascunho.
      if (idioma === IDIOMA_ORIGEM) {
        const traduzidos = await publicarTraducoes(alvo);
        toast.success(
          t(traduzidos > 0 ? 'admin.laudoTextos.textoPublicadoTraducoes' : 'admin.laudoTextos.textoPublicadoSemTraducao'),
        );
      } else {
        toast.success(t('admin.laudoTextos.textoPublicado'));
      }
      setPublicarAlvo(null);
      refresh();
    } catch (e) {
      console.error('[laudo-textos] publicar:', e);
      toast.error(t('admin.laudoTextos.publicarError'));
    } finally {
      setSaving(false);
    }
  };

  const descartar = async () => {
    const alvo = descartarAlvo;
    if (!alvo || alvo.rascunhos.length === 0) return;
    setSaving(true);
    try {
      for (const rasc of alvo.rascunhos) {
        const { error } = await supabase.from('laudo_textos').delete().eq('id', rasc.id);
        if (error) throw error;
      }
      // Descartar o PT descarta junto as traduções EN/ES geradas a partir dele.
      if (idioma === IDIOMA_ORIGEM) {
        const traducoes = (await buscarTraducoesDoBloco(alvo)).filter((r) => r.status === 'rascunho');
        for (const rasc of traducoes) {
          const { error } = await supabase.from('laudo_textos').delete().eq('id', rasc.id);
          if (error) throw error;
        }
      }
      toast.success(t('admin.laudoTextos.rascunhoDescartado'));
      setDescartarAlvo(null);
      refresh();
    } catch (e) {
      console.error('[laudo-textos] descartar:', e);
      toast.error(t('admin.laudoTextos.descartarError'));
    } finally {
      setSaving(false);
    }
  };

  const varsDesc = variaveisDesconhecidas(formTexto);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-[Sora] text-2xl font-semibold text-[#5B3A8E]">{t('admin.laudoTextos.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading
            ? t('common.loading')
            : `${t('admin.laudoTextos.subtitleBase')} ${totalRascunhos > 0 ? t('admin.laudoTextos.rascunhosPendentes', { count: totalRascunhos }) : t('admin.laudoTextos.nenhumRascunho')}`}
        </p>
      </header>

      {/* Fase 2 — seletor de idioma. Cada idioma é uma coleção independente. */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-[#5B3A8E]">{t('admin.laudoTextos.idiomaLabel')}</span>
        <Tabs value={idioma} onValueChange={(v) => setIdioma(v as SupportedLanguage)}>
          <TabsList>
            {SUPPORTED_LANGUAGES.map((lng) => (
              <TabsTrigger key={lng} value={lng} className="gap-1.5">
                <img src={FLAG_SRC[lng]} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                {LANGUAGE_META[lng].short}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {idioma !== 'pt-BR' && (
          <div className="flex items-start gap-2 rounded-md bg-[#F1F0FB] px-3 py-2 text-xs text-[#5B21B6]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('admin.laudoTextos.idiomaAjuda')}</span>
          </div>
        )}
      </div>

      <details className="rounded-lg border border-[#E2E8F0] bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-[#5B3A8E]">
          {t('admin.laudoTextos.variaveisSummary')}
        </summary>
        <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {VARIAVEIS_LAUDO.map((v) => (
            <li key={v.chave} className="text-xs text-muted-foreground">
              <code className="rounded bg-[#F1F5F9] px-1 py-0.5 text-[#5B3A8E]">[{v.chave}]</code> — {v.descricao}
            </li>
          ))}
        </ul>
      </details>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <p className="text-sm text-red-600">{t('admin.laudoTextos.carregarError')}</p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {cenarios.map((cen) => {
            const rascunhosNoCenario = cen.blocos.filter((b) => b.rascunhos.length > 0).length;
            const ajuda = ajudaCenario(tipoRepresentante(cen.familia), cen.desfecho_clinico, tt);
            const nota = notaFamilia(cen.familia, tt);
            // Caso Novo (pedido de exame) ganha borda verde água para o time
            // clínico distinguir do laudo — não é um laudo, é uma orientação.
            const pedidoExame = ehPedidoExame(cen.familia);
            return (
              <AccordionItem
                key={cen.key}
                value={cen.key}
                className={
                  pedidoExame
                    ? 'rounded-lg border-2 border-[#5EEAD4] bg-[#F0FDFA] px-4'
                    : 'rounded-lg border border-[#E2E8F0] bg-white px-4'
                }
              >
                <AccordionTrigger className="text-sm hover:no-underline">
                  <span className="flex flex-wrap items-center gap-2 text-left">
                    <FileText
                      className={`h-4 w-4 shrink-0 ${pedidoExame ? 'text-[#0F766E]' : 'text-[#7C4DBA]'}`}
                    />
                    <span className="font-medium text-[#334155]">
                      {rotuloCenario(cen.familia, cen.desfecho_clinico, tt)}
                    </span>
                    {pedidoExame && (
                      <Badge className="border-0 bg-[#CCFBF1] text-[#0F766E]">
                        {t('admin.laudoTextos.pedidoExameBadge')}
                      </Badge>
                    )}
                    {ajuda && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex cursor-help"
                            aria-label={t('admin.laudoTextos.oQueEsteCenario')}
                          >
                            <Info className="h-3.5 w-3.5 text-[#7C4DBA]" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm text-xs leading-relaxed">
                          {ajuda}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {rascunhosNoCenario > 0 && (
                      <Badge className="border-0 bg-amber-100 text-amber-800">
                        {t('admin.laudoTextos.rascunhosBadge', { count: rascunhosNoCenario })}
                      </Badge>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pb-4">
                  {nota && (
                    <div
                      className={
                        pedidoExame
                          ? 'flex items-start gap-2 rounded-md bg-[#CCFBF1] px-3 py-2 text-xs text-[#0F766E]'
                          : 'flex items-start gap-2 rounded-md bg-[#F1F0FB] px-3 py-2 text-xs text-[#5B21B6]'
                      }
                    >
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{nota}</span>
                    </div>
                  )}
                  {cen.blocos.map((b) => (
                    <div key={b.bloco} className="rounded-md border border-[#E2E8F0] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#5B3A8E]">{labelBloco(b.bloco, tt)}</h3>
                        <div className="flex items-center gap-2">
                          {b.rascunhos.length > 0 ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => abrirEdicao(cen, b)}>
                                <Pencil className="mr-1 h-3.5 w-3.5" /> {t('admin.laudoTextos.editarRascunho')}
                              </Button>
                              <Button
                                size="sm"
                                className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
                                onClick={() => setPublicarAlvo(b)}
                              >
                                {t('admin.laudoTextos.publicar')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => setDescartarAlvo(b)}
                              >
                                {t('admin.laudoTextos.descartar')}
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => abrirEdicao(cen, b)}>
                              <Pencil className="mr-1 h-3.5 w-3.5" /> {t('common.edit')}
                            </Button>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                        {b.publicados[0]?.texto ?? <span className="italic">{t('admin.laudoTextos.semVersaoPublicada')}</span>}
                      </p>

                      {b.rascunhos.length > 0 && (
                        <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                            {t('admin.laudoTextos.rascunhoPendente')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-amber-900">
                            {b.rascunhos[0].texto}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Modal de edição */}
      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.laudoTextos.editarTexto')}{editando ? ` — ${labelBloco(editando.bloco.bloco, tt)}` : ''}</DialogTitle>
            <DialogDescription>
              {editando
                ? rotuloCenario(editando.cenario.familia, editando.cenario.desfecho_clinico, tt)
                : ''}
              {' · '}
              {t(idioma === IDIOMA_ORIGEM ? 'admin.laudoTextos.editarDescriptionTraduz' : 'admin.laudoTextos.editarDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {editando && notaFamilia(editando.cenario.familia, tt) && (
              <div className="flex items-start gap-2 rounded-md bg-[#F1F0FB] px-3 py-2 text-xs text-[#5B21B6]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{notaFamilia(editando.cenario.familia, tt)}</span>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#5B3A8E]">{t('admin.laudoTextos.tituloBlocoLabel')}</label>
              <Input value={formTitulo} onChange={(e) => setFormTitulo(e.target.value)} placeholder={t('common.optional')} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#5B3A8E]">{t('admin.laudoTextos.textoLabel')}</label>
              <Textarea
                value={formTexto}
                onChange={(e) => setFormTexto(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
            </div>

            {varsDesc.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t('admin.laudoTextos.variavelNaoReconhecida', { vars: varsDesc.map((v) => `[${v}]`).join(', ') })}
                </span>
              </div>
            )}

            <details className="text-xs">
              <summary className="cursor-pointer text-[#7C4DBA]">{t('admin.laudoTextos.verVariaveis')}</summary>
              <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {VARIAVEIS_LAUDO.map((v) => (
                  <li key={v.chave} className="text-muted-foreground">
                    <code className="rounded bg-[#F1F5F9] px-1 text-[#5B3A8E]">[{v.chave}]</code> — {v.descricao}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
              onClick={salvarRascunho}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {traduzindo
                ? t('admin.laudoTextos.traduzindo')
                : t(idioma === IDIOMA_ORIGEM ? 'admin.laudoTextos.salvarRascunhoTraduzir' : 'admin.laudoTextos.salvarRascunho')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar publicação */}
      <AlertDialog open={!!publicarAlvo} onOpenChange={(o) => { if (!o) setPublicarAlvo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.laudoTextos.publicarConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(idioma === IDIOMA_ORIGEM ? 'admin.laudoTextos.publicarConfirmDescTraducoes' : 'admin.laudoTextos.publicarConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#7C4DBA] text-white hover:bg-[#5B3A8E]"
              onClick={(e) => { e.preventDefault(); publicar(); }}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.laudoTextos.publicar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar descarte */}
      <AlertDialog open={!!descartarAlvo} onOpenChange={(o) => { if (!o) setDescartarAlvo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.laudoTextos.descartarConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(idioma === IDIOMA_ORIGEM ? 'admin.laudoTextos.descartarConfirmDescTraducoes' : 'admin.laudoTextos.descartarConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); descartar(); }}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('admin.laudoTextos.descartar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
