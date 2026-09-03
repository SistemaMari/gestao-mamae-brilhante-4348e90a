/**
 * V4 — Preenchimento do perfil glicêmico a partir de uma FOTO do controle da
 * gestante. Atalho para a digitação, nunca substituto dela.
 *
 * Fluxo: o profissional tira a foto (ou envia do celular) → a imagem é
 * comprimida no aparelho e guardada → o serviço lê os números → a grade se
 * preenche, com as células vindas da foto marcadas e as não lidas em âmbar →
 * o profissional CONFERE com a foto ao lado e confirma.
 *
 * A conferência não é opcional e não é um alerta que se fecha: é uma faixa fixa
 * que só sai quando o profissional confirma. Um aviso que aparece sempre com o
 * mesmo texto e some com um clique vira clique automático em duas semanas — e a
 * segurança desta funcionalidade inteira depende de a conferência acontecer.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Camera, ImageIcon, Loader2, AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { comprimirImagem } from '@/lib/comprimirImagem';
import {
  extrairPerfilFoto, ErroExtracao, USAR_SIMULACAO, SALVAR_FOTO_NO_SERVIDOR,
} from '@/lib/extrairPerfilFoto';
import type { ResultadoExtracao, RelatorioAplicacao } from '@/lib/perfilPorFoto';

const BUCKET = 'controles-glicemia';

interface Props {
  pacienteId: string;
  consultaId: string | null;
  isPreview: boolean;
  tipoPerfil: '4_pontos' | '6_pontos';
  janelaPos: '1h' | '2h';
  dataInicio: string;
  dias: number;
  datasDias: readonly string[];
  /** Bloqueia a captura enquanto faltam datas — sem elas não há onde encaixar. */
  habilitado: boolean;
  /** A grade recebe os números; quem aplica é a ficha. */
  onLeitura: (resultado: ResultadoExtracao) => RelatorioAplicacao;
  /** Profissional confirmou a conferência. */
  onConfirmar: () => void;
  /** Profissional descartou a leitura — a ficha limpa o que veio da foto. */
  onDescartar: () => void;
}

type Etapa = 'inicial' | 'lendo' | 'conferindo' | 'confirmado';

/**
 * Passo dentro da etapa 'lendo'. Existe para o usuário ver em qual das duas
 * fases estamos (a compressão da foto pode ser LENTA em celular antigo/foto
 * grande — antes o botão só dizia "Lendo o controle...", o que dava a impressão
 * de travado quando na verdade o aparelho ainda estava tratando a imagem).
 */
type PassoLeitura = 'preparando' | 'lendo';

