import { describe, it, expect } from 'vitest';
import {
  MOTIVO_ENCERRAMENTO_LABEL,
  MOTIVOS_MANUAIS,
  motivoExigeData,
  motivoExigeObs,
  resolverMotivoEfetivo,
} from './motivoEncerramento';

describe('MOTIVOS_MANUAIS', () => {
  it('não inclui insulinização (gravada só pelo motor)', () => {
    expect(MOTIVOS_MANUAIS).not.toContain('insulinizacao');
    expect([...MOTIVOS_MANUAIS]).toEqual(['parto', 'aborto', 'nao_retornou', 'outro']);
  });

  it('tem rótulo PT para todos os motivos do enum', () => {
    expect(MOTIVO_ENCERRAMENTO_LABEL.insulinizacao).toBe('Insulinização');
    expect(MOTIVO_ENCERRAMENTO_LABEL.parto).toBe('Parto');
    expect(MOTIVO_ENCERRAMENTO_LABEL.aborto).toBe('Aborto');
    expect(MOTIVO_ENCERRAMENTO_LABEL.nao_retornou).toBe('Paciente não retornou');
    expect(MOTIVO_ENCERRAMENTO_LABEL.outro).toBe('Outro');
  });
});

describe('campos obrigatórios por motivo', () => {
  it('parto e aborto exigem data', () => {
    expect(motivoExigeData('parto')).toBe(true);
    expect(motivoExigeData('aborto')).toBe(true);
    expect(motivoExigeData('nao_retornou')).toBe(false);
    expect(motivoExigeData('outro')).toBe(false);
  });

  it('apenas "outro" exige texto livre', () => {
    expect(motivoExigeObs('outro')).toBe(true);
    expect(motivoExigeObs('parto')).toBe(false);
    expect(motivoExigeObs('nao_retornou')).toBe(false);
  });
});

describe('resolverMotivoEfetivo — ponte status_ficha → motivo', () => {
  it('paciente ativa → null', () => {
    expect(resolverMotivoEfetivo({ motivo_encerramento: null, status_ficha: 'dmg_confirmado' })).toBeNull();
    expect(resolverMotivoEfetivo({ status_ficha: 'aguardando_gj' })).toBeNull();
  });

  it('prioriza motivo_encerramento quando presente', () => {
    expect(resolverMotivoEfetivo({ motivo_encerramento: 'parto', status_ficha: 'dmg_confirmado' })).toBe('parto');
    expect(resolverMotivoEfetivo({ motivo_encerramento: 'nao_retornou', status_ficha: 'aguardando_gj' })).toBe('nao_retornou');
  });

  it('regressão 42B: resolve insulinização mesmo só pelo status legado', () => {
    expect(resolverMotivoEfetivo({ motivo_encerramento: null, status_ficha: 'encerrada_insulinizacao' })).toBe('insulinizacao');
    // e quando ambos vêm gravados (write real do 42B)
    expect(resolverMotivoEfetivo({ motivo_encerramento: 'insulinizacao', status_ficha: 'encerrada_insulinizacao' })).toBe('insulinizacao');
  });
});
