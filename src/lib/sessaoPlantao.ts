/**
 * "Sessão de plantão" do profissional INSTITUCIONAL.
 *
 * Consultório, gestores e admin ficam logados como no Gmail (a sessão do
 * Supabase fica no localStorage e o refresh token renova sozinho). Já o
 * institucional costuma dividir o computador da unidade com outros médicos a
 * cada plantão: a sessão dele vale enquanto o navegador estiver aberto.
 *
 * Como funciona (sem mexer no client gerado do Supabase):
 *  - marca de aba em sessionStorage → sobrevive a atualizar a página (F5) e
 *    some quando a aba/navegador fecha;
 *  - "batimento" em localStorage, renovado a cada 30 s por qualquer aba aberta
 *    → uma aba NOVA aberta enquanto outra está ativa continua logada.
 * Ao abrir o app sem marca de aba e sem batimento recente, a sessão do
 * institucional é encerrada e ele volta para o login.
 */

const MARCA_ABA = 'mari-sessao-plantao-aba';
const BATIMENTO = 'mari-sessao-plantao-batimento';
export const INTERVALO_BATIMENTO_MS = 30_000;
/** Sem nenhuma aba aberta há mais que isso → plantão encerrado. */
export const TOLERANCIA_MS = 2 * 60_000;

function ler(storage: () => Storage, chave: string): string | null {
  try {
    return storage().getItem(chave);
  } catch {
    return null;
  }
}

function gravar(storage: () => Storage, chave: string, valor: string | null) {
  try {
    if (valor == null) storage().removeItem(chave);
    else storage().setItem(chave, valor);
  } catch {
    /* storage bloqueado (modo privado etc.) — ignora */
  }
}

const local = () => window.localStorage;
const sessao = () => window.sessionStorage;

/** Renova o batimento e marca esta aba como parte do plantão atual. */
export function marcarSessaoPlantao(agora: number = Date.now()) {
  gravar(sessao, MARCA_ABA, '1');
  gravar(local, BATIMENTO, String(agora));
}

/** Limpa as marcas (logout ou troca para um perfil que não é institucional). */
export function limparSessaoPlantao() {
  gravar(sessao, MARCA_ABA, null);
  gravar(local, BATIMENTO, null);
}

/**
 * true quando o navegador foi fechado desde o último uso: esta aba não tem a
 * marca do plantão e nenhuma outra aba deu sinal de vida recentemente.
 */
export function sessaoPlantaoExpirada(agora: number = Date.now()): boolean {
  if (ler(sessao, MARCA_ABA)) return false;
  const ultimo = Number(ler(local, BATIMENTO));
  if (!Number.isFinite(ultimo) || ultimo <= 0) return true;
  return agora - ultimo > TOLERANCIA_MS;
}
