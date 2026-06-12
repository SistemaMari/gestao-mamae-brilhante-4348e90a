import { AlertTriangle, Info } from 'lucide-react';

/**
 * 38F — Banner clínico persistente.
 *
 * Renderizado na zona entre o cabeçalho e o histórico da ficha (mesma zona da
 * tarja da janela do GTT). LÊ de dado já persistido na consulta (ex.:
 * `cenario_clinico`, `proxima_ficha_recomendada`) — sem estado local e sem
 * depender do pop-up. Por isso sobrevive ao "Fechar" e reaparece toda vez que a
 * ficha é aberta, inclusive por outro profissional da unidade.
 *
 * Genérico: a condição clínica e o texto vêm de fora; aqui mora só a apresentação.
 */
type TomBannerClinico = 'alerta' | 'info';

interface BannerClinicoPersistenteProps {
  /** 'alerta' = âmbar (situação que exige ação); 'info' = lilás (contexto a manter à vista). */
  tom: TomBannerClinico;
  texto: string;
}

const ESTILO: Record<
  TomBannerClinico,
  { border: string; bg: string; icone: string; texto: string; Icone: typeof AlertTriangle }
> = {
  alerta: { border: '#F59E0B', bg: '#FEF3C7', icone: '#F59E0B', texto: '#92400E', Icone: AlertTriangle },
  info: { border: '#9b87f5', bg: '#E8E0FF', icone: '#7E69AB', texto: '#5B21B6', Icone: Info },
};

export default function BannerClinicoPersistente({ tom, texto }: BannerClinicoPersistenteProps) {
  const s = ESTILO[tom];
  const Icone = s.Icone;
  return (
    <div
      className="rounded-xl border-2 p-4 flex items-start gap-3"
      style={{ borderColor: s.border, backgroundColor: s.bg }}
      role="status"
    >
      <Icone className="mt-0.5 h-5 w-5 shrink-0" style={{ color: s.icone }} aria-hidden="true" />
      <p className="text-sm font-medium" style={{ color: s.texto }}>
        {texto}
      </p>
    </div>
  );
}
