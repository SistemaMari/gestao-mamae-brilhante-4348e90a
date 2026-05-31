import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * useDraftStorage — backup automático de rascunho da ficha em localStorage.
 *
 * Contrato (Prompt 34B seção 3.3):
 *   const { draft, saveDraft, clearDraft, draftTimestamp, status } = useDraftStorage({
 *     key,
 *     debounceMs: 2000,
 *     current: stateLocalDoForm,
 *     enabled: true,
 *   });
 *
 * Comportamento:
 *   - Observa `current` (state do form em memória). Quando muda, espera `debounceMs`
 *     antes de gravar em localStorage. Não dispara chamada de rede.
 *   - Chave canônica: `mari:draft:<key>` (callers passam apenas a parte específica:
 *     `ficha:<consultaId>` ou `nova:<pacienteId>:<tipoConsulta>`).
 *   - Valor: JSON `{ data, savedAt }` (savedAt = ISO 8601).
 *   - Expiração: rascunhos com `savedAt` mais antigos que 30 dias são apagados ao montar.
 *   - `saveDraft()` força gravação imediata (cancela debounce pendente).
 *   - `clearDraft()` remove a chave (usado após salvar no servidor com sucesso).
 *   - `draft` é o que está atualmente persistido no localStorage (lido no mount).
 *   - `draftTimestamp` é a data de `savedAt` desse draft, ou null se não há.
 *
 * Importante:
 *   - O hook NÃO hidrata o state do form automaticamente. Quem decide se aplica `draft`
 *     ao form é o caller — via reconciliação (seção 3.3.3), que pode envolver modal
 *     de recuperação (seção 3.5).
 *   - SSR-safe: detecta ausência de window/localStorage.
 */

export const DRAFT_KEY_PREFIX = 'mari:draft:';
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export type DraftStatus = 'idle' | 'dirty' | 'persisted' | 'error';

export interface StoredDraft<T> {
  data: T;
  savedAt: string; // ISO 8601
}

interface Options<T> {
  /** Sub-chave (sem prefixo). Ex.: `ficha:abc-123` ou `nova:pac-xyz:retorno_1`. */
  key: string;
  /** State atual do form em memória. */
  current: T;
  /** Debounce em ms (default 2000 — seção 3.3.2). */
  debounceMs?: number;
  /** Quando false, hook fica silencioso (não lê, não grava). Útil em preview/SSR. */
  enabled?: boolean;
  /**
   * Função opcional para comparar `current` ao último valor persistido — evita gravações
   * espúrias. Default: comparação por JSON.stringify.
   */
  isEqual?: (a: T, b: T) => boolean;
}

interface UseDraftStorageResult<T> {
  /** Último rascunho lido no mount (não é atualizado a cada save). null se não havia. */
  draft: T | null;
  /** Data ISO 8601 do `savedAt` do draft inicial. null se não havia. */
  draftTimestamp: string | null;
  /** Força gravação imediata (cancela debounce). Retorna a savedAt usada. */
  saveDraft: () => string;
  /** Remove a chave do localStorage. */
  clearDraft: () => void;
  /** Estado interno: idle (nada a salvar), dirty (debounce pendente), persisted, error. */
  status: DraftStatus;
  /** Timestamp ISO 8601 da última gravação local (atualiza a cada save). null antes do 1º. */
  lastSavedAt: string | null;
}

function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__mari_draft_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function fullKey(key: string): string {
  return `${DRAFT_KEY_PREFIX}${key}`;
}

function defaultIsEqual<T>(a: T, b: T): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Lê um rascunho do localStorage. Retorna null se ausente, corrompido ou expirado.
 * Expirados são removidos como efeito colateral (limpeza preguiçosa, seção 3.3.1).
 */
export function readDraft<T>(key: string): StoredDraft<T> | null {
  if (!isStorageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(fullKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || typeof parsed.savedAt !== 'string') return null;
    const savedAtMs = new Date(parsed.savedAt).getTime();
    if (!Number.isFinite(savedAtMs)) return null;
    if (Date.now() - savedAtMs > DRAFT_TTL_MS) {
      // Expirado: limpa preguiçosamente.
      window.localStorage.removeItem(fullKey(key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string, data: T): string {
  const savedAt = new Date().toISOString();
  if (!isStorageAvailable()) return savedAt;
  try {
    const payload: StoredDraft<T> = { data, savedAt };
    window.localStorage.setItem(fullKey(key), JSON.stringify(payload));
  } catch {
    /* sem espaço, modo privado, etc — ignora */
  }
  return savedAt;
}

export function removeDraft(key: string): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.removeItem(fullKey(key));
  } catch {
    /* ignora */
  }
}

/**
 * Limpa todos os rascunhos do storage que ultrapassaram a TTL.
 * Chamado uma vez no mount do primeiro hook ativo.
 */
let varreduraJaFeita = false;
export function limparRascunhosExpirados(): number {
  if (!isStorageAvailable()) return 0;
  if (varreduraJaFeita) return 0;
  varreduraJaFeita = true;
  let removidos = 0;
  try {
    const agora = Date.now();
    const chaves: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(DRAFT_KEY_PREFIX)) chaves.push(k);
    }
    for (const k of chaves) {
      try {
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as StoredDraft<unknown>;
        const savedAtMs = parsed?.savedAt ? new Date(parsed.savedAt).getTime() : NaN;
        if (!Number.isFinite(savedAtMs) || agora - savedAtMs > DRAFT_TTL_MS) {
          window.localStorage.removeItem(k);
          removidos++;
        }
      } catch {
        // entrada corrompida — remove
        window.localStorage.removeItem(k);
        removidos++;
      }
    }
  } catch {
    /* ignora */
  }
  return removidos;
}

