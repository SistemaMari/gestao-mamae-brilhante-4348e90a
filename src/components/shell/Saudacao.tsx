import type React from 'react';
import { useTranslation } from 'react-i18next';

/** Primeiro nome (mantém "Dra."/"Dr." quando vier antes do nome). */
function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '';
  const honorifico = /^(dra?|prof(a)?|sr(a)?)\.?$/i.test(partes[0]);
  return honorifico && partes[1] ? `${partes[0]} ${partes[1]}` : partes[0];
}

/**
 * Saudação de topo no padrão do admin e das profissionais ("Olá, Sandra ✨" +
 * subtítulo com bom dia/boa tarde/boa noite). `acao` fica à direita (ex.:
 * botão de exportar).
 */
export default function Saudacao({ nome, subtitulo, acao }: {
  nome: string;
  /** Texto após "Bom dia, " — ex.: "este é o panorama da Unidade Norte." */
  subtitulo: string;
  acao?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const hora = new Date().getHours();
  const periodo = hora < 12 ? t('dashboard.greetingMorning') : hora < 18 ? t('dashboard.greetingAfternoon') : t('dashboard.greetingEvening');

  return (
    <div className="flex flex-col gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-4xl font-bold tracking-tight text-[#1E293B] md:text-5xl" style={{ fontFamily: 'Sora, sans-serif' }}>
          {t('shell.saudacaoTitulo', { nome: primeiroNome(nome) })}
        </h1>
        <p className="mt-2 text-base text-[#64748B]">
          {t('shell.saudacaoSubtitulo', { periodo, texto: subtitulo })}
        </p>
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
