/**
 * Utilitários para formatar, mascarar e validar WhatsApp brasileiro (DDI 55 fixo).
 *
 * Formato canônico salvo no banco: apenas dígitos, com DDI 55 prefixado.
 * Ex.: "5511912345678" (celular 11 dígitos) ou "5511234567" (fixo 10 dígitos).
 *
 * UI: usuário digita só DDD+número, vê máscara "(11) 91234-5678" e prefixo +55 ao lado.
 */

/** Mantém apenas dígitos. */
export function apenasDigitos(valor: string): string {
  return (valor ?? '').replace(/\D+/g, '');
}

/** Aplica máscara visual brasileira: (DD) XXXXX-XXXX (11 dígitos) ou (DD) XXXX-XXXX (10 dígitos). */
export function mascararWhatsappBR(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/**
 * Valida um WhatsApp brasileiro. Como WhatsApp é sempre celular, exige DDD (2
 * dígitos) + celular de 9 dígitos = exatamente 11 dígitos (antes aceitava 10,
 * de fixo — o que deixava passar um celular sem o 9 e sem um dígito).
 *
 * `obrigatorio: true` recusa também o campo vazio (usado no cadastro da
 * gestante, onde o número é necessário para a integração futura com WhatsApp).
 * Sem essa opção, vazio é aceito (ex.: edição de gestante antiga sem número).
 *
 * Devolve um `codigo` (não a frase pronta) para a tela traduzir nos 3 idiomas.
 */
export function validarWhatsappBR(
  valor: string,
  opts?: { obrigatorio?: boolean },
): { ok: boolean; codigo?: 'obrigatorio' | 'incompleto' } {
  const d = apenasDigitos(valor);
  if (d.length === 0) {
    return opts?.obrigatorio ? { ok: false, codigo: 'obrigatorio' } : { ok: true };
  }
  if (d.length !== 11) {
    return { ok: false, codigo: 'incompleto' };
  }
  return { ok: true };
}

/**
 * Converte input do usuário (com ou sem máscara, com ou sem DDI) para o formato canônico
 * salvo no banco. Retorna null se o campo está vazio.
 */
export function paraFormatoCanonico(valor: string): string | null {
  const d = apenasDigitos(valor);
  if (d.length === 0) return null;
  // Se já vier com DDI 55 prefixado (12 ou 13 dígitos), mantém.
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  // Caso normal: usuário digitou só DDD+número.
  return `55${d}`;
}

/**
 * Converte do formato canônico do banco para o que o input mostra (DDD+número mascarado).
 * Ex.: "5511912345678" → "(11) 91234-5678".
 */
export function deCanonicoParaInput(canonico: string | null | undefined): string {
  if (!canonico) return '';
  const d = apenasDigitos(canonico);
  // Remove DDI 55 se presente.
  const semDdi = (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
  return mascararWhatsappBR(semDdi);
}

/** Formata para exibição na ficha: "+55 (11) 91234-5678". Retorna '—' se vazio. */
export function formatarWhatsappExibicao(canonico: string | null | undefined): string {
  if (!canonico) return '—';
  const d = apenasDigitos(canonico);
  const semDdi = (d.length === 12 || d.length === 13) && d.startsWith('55') ? d.slice(2) : d;
  const mascarado = mascararWhatsappBR(semDdi);
  return mascarado ? `+55 ${mascarado}` : '—';
}
