import { AlertTriangle } from 'lucide-react';

/**
 * Banner de URGÊNCIA com o endocrinologista — encerramento por insulinização.
 *
 * As especialistas pediram destaque forte (vermelho) para a janela tempo-crítica
 * da associação/referência ao endocrinologista, exibido ao FINAL da Conduta
 * Orientativa do laudo, só nos desfechos de insulina (r2/r3/r4b_insulina).
 *
 * O texto é FIXO no código (clinicamente estável), no mesmo espírito do bloco de
 * reteste puerperal. Por isso saiu do texto editável da conduta em `laudo_textos`
 * (evita duplicar) — a linha de reteste segue no texto, por decisão clínica.
 */
export default function BannerUrgenciaEndocrino() {
  return (
    <section
      className="laudo-bloco rounded-xl border-2 border-l-4 p-4"
      style={{ backgroundColor: '#FEE2E2', borderColor: '#DC2626', borderLeftColor: '#B91C1C' }}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#B91C1C' }} />
        <div className="space-y-1.5 text-sm leading-relaxed" style={{ color: '#7F1D1D' }}>
          <p className="font-bold" style={{ color: '#991B1B' }}>ATENÇÃO — urgência com o endocrinologista</p>
          <p>
            Caso opte por associar ou referenciar o endocrinologista, a consulta deve
            ocorrer em <strong>7 a 10 dias</strong> a partir da data de hoje.
          </p>
          <p>
            Se não houver agenda do profissional nesse prazo, oriente a paciente a procurar
            outro endocrinologista com urgência. <strong>Um feto em regime hiperglicêmico não
            pode esperar.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}
