/**
 * V4 (set/2026) — Pactuação do PRÓXIMO perfil, ao final do laudo.
 *
 * Regra clínica (Moara): quando o laudo desta consulta indica que a paciente
 * vai levar perfil para casa (diagnóstico confirmado ou continuação sem
 * insulina), o profissional pactua AQUI a janela pós-prandial (1h/2h), o
 * período (início/fim) e imprime o papel para a gestante — tudo antes de ela
 * sair do consultório. A ficha SEGUINTE lê essa pactuação e pré-preenche os
 * campos correspondentes, deixando o profissional só confirmar ou editar.
 *
 * Comportamento:
 *  - Se a pactuação já existe (laudo emitido antes), o card aparece em modo
 *    LEITURA com "editar" — não sobrescreve por engano.
 *  - Se ainda não existe, mostra o form completo. Datas propostas são hoje+1
 *    (início) e início+(prazoRetorno-1) (fim), calculadas pela mesma regra
 *    canônica de retornoInterval.ts (a mesma que rege o próximo agendamento).
 *  - Salvar grava as 4 colunas em `consultas` e imprime o papel na sequência.
 *  - Vitrine (isPreview) não persiste — só imprime.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Printer, Pencil, CheckCircle2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { parseDateLocal } from '@/lib/dateUtils';
import {
  gerarPapelControle,
  imprimirPapelControle,
  datasEntreInicioEFim,
} from '@/lib/papelControle';
import { calcularIntervaloRetornoDias } from '@/lib/retornoInterval';
import type { PontosProxPerfil } from '@/lib/pactuacaoProxPerfil';

const POINTS_4 = ['jejum', 'pos_cafe', 'pos_almoco', 'pos_jantar'] as const;
const POINTS_6 = ['jejum', 'pos_cafe', 'pre_almoco', 'pos_almoco', 'pre_jantar', 'pos_jantar'] as const;

interface Props {
  consultaId: string;
  isPreview: boolean;
  nomeGestante: string;
  pontos: PontosProxPerfil;
  /**
   * Já pactuado antes? (Consulta que já teve laudo emitido com pactuação.) Se
   * vier preenchido, o card entra em modo leitura.
   */
  pactuacaoExistente: {
    janela: '1h' | '2h';
    inicio: string; // yyyy-MM-dd
    fim: string;    // yyyy-MM-dd
  } | null;
  /**
   * Dados para calcular a data de fim proposta pela mesma regra do próximo
   * retorno. Espelha os parâmetros de `calcularIntervaloRetornoDias`.
   */
  contextoPrazo: {
    ehFichaE: boolean;         // 6 pontos = ficha_e
    ehPrimeiroPerfil: boolean; // 1º perfil pós-diagnóstico → 10 dias
    igSemanas: number | null;
    regraAplicada: string | null;
  };
  /** Depois de salvar, o pai pode querer atualizar a query — opcional. */
  onSalvo?: () => void;
}

