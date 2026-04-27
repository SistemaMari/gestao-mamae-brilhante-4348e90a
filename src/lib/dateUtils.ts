/**
 * Utilitários de data timezone-safe.
 *
 * PROBLEMA: `new Date('2025-10-01')` é interpretado como UTC meia-noite.
 * Em fusos negativos (BRT = UTC-3) isso vira 30/09 21:00 → perde 1 dia
 * ao formatar/exibir/salvar.
 *
 * SOLUÇÃO: Sempre tratar datas puras (YYYY-MM-DD) como datas locais.
 */

/**
 * Converte uma string 'YYYY-MM-DD' (vinda do Supabase ou input type="date")
 * em um objeto Date no fuso LOCAL (meia-noite local), evitando o shift UTC.
 *
 * Aceita também strings ISO completas — nesse caso retorna new Date normal.
 */
export function parseDateLocal(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;

  // Match estrito YYYY-MM-DD (com possível 'T...' ignorado nas 10 primeiras chars)
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  return new Date(value);
}

/**
 * Retorna a data de HOJE como string 'YYYY-MM-DD' no fuso LOCAL.
 * Substitui `new Date().toISOString().slice(0,10)` que pode pular 1 dia
 * à noite (depois das 21h em BRT).
 */
export function todayLocalISO(): string {
  return formatDateISO(new Date());
}

/**
 * Formata um Date como 'YYYY-MM-DD' usando componentes LOCAIS
 * (não UTC). Use sempre que for enviar datas puras ao Supabase.
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formata uma data (Date ou 'YYYY-MM-DD') como 'dd/MM/yyyy' pt-BR
 * sem qualquer conversão de timezone.
 */
export function formatDateBR(value: string | Date | null | undefined): string {
  const d = parseDateLocal(value);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${d.getFullYear()}`;
}
