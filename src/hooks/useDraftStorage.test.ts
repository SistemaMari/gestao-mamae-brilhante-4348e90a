import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDraftStorage,
  reconciliarRascunho,
  readDraft,
  writeDraft,
  removeDraft,
  limparRascunhosExpirados,
  _resetVarreduraParaTeste,
  DRAFT_TTL_MS,
  DRAFT_KEY_PREFIX,
} from './useDraftStorage';

/**
 * Testes do hook useDraftStorage (Prompt 34B seção 3.3) e da função pura
 * reconciliarRascunho (seção 3.3.3).
 *
 * Foco:
 *   - debounce de 2s
 *   - expiração de 30 dias
 *   - limpeza via clearDraft
 *   - hidratação com vs sem rascunho
 *   - reconciliação:
 *     * sem rascunho → use_server
 *     * igual ao servidor → discard_silently
 *     * diferente → show_recovery_modal
 *
 * Vitest com environment 'jsdom' já fornece localStorage.
 */

beforeEach(() => {
  window.localStorage.clear();
  _resetVarreduraParaTeste();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('readDraft / writeDraft / removeDraft', () => {
  it('writeDraft persiste e readDraft devolve com savedAt válido', () => {
    const ts = writeDraft('teste:1', { a: 1, b: 'x' });
    const got = readDraft<{ a: number; b: string }>('teste:1');
    expect(got).not.toBeNull();
    expect(got?.data).toEqual({ a: 1, b: 'x' });
    expect(got?.savedAt).toBe(ts);
  });

  it('removeDraft apaga a chave', () => {
    writeDraft('teste:2', { v: 1 });
    expect(readDraft('teste:2')).not.toBeNull();
    removeDraft('teste:2');
    expect(readDraft('teste:2')).toBeNull();
  });

  it('readDraft retorna null para chave inexistente', () => {
    expect(readDraft('inexistente')).toBeNull();
  });

  it('readDraft retorna null e remove entrada corrompida', () => {
    window.localStorage.setItem(`${DRAFT_KEY_PREFIX}corrompido`, '{not json');
    expect(readDraft('corrompido')).toBeNull();
  });

  it('readDraft expira rascunhos com savedAt > 30 dias e remove preguiçosamente', () => {
    const old = new Date(Date.now() - DRAFT_TTL_MS - 1000).toISOString();
    window.localStorage.setItem(
      `${DRAFT_KEY_PREFIX}expirado`,
      JSON.stringify({ data: { x: 1 }, savedAt: old }),
    );
    expect(readDraft('expirado')).toBeNull();
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}expirado`)).toBeNull();
  });
});

describe('limparRascunhosExpirados', () => {
  it('remove apenas as chaves expiradas, mantendo as frescas', () => {
    const fresh = new Date().toISOString();
    const old = new Date(Date.now() - DRAFT_TTL_MS - 60_000).toISOString();
    window.localStorage.setItem(
      `${DRAFT_KEY_PREFIX}fresca`,
      JSON.stringify({ data: { v: 1 }, savedAt: fresh }),
    );
    window.localStorage.setItem(
      `${DRAFT_KEY_PREFIX}velha`,
      JSON.stringify({ data: { v: 2 }, savedAt: old }),
    );

    const removidos = limparRascunhosExpirados();
    expect(removidos).toBe(1);
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}fresca`)).not.toBeNull();
    expect(window.localStorage.getItem(`${DRAFT_KEY_PREFIX}velha`)).toBeNull();
  });

  it('só roda uma vez por sessão (singleton)', () => {
    _resetVarreduraParaTeste();
    const old = new Date(Date.now() - DRAFT_TTL_MS - 60_000).toISOString();
    window.localStorage.setItem(
      `${DRAFT_KEY_PREFIX}v1`,
      JSON.stringify({ data: { v: 1 }, savedAt: old }),
    );
    expect(limparRascunhosExpirados()).toBe(1);
    // Segunda chamada na mesma sessão: returna 0 (não varre de novo).
    window.localStorage.setItem(
      `${DRAFT_KEY_PREFIX}v2`,
      JSON.stringify({ data: { v: 2 }, savedAt: old }),
    );
    expect(limparRascunhosExpirados()).toBe(0);
  });
});

describe('reconciliarRascunho — função pura (seção 3.3.3)', () => {
  it('sem rascunho local → use_server', () => {
    const r = reconciliarRascunho({ a: 1 }, null);
    expect(r.decision).toBe('use_server');
  });

  it('rascunho igual ao servidor → discard_silently', () => {
    const r = reconciliarRascunho(
      { a: 1, b: 'x' },
      { data: { a: 1, b: 'x' }, savedAt: '2026-05-30T12:00:00.000Z' },
    );
    expect(r.decision).toBe('discard_silently');
    if (r.decision === 'discard_silently') {
      expect(r.reason).toBe('equal_to_server');
    }
  });

  it('rascunho diferente do servidor → show_recovery_modal', () => {
    const r = reconciliarRascunho(
      { a: 1, b: 'x' },
      { data: { a: 1, b: 'y' }, savedAt: '2026-05-30T12:00:00.000Z' },
    );
    expect(r.decision).toBe('show_recovery_modal');
    if (r.decision === 'show_recovery_modal') {
      expect(r.draft).toEqual({ a: 1, b: 'y' });
      expect(r.draftTimestamp).toBe('2026-05-30T12:00:00.000Z');
    }
  });

  it('servidor null + rascunho local → show_recovery_modal (ficha nova com rascunho)', () => {
    const r = reconciliarRascunho<{ v: number }>(null, {
      data: { v: 1 },
      savedAt: '2026-05-30T10:00:00.000Z',
    });
    expect(r.decision).toBe('show_recovery_modal');
  });
});

