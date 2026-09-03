import { describe, it, expect } from 'vitest';
import { validarWhatsappBR, paraFormatoCanonico } from './whatsapp';

describe('validarWhatsappBR', () => {
  it('aceita vazio quando não é obrigatório', () => {
    expect(validarWhatsappBR('')).toEqual({ ok: true });
  });

  it('recusa vazio quando é obrigatório', () => {
    expect(validarWhatsappBR('', { obrigatorio: true })).toEqual({ ok: false, codigo: 'obrigatorio' });
  });

  it('aceita celular com 11 dígitos (DDD + 9 dígitos)', () => {
    expect(validarWhatsappBR('(11) 91234-5678', { obrigatorio: true })).toEqual({ ok: true });
    expect(validarWhatsappBR('11912345678')).toEqual({ ok: true });
  });

  it('recusa 10 dígitos — celular sem o 9 (o bug do print)', () => {
    // (21) 9100-3894 = 10 dígitos → antes passava, agora é incompleto.
    expect(validarWhatsappBR('(21) 9100-3894')).toEqual({ ok: false, codigo: 'incompleto' });
  });

  it('recusa número começado mas não terminado', () => {
    expect(validarWhatsappBR('(11) 9123')).toEqual({ ok: false, codigo: 'incompleto' });
  });
});

describe('paraFormatoCanonico', () => {
  it('prefixa o DDI 55 a um celular de 11 dígitos', () => {
    expect(paraFormatoCanonico('(11) 91234-5678')).toBe('5511912345678');
  });

  it('devolve null para vazio', () => {
    expect(paraFormatoCanonico('')).toBeNull();
  });
});
