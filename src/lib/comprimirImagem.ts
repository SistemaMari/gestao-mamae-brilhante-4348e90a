/**
 * V4 — Compressão da foto no próprio aparelho, antes de subir.
 *
 * Foto de celular hoje sai com 3 a 5 MB. Numa UBS com internet ruim isso é
 * espera longa (às vezes falha), e no armazenamento vira custo acumulado — cada
 * foto guardada é paga todos os meses, para sempre. Reduzida para ~300 KB a
 * caligrafia continua perfeitamente legível.
 *
 * Roda no navegador, sem biblioteca: redimensiona num canvas e vai baixando a
 * qualidade do JPEG até caber no alvo.
 */

const LADO_MAXIMO = 1600;   // px — suficiente para ler número escrito à mão
const ALVO_BYTES = 320_000; // ~310 KB
const QUALIDADE_MINIMA = 0.5;

export interface ImagemComprimida {
  blob: Blob;
  /** URL local para exibir na tela. Lembrar de revogar ao descartar. */
  previewUrl: string;
  largura: number;
  altura: number;
  bytesOriginais: number;
}

export async function comprimirImagem(arquivo: File): Promise<ImagemComprimida> {
  const bitmap = await carregarBitmap(arquivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem neste aparelho.');
  // Fundo branco: PNG com transparência viraria preto ao virar JPEG.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  if ('close' in bitmap) (bitmap as ImageBitmap).close?.();

  let qualidade = 0.85;
  let blob = await paraBlob(canvas, qualidade);
  while (blob.size > ALVO_BYTES && qualidade > QUALIDADE_MINIMA) {
    qualidade -= 0.1;
    blob = await paraBlob(canvas, qualidade);
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    largura,
    altura,
    bytesOriginais: arquivo.size,
  };
}

async function carregarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Respeita a orientação do EXIF — sem isso, foto de celular vira de lado.
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* navegador antigo: cai no <img> abaixo */
    }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(arquivo);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível abrir esta imagem.')); };
    img.src = url;
  });
}

function paraBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao preparar a imagem.'))),
      'image/jpeg',
      qualidade,
    );
  });
}