/** Exposto para testes resetarem o singleton de varredura. */
export function _resetVarreduraParaTeste(): void {
  varreduraJaFeita = false;
}

export function useDraftStorage<T>({
  key,
  current,
  debounceMs = 2000,
  enabled = true,
  isEqual = defaultIsEqual,
}: Options<T>): UseDraftStorageResult<T> {
  // Lê o rascunho existente uma única vez no mount.
  const initialDraftRef = useRef<StoredDraft<T> | null>(null);
  if (initialDraftRef.current === null && enabled) {
    initialDraftRef.current = readDraft<T>(key);
  }

  const [status, setStatus] = useState<DraftStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialDraftRef.current?.savedAt ?? null,
  );

  // Último valor persistido (referência interna para comparar com `current`).
  // No primeiro render, inicializa com o `current` quando NÃO há draft prévio —
  // assim o status só vira 'dirty' a partir de uma mudança real (não no mount).
  // Quando há draft prévio, mantém esse valor como baseline (o caller pode optar
  // por hidratar via modal de recuperação).
  const lastPersistedRef = useRef<T | null>(
    initialDraftRef.current?.data ?? current,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRef = useRef<T>(current);
  currentRef.current = current;

  // Varredura preguiçosa de rascunhos expirados (executa uma vez por sessão).
  useEffect(() => {
    if (!enabled) return;
    limparRascunhosExpirados();
  }, [enabled]);

  const persistir = useCallback(
    (value: T) => {
      try {
        const savedAt = writeDraft(key, value);
        lastPersistedRef.current = value;
        setLastSavedAt(savedAt);
        setStatus('persisted');
        return savedAt;
      } catch {
        setStatus('error');
        return new Date().toISOString();
      }
    },
    [key],
  );

  const saveDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return persistir(currentRef.current);
  }, [persistir]);

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    removeDraft(key);
    lastPersistedRef.current = null;
    setLastSavedAt(null);
    setStatus('idle');
  }, [key]);

  // Debounce do auto-save quando `current` muda.
  useEffect(() => {
    if (!enabled) return;
    const persisted = lastPersistedRef.current;
    if (persisted !== null && isEqual(current, persisted)) {
      // Nada mudou (ou voltou ao estado salvo).
      return;
    }
    setStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persistir(current);
      timerRef.current = null;
    }, debounceMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, enabled, debounceMs, persistir]);

  return useMemo<UseDraftStorageResult<T>>(
    () => ({
      draft: initialDraftRef.current?.data ?? null,
      draftTimestamp: initialDraftRef.current?.savedAt ?? null,
      saveDraft,
      clearDraft,
      status,
      lastSavedAt,
    }),
    [saveDraft, clearDraft, status, lastSavedAt],
  );
}

/**
 * Decisão de reconciliação entre rascunho local e dados do servidor (seção 3.3.3).
 *
 * Regras:
 *   - sem rascunho → 'use_server'
 *   - com rascunho e igual ao servidor → 'discard_silently' (limpar localStorage)
 *   - com rascunho e diferente do servidor → 'show_recovery_modal'
 */
export type DraftReconciliation =
  | { decision: 'use_server' }
  | { decision: 'discard_silently'; reason: 'equal_to_server' }
  | { decision: 'show_recovery_modal'; draft: unknown; draftTimestamp: string };

export function reconciliarRascunho<T>(
  serverData: T | null,
  localDraft: StoredDraft<T> | null,
  isEqual: (a: T, b: T) => boolean = defaultIsEqual,
): DraftReconciliation {
  if (!localDraft) return { decision: 'use_server' };
  if (serverData != null && isEqual(localDraft.data, serverData)) {
    return { decision: 'discard_silently', reason: 'equal_to_server' };
  }
  return {
    decision: 'show_recovery_modal',
    draft: localDraft.data,
    draftTimestamp: localDraft.savedAt,
  };
}