describe('useDraftStorage — comportamento do hook', () => {
  it('debounce: não persiste antes de 2000ms', () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(
      ({ value }) => useDraftStorage({ key: 'h:1', current: value, debounceMs: 2000 }),
      { initialProps: { value: { x: 0 } } },
    );
    // Mudança 1
    rerender({ value: { x: 1 } });
    act(() => { vi.advanceTimersByTime(500); });
    expect(readDraft('h:1')).toBeNull();
    // Mudança 2 (reseta o timer)
    rerender({ value: { x: 2 } });
    act(() => { vi.advanceTimersByTime(1500); });
    expect(readDraft('h:1')).toBeNull();
    // Mais 500ms (total 2000 desde a última mudança) → persiste
    act(() => { vi.advanceTimersByTime(500); });
    const stored = readDraft<{ x: number }>('h:1');
    expect(stored).not.toBeNull();
    expect(stored?.data).toEqual({ x: 2 });
  });

  it('saveDraft() força gravação imediata cancelando debounce', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDraftStorage({ key: 'h:2', current: value, debounceMs: 2000 }),
      { initialProps: { value: { x: 0 } } },
    );
    rerender({ value: { x: 42 } });
    expect(readDraft('h:2')).toBeNull();
    act(() => {
      result.current.saveDraft();
    });
    expect(readDraft<{ x: number }>('h:2')?.data).toEqual({ x: 42 });
  });

  it('clearDraft() remove a chave e reseta status para idle', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDraftStorage({ key: 'h:3', current: value, debounceMs: 2000 }),
      { initialProps: { value: { x: 0 } } },
    );
    rerender({ value: { x: 1 } });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(readDraft('h:3')).not.toBeNull();
    expect(result.current.status).toBe('persisted');

    act(() => {
      result.current.clearDraft();
    });
    expect(readDraft('h:3')).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('hidrata draft existente no mount (lê valor inicial)', () => {
    writeDraft('h:4', { y: 99, s: 'oi' });
    const { result } = renderHook(() =>
      useDraftStorage({ key: 'h:4', current: { y: 0, s: '' }, debounceMs: 2000 }),
    );
    expect(result.current.draft).toEqual({ y: 99, s: 'oi' });
    expect(result.current.draftTimestamp).not.toBeNull();
  });

  it('sem rascunho prévio → draft=null e draftTimestamp=null', () => {
    const { result } = renderHook(() =>
      useDraftStorage({ key: 'h:5', current: { y: 0 }, debounceMs: 2000 }),
    );
    expect(result.current.draft).toBeNull();
    expect(result.current.draftTimestamp).toBeNull();
  });

  it('enabled=false: não lê draft nem persiste', () => {
    vi.useFakeTimers();
    writeDraft('h:6', { v: 1 });
    const { result, rerender } = renderHook(
      ({ value }) =>
        useDraftStorage({ key: 'h:6', current: value, debounceMs: 2000, enabled: false }),
      { initialProps: { value: { v: 0 } } },
    );
    expect(result.current.draft).toBeNull(); // não leu
    rerender({ value: { v: 9 } });
    act(() => { vi.advanceTimersByTime(5000); });
    // Storage continua com o valor original (não foi sobrescrito).
    expect(readDraft<{ v: number }>('h:6')?.data).toEqual({ v: 1 });
  });

  it('estado dirty enquanto debounce pendente; persisted após', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDraftStorage({ key: 'h:7', current: value, debounceMs: 2000 }),
      { initialProps: { value: { x: 0 } } },
    );
    expect(result.current.status).toBe('idle');
    rerender({ value: { x: 1 } });
    expect(result.current.status).toBe('dirty');
    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current.status).toBe('persisted');
  });

  it('não persiste quando current é igual ao último persistido (idempotência)', () => {
    vi.useFakeTimers();
    writeDraft('h:8', { v: 5 });
    const initialEntry = readDraft<{ v: number }>('h:8');
    const initialSavedAt = initialEntry?.savedAt;

    const { rerender } = renderHook(
      ({ value }) => useDraftStorage({ key: 'h:8', current: value, debounceMs: 2000 }),
      { initialProps: { value: { v: 5 } } }, // igual ao já persistido
    );
    rerender({ value: { v: 5 } }); // ainda igual
    act(() => { vi.advanceTimersByTime(5000); });
    const after = readDraft<{ v: number }>('h:8');
    expect(after?.savedAt).toBe(initialSavedAt); // sem nova gravação
  });
});