export default function PerfilPorFotoCard({
  pacienteId, consultaId, isPreview, tipoPerfil, janelaPos, dataInicio, dias,
  datasDias, habilitado, onLeitura, onConfirmar, onDescartar,
}: Props) {
  const { t } = useTranslation();
  const [etapa, setEtapa] = useState<Etapa>('inicial');
  const [passo, setPasso] = useState<PassoLeitura>('preparando');
  const [segundos, setSegundos] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioAplicacao | null>(null);
  const [ampliada, setAmpliada] = useState(false);

  const inputCamera = useRef<HTMLInputElement>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  // Contador de segundos enquanto está lendo. Prova ao usuário que a coisa não
  // travou (a leitura real pode levar dezenas de segundos, e um botão parado no
  // mesmo texto por muito tempo é indistinguível de um bug).
  useEffect(() => {
    if (etapa !== 'lendo') { setSegundos(0); return; }
    const id = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [etapa]);

  const escolherArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ''; // permite escolher a mesma foto de novo
    if (!arquivo) return;

    setEtapa('lendo');
    setPasso('preparando');
    let urlLocal: string | null = null;

    try {
      const imagem = await comprimirImagem(arquivo);
      urlLocal = imagem.previewUrl;
      setPreviewUrl(imagem.previewUrl);

      // Vitrine e modo simulado não sobem nada: paciente fictícia não tem
      // prontuário, e leitura inventada não é registro clínico.
      let caminho: string | null = null;
      if (!isPreview && SALVAR_FOTO_NO_SERVIDOR) {
        caminho = `${pacienteId}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(caminho, imagem.blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw new ErroExtracao('falha_upload', error.message);

        await supabase.from('fotos_perfil' as any).insert({
          paciente_id: pacienteId,
          consulta_id: consultaId,
          storage_path: caminho,
          status: 'extraida',
        });
        setStoragePath(caminho);
      }

      setPasso('lendo');
      const resultado = await extrairPerfilFoto({
        pacienteId, consultaId, storagePath: caminho ?? 'preview',
        tipoPerfil, janelaPos, dataInicio, dias, datasDias,
      });

      const rel = onLeitura(resultado);
      setRelatorio(rel);
      setEtapa('conferindo');
    } catch (err) {
      if (urlLocal) URL.revokeObjectURL(urlLocal);
      setPreviewUrl(null);
      setEtapa('inicial');
      const codigo = err instanceof ErroExtracao ? err.codigo : 'desconhecido';
      toast.error(t(`fichaAC.perfilFoto.erro.${codigo}`, {
        defaultValue: t('fichaAC.perfilFoto.erro.desconhecido'),
      }));
    }
  };

  const confirmar = async () => {
    if (storagePath && !isPreview) {
      await supabase.from('fotos_perfil' as any)
        .update({ status: 'confirmada', consulta_id: consultaId })
        .eq('storage_path', storagePath);
    }
    setEtapa('confirmado');
    onConfirmar();
    toast.success(t('fichaAC.perfilFoto.confirmado'));
  };

  const descartar = async () => {
    if (storagePath && !isPreview) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      await supabase.from('fotos_perfil' as any)
        .update({ status: 'descartada' }).eq('storage_path', storagePath);
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setStoragePath(null);
    setRelatorio(null);
    setEtapa('inicial');
    onDescartar();
  };

  // ── Botão de captura ──────────────────────────────────────────────────────
  if (etapa === 'inicial' || etapa === 'lendo') {
    const lendo = etapa === 'lendo';
    return (
      <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-4 space-y-2">
        {/* Bloqueado por falta da data: o motivo vem ANTES dos botões e em
            destaque. Antes ficava em cinza claro embaixo, e o botão desabilitado
            continuava roxo — quem chegava aqui clicava sem entender por que nada
            acontecia. O aviso é a informação principal enquanto o bloqueio dura. */}
        {!habilitado && (
          <div className="flex items-start gap-2 rounded-lg border p-2.5"
               style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#92400E' }} />
            <p className="text-xs" style={{ color: '#92400E' }}>{t('fichaAC.perfilFoto.faltaData')}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button" size="sm" disabled={!habilitado || lendo}
            onClick={() => inputCamera.current?.click()}
            className={habilitado
              ? 'bg-[#7C4DBA] hover:bg-[#5B21B6] text-white'
              : 'bg-muted text-muted-foreground hover:bg-muted'}
          >
            {lendo
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Camera className="h-4 w-4 mr-1.5" />}
            {lendo
              ? t('fichaAC.perfilFoto.lendoContador', {
                  passo: t(`fichaAC.perfilFoto.passo.${passo}`),
                  segundos,
                })
              : t('fichaAC.perfilFoto.tirarFoto')}
          </Button>
          <Button
            type="button" size="sm" variant="outline" disabled={!habilitado || lendo}
            onClick={() => inputArquivo.current?.click()}
          >
            <ImageIcon className="h-4 w-4 mr-1.5" />
            {t('fichaAC.perfilFoto.enviarArquivo')}
          </Button>
        </div>

        {/* Enquanto lê: expectativa de tempo, para o silêncio da IA não ser lido
            como travamento. No modo simulado o tempo é fixo em ~2s; ao ligar a
            leitura real, sobe para dezenas de segundos — a mensagem já reflete
            os dois cenários pra não precisar de código quando virar a chave. */}
        {lendo && (
          <p className="text-xs text-[#5B21B6]">
            {USAR_SIMULACAO
              ? t('fichaAC.perfilFoto.tempoSimulado')
              : t('fichaAC.perfilFoto.tempoEsperado')}
          </p>
        )}

        {!lendo && habilitado && (
          <p className="text-xs text-muted-foreground">{t('fichaAC.perfilFoto.ajuda')}</p>
        )}
        {USAR_SIMULACAO && (
          <p className="text-[11px] italic text-[#92400E]">{t('fichaAC.perfilFoto.simulacao')}</p>
        )}

        <input ref={inputCamera} type="file" accept="image/*" capture="environment"
               className="hidden" onChange={escolherArquivo} />
        <input ref={inputArquivo} type="file" accept="image/*"
               className="hidden" onChange={escolherArquivo} />
      </div>
    );
  }

  // ── Conferência: faixa fixa + foto ao lado da grade ───────────────────────
  if (etapa === 'conferindo') {
    return (
      <div className="space-y-3">
        {/* Enquanto a leitura é simulada, o botão aparece em ficha real — decisão
            de produto para permitir experimentar o fluxo. O que impede um número
            inventado de virar prontuário é ESTE aviso, aqui, ao lado dos próprios
            valores. No card do botão ele passaria batido: quem chega até aqui já
            está olhando a grade preenchida. */}
        {USAR_SIMULACAO && (
          <div className="rounded-xl border-2 p-4 flex items-start gap-2"
               style={{ backgroundColor: '#FEE2E2', borderColor: '#DC2626' }}>
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#991B1B' }} />
            <div className="space-y-1">
              <p className="text-sm font-bold" style={{ color: '#991B1B' }}>
                {t('fichaAC.perfilFoto.simulacaoTitulo')}
              </p>
              <p className="text-xs" style={{ color: '#991B1B' }}>
                {t('fichaAC.perfilFoto.simulacaoTexto')}
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border-2 p-4 space-y-2"
             style={{ backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: '#92400E' }} />
            <div className="space-y-1">
              <p className="text-sm font-bold" style={{ color: '#92400E' }}>
                {t('fichaAC.perfilFoto.confiraTitulo')}
              </p>
              <p className="text-xs" style={{ color: '#92400E' }}>
                {t('fichaAC.perfilFoto.confiraTexto')}
              </p>
            </div>
          </div>

          {relatorio && (
            <ul className="list-disc pl-9 space-y-0.5">
              {relatorio.incertas.length > 0 && (
                <li className="text-xs" style={{ color: '#92400E' }}>
                  {t('fichaAC.perfilFoto.avisoIncertas', { n: relatorio.incertas.length })}
                </li>
              )}
              {relatorio.preservadas > 0 && (
                <li className="text-xs" style={{ color: '#92400E' }}>
                  {t('fichaAC.perfilFoto.avisoPreservadas', { n: relatorio.preservadas })}
                </li>
              )}
              {relatorio.foraDoPeriodo > 0 && (
                <li className="text-xs" style={{ color: '#92400E' }}>
                  {t('fichaAC.perfilFoto.avisoForaPeriodo', { n: relatorio.foraDoPeriodo })}
                </li>
              )}
              {relatorio.observacoes.map((o, i) => (
                <li key={i} className="text-xs" style={{ color: '#92400E' }}>{o}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pl-9 pt-1">
            <Button type="button" size="sm" onClick={confirmar}
                    className="bg-[#0F766E] hover:bg-[#115E59] text-white">
              <Check className="h-4 w-4 mr-1.5" />
              {t('fichaAC.perfilFoto.tudoCorreto')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={descartar}>
              <X className="h-4 w-4 mr-1.5" />
              {t('fichaAC.perfilFoto.descartar')}
            </Button>
          </div>
        </div>

        {previewUrl && (
          <div className="rounded-xl border border-[#D6BCFA] bg-[#FAFAFE] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#5B21B6]">
              {t('fichaAC.perfilFoto.fotoDaPaciente')}
            </p>
            <button type="button" onClick={() => setAmpliada(true)}
                    className="block w-full focus:outline-none focus:ring-2 focus:ring-[#7C4DBA] rounded-lg">
              <img src={previewUrl} alt={t('fichaAC.perfilFoto.fotoDaPaciente')}
                   className="w-full max-h-[26rem] object-contain rounded-lg bg-white" />
            </button>
            <p className="text-[11px] text-muted-foreground">{t('fichaAC.perfilFoto.toqueAmpliar')}</p>
          </div>
        )}

        <ModalFoto url={previewUrl} aberto={ampliada} fechar={() => setAmpliada(false)} t={t} />
      </div>
    );
  }

  // ── Depois de confirmado: só o botão de rever a foto ──────────────────────
  return (
    <>
      <Button type="button" size="sm" variant="outline"
              onClick={() => setAmpliada(true)} disabled={!previewUrl}>
        <ImageIcon className="h-4 w-4 mr-1.5" />
        {t('fichaAC.perfilFoto.verOriginal')}
      </Button>
      <ModalFoto url={previewUrl} aberto={ampliada} fechar={() => setAmpliada(false)} t={t} />
    </>
  );
}

function ModalFoto({ url, aberto, fechar, t }: {
  url: string | null; aberto: boolean; fechar: () => void; t: (k: string) => string;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">{t('fichaAC.perfilFoto.fotoDaPaciente')}</DialogTitle>
        </DialogHeader>
        {url && (
          <img src={url} alt={t('fichaAC.perfilFoto.fotoDaPaciente')}
               className="w-full max-h-[75vh] object-contain bg-white rounded-lg" />
        )}
      </DialogContent>
    </Dialog>
  );
}
