import { describe, expect, it } from 'vitest';
import { getChaveStatusPaciente, getChipPorChave, getStatusPacienteChip, isPacienteEncerrada } from '@/lib/fichaUtils';
import type { MotivoEncerramento } from '@/lib/motivoEncerramento';

type P = { status_ficha: string; motivo_encerramento?: MotivoEncerramento | null };

const casos: P[] = [
  { status_ficha: 'aguardando_gj' },
  { status_ficha: 'aguardando_gtt' },
  { status_ficha: 'aguardando_gtt', motivo_encerramento: 'nao_retornou' },
  { status_ficha: 'dmg_confirmado' },
  { status_ficha: 'dmg_confirmado', motivo_encerramento: 'parto' },
  { status_ficha: 'aguardando_gj', motivo_encerramento: 'aborto' },
  { status_ficha: 'dmg_afastado' },
  { status_ficha: 'encerrada_insulinizacao' },
  { status_ficha: 'dmg_confirmado', motivo_encerramento: 'insulinizacao' },
  { status_ficha: 'encaminhada_endocrino' },
  { status_ficha: 'resultado_parto' },
  { status_ficha: 'dmg_confirmado', motivo_encerramento: 'outro' },
];

describe('getChaveStatusPaciente', () => {
  it('a tag da chave é a mesma tag exibida na linha', () => {
    for (const p of casos) expect(getChipPorChave(getChaveStatusPaciente(p))?.label, JSON.stringify(p)).toBe(getStatusPacienteChip(p).label);
  });

  it('motivo de encerramento vence o status_ficha', () => {
    expect(getChaveStatusPaciente({ status_ficha: 'aguardando_gtt', motivo_encerramento: 'nao_retornou' })).toBe('enc_nao_retornou');
    expect(getChaveStatusPaciente({ status_ficha: 'dmg_confirmado', motivo_encerramento: 'parto' })).toBe('enc_parto');
    expect(getChaveStatusPaciente({ status_ficha: 'encerrada_insulinizacao' })).toBe('enc_insulinizacao');
    expect(getChaveStatusPaciente({ status_ficha: 'encaminhada_endocrino' })).toBe('enc_insulinizacao');
    expect(getChaveStatusPaciente({ status_ficha: 'resultado_parto' })).toBe('enc_parto');
  });

  it('KPIs da lista somam o total (aguardando GJ + em acompanhamento + encerradas)', () => {
    const encerradas = casos.filter(isPacienteEncerrada).length;
    const gj = casos.filter((p) => getChaveStatusPaciente(p) === 'aguardando_gj').length;
    const acomp = casos.filter((p) => !isPacienteEncerrada(p) && getChaveStatusPaciente(p) !== 'aguardando_gj').length;
    expect(gj + acomp + encerradas).toBe(casos.length);
    expect(gj).toBe(1);
    expect(acomp).toBe(2);
  });
});
