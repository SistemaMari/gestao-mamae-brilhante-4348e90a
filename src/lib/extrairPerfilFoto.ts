/**
 * V4 — Serviço de leitura da foto do controle glicêmico.
 *
 * Ponto único de troca entre a SIMULAÇÃO (usada enquanto o back-end não existe)
 * e a chamada real à edge function `extrair-perfil-foto`. Para ligar de verdade,
 * basta virar `USAR_SIMULACAO` para false — a assinatura e o retorno são os
 * mesmos, então nenhuma tela precisa mudar.
 *
 * O contrato de entrada/saída está especificado no documento de back-end e é
 * espelhado por `ResultadoExtracao` em `perfilPorFoto.ts`.
 */
import { supabase } from '@/integrations/supabase/client';
import type { ResultadoExtracao } from './perfilPorFoto';

/**
 * ⚠️ ENQUANTO TRUE, NADA É LIDO DE VERDADE — os números são inventados aqui
 * mesmo, para permitir construir e testar as telas antes do back-end existir.
 * Virar para false quando a edge function estiver no ar.
 */
export const USAR_SIMULACAO = true;

/**
 * Trava de produto: enquanto false, o botão de foto não aparece para ninguém.
 * Serve para mergear e publicar sem expor a funcionalidade pela metade.
 */
export const PERFIL_POR_FOTO_ATIVO = false;

export interface ParametrosExtracao {
  pacienteId: string;
  consultaId: string | null;
  storagePath: string;
  tipoPerfil: '4_pontos' | '6_pontos';
  janelaPos: '1h' | '2h';
  dataInicio: string;
  dias: number;
  /** Datas das linhas da grade ('dd/MM/yyyy'), usadas só pela simulação. */
  datasDias?: readonly string[];
}

export class ErroExtracao extends Error {
  constructor(public codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroExtracao';
  }
}

export async function extrairPerfilFoto(p: ParametrosExtracao): Promise<ResultadoExtracao> {
  if (USAR_SIMULACAO) return simular(p);

  const { data, error } = await supabase.functions.invoke('extrair-perfil-foto', {
    body: {
      paciente_id: p.pacienteId,
      consulta_id: p.consultaId,
      storage_path: p.storagePath,
      tipo_perfil: p.tipoPerfil,
      janela_pos: p.janelaPos,
      data_inicio: p.dataInicio,
      dias: p.dias,
    },
  });

  if (error) throw new ErroExtracao('falha_servico', error.message);
  if (!data?.ok) throw new ErroExtracao(data?.codigo ?? 'desconhecido', data?.mensagem ?? '');

  return {
    leituras: data.leituras ?? [],
    incertos: data.incertos ?? [],
    observacoes: data.observacoes ?? [],
  };
}

// ── Simulação ───────────────────────────────────────────────────────────────
// Devolve um resultado com a mesma cara do real, inclusive com duas células
// que "não puderam ser lidas" — sem isso a tela de conferência nunca mostraria
// o comportamento âmbar, que é justamente o mais importante de validar.

function brParaIso(dataBr: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBr.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function simular(p: ParametrosExtracao): Promise<ResultadoExtracao> {
  await new Promise((r) => setTimeout(r, 1800)); // finge o tempo da leitura

  const datas = (p.datasDias ?? []).map(brParaIso).filter((d): d is string => !!d);
  if (datas.length === 0) {
    return { leituras: [], incertos: [], observacoes: ['Nenhum dia do período foi encontrado no papel.'] };
  }

  const jejuns = [92, 92, 96, 95, 96, 92, 92, 94, 91, 93, 95, 92, 90, 94, 92];
  const posCafe = [112, 114, 112, 114, 112, 114, 120, 118, 116, 112, 115, 119, 113, 117, 114];
  const posAlmoco = [120, 120, 120, 125, 125, 120, 125, 122, 128, 121, 124, 126, 119, 123, 120];
  const posJantar = [125, 125, 125, 125, 125, 125, 125, 127, 124, 126, 123, 125, 128, 122, 125];

  const seis = p.tipoPerfil === '6_pontos';

  const leituras = datas.map((data, i) => ({
    data,
    // dia 4 sem pós-almoço e dia 6 sem jejum: viram as células âmbar
    jejum: i === 5 ? null : jejuns[i % jejuns.length],
    pos_cafe: posCafe[i % posCafe.length],
    pos_almoco: i === 3 ? null : posAlmoco[i % posAlmoco.length],
    pos_jantar: posJantar[i % posJantar.length],
    ...(seis ? { pre_almoco: 88 + (i % 5), pre_jantar: 90 + (i % 4) } : {}),
  }));

  const incertos = [
    ...(datas[3] ? [{ data: datas[3], ponto: 'pos_almoco', motivo: 'rasura sobre o número' }] : []),
    ...(datas[5] ? [{ data: datas[5], ponto: 'jejum', motivo: 'valor cortado pela borda da foto' }] : []),
  ];

  return {
    leituras,
    incertos,
    observacoes: ['Leitura simulada — o serviço de leitura ainda não está ligado.'],
  };
}
