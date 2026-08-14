import { describe, it, expect } from 'vitest';
import { consultaDitaStatusPaciente } from './statusSync';

const cs = (seq: number) => ({ numero_sequencial: seq });

describe('consultaDitaStatusPaciente', () => {
  it('consulta NOVA (sem editingConsulta) sempre dita o status', () => {
    expect(consultaDitaStatusPaciente(null, [cs(1), cs(2), cs(3)])).toBe(true);
    expect(consultaDitaStatusPaciente(undefined, [])).toBe(true);
  });

  it('editar a consulta MAIS RECENTE dita o status', () => {
    expect(consultaDitaStatusPaciente(cs(3), [cs(1), cs(2), cs(3)])).toBe(true);
  });

  it('editar uma consulta ANTIGA NÃO mexe no status (bug do Retorno 1)', () => {
    expect(consultaDitaStatusPaciente(cs(1), [cs(1), cs(2), cs(3)])).toBe(false);
    expect(consultaDitaStatusPaciente(cs(2), [cs(1), cs(2), cs(3)])).toBe(false);
  });

  it('empate de sequência ainda dita (>=)', () => {
    expect(consultaDitaStatusPaciente(cs(2), [cs(2), cs(2)])).toBe(true);
  });

  it('numero_sequencial ausente é tratado como 0', () => {
    expect(consultaDitaStatusPaciente({ numero_sequencial: null }, [cs(1)])).toBe(false);
    expect(consultaDitaStatusPaciente({}, [{}])).toBe(true); // 0 >= 0
  });
});