function isoHoje(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** yyyy-MM-dd + N dias, mantendo o formato. */
function somarDiasIso(iso: string, dias: number): string {
  const base = parseDateLocal(iso);
  if (!base) return iso;
  return format(addDays(base, dias), 'yyyy-MM-dd');
}

function paraDdMmYyyy(iso: string): string {
  const d = parseDateLocal(iso);
  return d ? format(d, 'dd/MM/yyyy') : iso;
}

export default function PactuacaoProxPerfilCard({
  consultaId,
  isPreview,
  nomeGestante,
  pontos,
  pactuacaoExistente,
  contextoPrazo,
  onSalvo,
}: Props) {
  const { t } = useTranslation();

  // Modo: leitura (já pactuado + botão editar) x edição (form aberto).
  const [modoLeitura, setModoLeitura] = useState(pactuacaoExistente != null);
  useEffect(() => setModoLeitura(pactuacaoExistente != null), [pactuacaoExistente]);

  // Prazo canônico do próximo retorno — mesma regra do agendamento.
  const prazoDias = useMemo(
    () =>
      calcularIntervaloRetornoDias({
        ehFichaE: contextoPrazo.ehFichaE,
        ehPrimeiroPerfil: contextoPrazo.ehPrimeiroPerfil,
        igSemanas: contextoPrazo.igSemanas,
        regraAplicada: contextoPrazo.regraAplicada,
      }),
    [contextoPrazo.ehFichaE, contextoPrazo.ehPrimeiroPerfil, contextoPrazo.igSemanas, contextoPrazo.regraAplicada],
  );

  // Defaults: hoje+1 (início) e início+(prazo-1) (fim). Editáveis.
  const inicioDefault = useMemo(() => somarDiasIso(isoHoje(), 1), []);
  const fimDefault = useMemo(() => somarDiasIso(inicioDefault, Math.max(0, prazoDias - 1)), [inicioDefault, prazoDias]);

  const [janela, setJanela] = useState<'1h' | '2h' | null>(pactuacaoExistente?.janela ?? null);
  const [inicio, setInicio] = useState<string>(pactuacaoExistente?.inicio ?? inicioDefault);
  const [fim, setFim] = useState<string>(pactuacaoExistente?.fim ?? fimDefault);
  const [salvando, setSalvando] = useState(false);

  // Ao trocar o modo (leitura ⇄ edição), sincroniza os campos com o que veio.
  useEffect(() => {
    if (pactuacaoExistente) {
      setJanela(pactuacaoExistente.janela);
      setInicio(pactuacaoExistente.inicio);
      setFim(pactuacaoExistente.fim);
    }
  }, [pactuacaoExistente]);

  const camposValidos =
    (janela === '1h' || janela === '2h') &&
    !!inicio &&
    !!fim &&
    !!parseDateLocal(inicio) &&
    !!parseDateLocal(fim) &&
    (parseDateLocal(inicio) as Date) <= (parseDateLocal(fim) as Date);

  const imprimirAgora = () => {
    if (!camposValidos) return;
    const datas = datasEntreInicioEFim(inicio, fim);
    if (datas.length === 0) {
      toast.error(t('laudo.pactuacaoProxPerfil.erro.periodoInvalido'));
      return;
    }
    const pts = pontos === 6 ? POINTS_6 : POINTS_4;
    const doc = gerarPapelControle(
      { nomeGestante: nomeGestante || '—', datas },
      {
        titulo: t('fichaAC.papelControle.titulo'),
        instrucao: t('fichaAC.papelControle.instrucao'),
        rotuloGestante: t('fichaAC.papelControle.gestante'),
        rotuloPeriodo: t('fichaAC.papelControle.periodo'),
        colunaData: t('fichaAC.papelControle.data'),
        colunas: pts.map((p) => t(`fichaAC.papelControle.ponto.${p}`)),
        subColunas: pts.map((p) =>
          p === 'jejum'
            ? t('fichaAC.papelControle.sub.jejum')
            : p.startsWith('pre_')
            ? t('fichaAC.papelControle.sub.pre')
            : janela === '2h'
            ? t('fichaAC.papelControle.sub.pos2h')
            : t('fichaAC.papelControle.sub.pos'),
        ),
        rodape: t('fichaAC.papelControle.rodape'),
        nomeArquivo: t('fichaAC.papelControle.arquivo'),
      },
    );
    imprimirPapelControle(doc, t('fichaAC.papelControle.arquivo'));
  };

  const salvarEImprimir = async () => {
    if (!camposValidos || salvando) return;
    if (isPreview) {
      // Vitrine não persiste; só imprime pra experimentar o fluxo.
      imprimirAgora();
      toast.success(t('laudo.pactuacaoProxPerfil.impresso'));
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('consultas')
        .update({
          pactuou_janela_prox_perfil: janela,
          pactuou_inicio_prox_perfil: inicio,
          pactuou_fim_prox_perfil: fim,
          pactuou_pontos_prox_perfil: pontos,
        })
        .eq('id', consultaId);
      if (error) throw error;
      imprimirAgora();
      toast.success(t('laudo.pactuacaoProxPerfil.salvoEImpresso'));
      setModoLeitura(true);
      onSalvo?.();
    } catch (err) {
      console.error('[pactuacao-prox-perfil] falha ao salvar:', err);
      toast.error(t('laudo.pactuacaoProxPerfil.erro.salvar'));
    } finally {
      setSalvando(false);
    }
  };

  // ── Modo leitura: mostra o resumo pactuado + botões (editar / reimprimir) ─
  if (modoLeitura && pactuacaoExistente) {
    return (
      <div className="rounded-xl border-2 border-[#0F766E] bg-[#F0FDFA] p-4 space-y-3 print:hidden">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0F766E]" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#0F766E]">
              {t('laudo.pactuacaoProxPerfil.tituloPactuado')}
            </p>
            <p className="text-xs text-[#134E4A]">
              {t('laudo.pactuacaoProxPerfil.resumo', {
                pontos,
                janela,
                inicio: paraDdMmYyyy(pactuacaoExistente.inicio),
                fim: paraDdMmYyyy(pactuacaoExistente.fim),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={imprimirAgora}>
            <Printer className="h-4 w-4 mr-1.5" />
            {t('laudo.pactuacaoProxPerfil.reimprimir')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setModoLeitura(false)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            {t('laudo.pactuacaoProxPerfil.editar')}
          </Button>
        </div>
      </div>
    );
  }

  // ── Modo edição: escolher janela + datas + salvar/imprimir ────────────────
  return (
    <div className="rounded-xl border-2 border-[#7C4DBA] bg-[#FAFAFE] p-4 space-y-4 print:hidden">
      <div className="space-y-1">
        <p className="text-sm font-bold text-[#5B21B6]">
          {t('laudo.pactuacaoProxPerfil.tituloForm', { pontos })}
        </p>
        <p className="text-xs text-[#5B21B6]">
          {t('laudo.pactuacaoProxPerfil.instrucao')}
        </p>
      </div>

      {/* Janela pós-prandial */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-foreground">
          {t('laudo.pactuacaoProxPerfil.janelaLabel')}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={janela === '1h' ? 'default' : 'outline'}
            className={janela === '1h' ? 'bg-[#7C4DBA] hover:bg-[#5B21B6] text-white' : ''}
            onClick={() => setJanela('1h')}
          >
            {t('laudo.pactuacaoProxPerfil.janela1h')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={janela === '2h' ? 'default' : 'outline'}
            className={janela === '2h' ? 'bg-[#7C4DBA] hover:bg-[#5B21B6] text-white' : ''}
            onClick={() => setJanela('2h')}
          >
            {t('laudo.pactuacaoProxPerfil.janela2h')}
          </Button>
        </div>
      </div>

      {/* Datas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground" htmlFor="pactuou-inicio">
            {t('laudo.pactuacaoProxPerfil.inicioLabel')}
          </label>
          <Input
            id="pactuou-inicio"
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground" htmlFor="pactuou-fim">
            {t('laudo.pactuacaoProxPerfil.fimLabel')}
          </label>
          <Input
            id="pactuou-fim"
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
          />
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        onClick={salvarEImprimir}
        disabled={!camposValidos || salvando}
        className="bg-[#0F766E] hover:bg-[#115E59] text-white"
      >
        <Printer className="h-4 w-4 mr-1.5" />
        {salvando
          ? t('laudo.pactuacaoProxPerfil.salvando')
          : t('laudo.pactuacaoProxPerfil.salvarEImprimir')}
      </Button>
    </div>
  );
}
