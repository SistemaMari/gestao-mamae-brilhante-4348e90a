import { describe, it, expect, beforeEach } from 'vitest';
import {
  marcarSessaoPlantao, limparSessaoPlantao, sessaoPlantaoExpirada, TOLERANCIA_MS,
} from './sessaoPlantao';

describe('sessão de plantão (institucional)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('sem nenhuma marca (navegador reaberto) → expirada', () => {
    expect(sessaoPlantaoExpirada()).toBe(true);
  });

  it('atualizar a página na mesma aba mantém o login, mesmo depois de muito tempo', () => {
    marcarSessaoPlantao(1_000);
    expect(sessaoPlantaoExpirada(1_000 + 10 * TOLERANCIA_MS)).toBe(false);
  });

  it('aba nova com outra aba ativa (batimento recente) mantém o login', () => {
    marcarSessaoPlantao(1_000);
    sessionStorage.clear(); // aba nova não tem a marca
    expect(sessaoPlantaoExpirada(1_000 + TOLERANCIA_MS - 1)).toBe(false);
  });

  it('navegador fechado (sem marca de aba e batimento antigo) → expirada', () => {
    marcarSessaoPlantao(1_000);
    sessionStorage.clear();
    expect(sessaoPlantaoExpirada(1_000 + TOLERANCIA_MS + 1)).toBe(true);
  });

  it('sair limpa tudo', () => {
    marcarSessaoPlantao();
    limparSessaoPlantao();
    expect(sessaoPlantaoExpirada()).toBe(true);
  });
});
