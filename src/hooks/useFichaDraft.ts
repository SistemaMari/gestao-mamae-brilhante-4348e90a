import { useCallback, useEffect, useRef, useState } from 'react';
import { useDraftStorage, readDraft } from '@/hooks/useDraftStorage';

/**
 * useFichaDraft — backup local + recuperação de rascunho para as fichas de perfil
 * glicêmico (A/C, B/D, E, GTT). Extrai a maquinaria que o Retorno 1 já usava
 * (34B.1 seção 3.3/3.5): backup silencioso em localStorage enquanto o usuário
 * preenche e, ao reabrir, um modal perguntando se recupera ou descarta.
 *
 * Pontos-chave:
 *  - NÃO sinaliza "rascunho" na tela durante a edição — o backup é silencioso.
 *  - `hasContent` controla a GRAVAÇÃO: só grava quando há conteúdo real (grade/
 *    datas/observações). Assim, abrir a ficha (ou um auto-fill de IG, ou escolher
 *    a janela pós-prandial) NÃO cria rascunho espúrio. A recuperação (leitura) é
 *    independente: se existe um rascunho salvo, o modal aparece ao reabrir.
 *  - Chame `clearDraft()` após salvar com sucesso.
 */

interface Options<T> {
  /** Liga/desliga o mecanismo (ex.: !isPreview). */
  enabled: boolean;
  /** Sub-chave do localStorage (sem prefixo). Ex.: `nova:<pacienteId>:ficha_a`. */
  draftKey: string;
  /** Snapshot atual dos campos do form (memorize com useMemo). */
  current: T;
  /** Só grava quando true — evita rascunho espúrio de ficha vazia / auto-fill. */
  hasContent: boolean;
  /** Hidrata o form a partir de um draft recuperado (setState de cada campo). */
  onRecover: (draft: T) => void;
}

interface RecoveryState<T> {
  open: boolean;
  draft: T | null;
  timestamp: string;
}

interface Result<T> {
  /** Estado do modal de recuperação (passe para o DraftRecoveryModal). */
  recovery: RecoveryState<T>;
  /** Remove o rascunho local — chame após salvar com sucesso. */
  clearDraft: () => void;
  /** Força gravação imediata do rascunho local (cancela o debounce). */
  saveDraftNow: () => void;
  /** Handler do botão "Recuperar rascunho" do modal. */
  recoverDraft: () => void;
  /** Handler do botão "Descartar" do modal. */
  discardDraft: () => void;
}

export function useFichaDraft<T>({
  enabled,
  draftKey,
  current,
  hasContent,
  onRecover,
}: Options<T>): Result<T> {
  // Gravação gateada por hasContent; leitura/recuperação é independente (abaixo).
  const { saveDraft, clearDraft } = useDraftStorage<T>({
    key: draftKey,
    current,
    debounceMs: 2000,
    enabled: enabled && hasContent,
  });

  const [recovery, setRecovery] = useState<RecoveryState<T>>({
    open: false,
    draft: null,
    timestamp: '',
  });

  const onRecoverRef = useRef(onRecover);
  onRecoverRef.current = onRecover;

  // Reconciliação no mount: se há um rascunho salvo (só existe se teve conteúdo
  // real), abre o modal. Roda uma única vez.
  const reconciliadoRef = useRef(false);
  useEffect(() => {
    if (reconciliadoRef.current) return;
    reconciliadoRef.current = true;
    if (!enabled) return;
    const local = readDraft<T>(draftKey);
    if (local) {
      setRecovery({ open: true, draft: local.data, timestamp: local.savedAt });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recoverDraft = useCallback(() => {
    if (recovery.draft) onRecoverRef.current(recovery.draft);
    setRecovery({ open: false, draft: null, timestamp: '' });
  }, [recovery.draft]);

  const discardDraft = useCallback(() => {
    clearDraft();
    setRecovery({ open: false, draft: null, timestamp: '' });
  }, [clearDraft]);

  return { recovery, clearDraft, saveDraftNow: saveDraft, recoverDraft, discardDraft };
}
