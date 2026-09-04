/**
 * V4 — Captura de foto pela webcam do computador.
 *
 * Em notebook, o input file com capture="environment" não abre câmera nenhuma
 * (é limitação universal de navegador desktop, não bug do MARI) — esse
 * atributo só ativa em celular. Este modal é o caminho real para "tirar a
 * foto" quando o profissional está num computador com webcam: pede
 * getUserMedia, mostra o vídeo ao vivo e deixa capturar uma imagem parada
 * para conferir o enquadramento ANTES de usar — sem essa conferência, uma
 * foto tremida ou cortada só apareceria depois, já na etapa de leitura.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Camera, Loader2, RotateCcw, Check } from 'lucide-react';

type Estado = 'abrindo' | 'ao_vivo' | 'capturada' | 'erro';
type CodigoErro = 'permissao' | 'sem_camera' | 'generico';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onCapturar: (arquivo: File) => void;
  t: (key: string) => string;
}

export default function WebcamCaptureModal({
  aberto, onFechar, onCapturar, t,
}: Props) {
  const [estado, setEstado] = useState<Estado>('abrindo');
  const [erro, setErro] = useState<CodigoErro>('generico');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const pararStream = () => {
    streamRef.current?.getTracks().forEach((trilha) => trilha.stop());
    streamRef.current = null;
  };

  // Liga a câmera assim que o modal abre; desliga ao fechar. Nunca deixamos a
  // luz da webcam acesa com o modal fechado — é o tipo de coisa que assusta
  // quem está usando o sistema numa sala com a gestante.
  useEffect(() => {
    if (!aberto) return undefined;
    setEstado('abrindo');
    setFotoUrl(null);
    setFotoBlob(null);

    let cancelado = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1600 } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((trilha) => trilha.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setEstado('ao_vivo');
      } catch (e) {
        if (cancelado) return;
        const nome = e instanceof DOMException ? e.name : '';
        setErro(
          nome === 'NotAllowedError' || nome === 'SecurityError' ? 'permissao'
          : nome === 'NotFoundError' || nome === 'OverconstrainedError' ? 'sem_camera'
          : 'generico',
        );
        setEstado('erro');
      }
    })();

    return () => {
      cancelado = true;
      pararStream();
    };
  }, [aberto]);

  const capturar = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setFotoBlob(blob);
      setFotoUrl(URL.createObjectURL(blob));
      setEstado('capturada');
    }, 'image/jpeg', 0.92);
  };

  const tirarOutra = () => {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFotoUrl(null);
    setFotoBlob(null);
    setEstado('ao_vivo');
  };

  const fechar = () => {
    pararStream();
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFotoUrl(null);
    setFotoBlob(null);
    onFechar();
  };

  const usarFoto = () => {
    if (!fotoBlob) return;
    const arquivo = new File([fotoBlob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
    // Não chama fechar() aqui: fechar() revoga a fotoUrl, e o pai começa a
    // processar o arquivo (não a URL) — mas ainda precisamos desligar a
    // câmera e devolver o controle do modal.
    pararStream();
    setFotoUrl((atual) => { if (atual) URL.revokeObjectURL(atual); return null; });
    setFotoBlob(null);
    onCapturar(arquivo);
    onFechar();
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && fechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" />
            {t('fichaAC.perfilFoto.webcam.titulo')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {estado === 'abrindo' && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg bg-muted py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('fichaAC.perfilFoto.webcam.abrindo')}</p>
            </div>
          )}

          {estado === 'erro' && (
            <div className="flex items-start gap-2 rounded-lg border p-3"
                 style={{ backgroundColor: '#FEE2E2', borderColor: '#DC2626' }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#991B1B' }} />
              <p className="text-sm" style={{ color: '#991B1B' }}>
                {t(`fichaAC.perfilFoto.webcam.erro.${erro}`)}
              </p>
            </div>
          )}

          {/* O <video> fica montado durante toda a vida do modal — o srcObject é
              setado direto no elemento via ref, então escondê-lo com display:none
              (em vez de tirar do DOM) evita perder essa referência. */}
          <div className={estado === 'ao_vivo' ? 'block' : 'hidden'}>
            <video ref={videoRef} muted playsInline
                   className="w-full max-h-[60vh] rounded-lg bg-black object-contain" />
          </div>

          {estado === 'capturada' && fotoUrl && (
            <img src={fotoUrl} alt={t('fichaAC.perfilFoto.fotoDaPaciente')}
                 className="w-full max-h-[60vh] rounded-lg bg-black object-contain" />
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={fechar}>
              {t('fichaAC.perfilFoto.webcam.cancelar')}
            </Button>
            {estado === 'ao_vivo' && (
              <Button type="button" onClick={capturar}
                      className="bg-[#7C4DBA] hover:bg-[#5B21B6] text-white">
                <Camera className="h-4 w-4 mr-1.5" />
                {t('fichaAC.perfilFoto.webcam.capturar')}
              </Button>
            )}
            {estado === 'capturada' && (
              <>
                <Button type="button" variant="outline" onClick={tirarOutra}>
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  {t('fichaAC.perfilFoto.webcam.tirarOutra')}
                </Button>
                <Button type="button" onClick={usarFoto}
                        className="bg-[#0F766E] hover:bg-[#115E59] text-white">
                  <Check className="h-4 w-4 mr-1.5" />
                  {t('fichaAC.perfilFoto.webcam.usarFoto')}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
