-- PROMPT 43 · Frente A.1 — Conduta de encerramento por insulinização
-- ---------------------------------------------------------------------------
-- No fluxo novo, iniciar insulina SEMPRE encerra o acompanhamento ativo da MARI
-- (Família 42). As três chaves de insulina do Retorno 2 (Ficha A/C) —
-- r2_insulina, r3_insulina, r4b_insulina — deixam de rotear para "perfil de 6
-- pontos / próximo retorno em 7-10 dias" e passam a orientar o encerramento com
-- os três arranjos de continuidade + urgência com o endocrinologista.
--
-- Escopo desta migration: SUBSTITUIR APENAS o bloco `conduta` (Conduta
-- Orientativa) dessas 3 chaves, para tipo_consulta = ficha_a E ficha_c. O texto
-- é IDÊNTICO nas três. NÃO tocar no bloco `justificativa` (diferente e correto
-- em cada uma). No r4b_insulina, o antigo bloco "OBSERVAÇÃO —" sai junto — era
-- resíduo do fluxo antigo (prometia monitoramento que não existe mais).
--
-- Upsert idempotente no publicado (mesmo padrão de seed_laudo_textos): mantém
-- placeholders [entre colchetes] e quebras de linha. Origem marcada em
-- `observacoes` (rascunho de IA pendente de ratificação clínica — 2026-07-09).
-- ---------------------------------------------------------------------------

INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, observacoes)
SELECT
  t.tipo,
  d.desfecho,
  'conduta',
  3,
  'Conduta Orientativa',
$t$Iniciar insulinoterapia na dose de [dose total de insulina]:

>> 2/3 pela manhã: [dose manhã] e
>> 1/3 às 22h (bed time): [dose noite]

— Ambos por via subcutânea —

Orientar a técnica de aplicação, os cuidados no armazenamento e transporte da insulina e os sinais de hipoglicemia.

Manter a dieta, a atividade física e a monitorização glicêmica diária em 6 pontos — jejum, pré e pós-prandiais —, pactuando com a paciente a aferição pós-prandial de 1h ou de 2h.

A partir da introdução da insulina, o acompanhamento ativo da MARI se encerra.

A responsabilidade pela gestante permanece com o obstetra (GO), cujas metas glicêmicas obstétricas sempre prevalecem.

A continuidade do controle glicêmico pode seguir três arranjos, à escolha do obstetra:
(1) o próprio obstetra conduz o ajuste das doses, se houver confiança para isso;
(2) associação com endocrinologista, que faz os acertos das doses de insulina, sem assumir o caso; ou
(3) referência a serviço especializado, na rede pública.

Caso opte por associar ou referenciar o endocrinologista, a consulta deve ocorrer em 7 a 10 dias a partir da data de hoje.

Se não houver agenda do profissional nesse prazo, oriente a paciente a procurar outro endocrinologista com urgência. Um feto em regime hiperglicêmico não pode esperar.

ATENÇÃO: Reteste puerperal: realizar GTT 75g (jejum e 2h) entre 6 e 8 semanas após o parto, para reclassificação do estado glicêmico.$t$,
  'publicado',
  'Rascunho de IA (Prompt 43) pendente de ratificação clínica das Dras. Marilsa/Iracema — publicado em 2026-07-09.'
FROM (VALUES ('ficha_a'), ('ficha_c')) AS t(tipo)
CROSS JOIN (VALUES ('r2_insulina'), ('r3_insulina'), ('r4b_insulina')) AS d(desfecho)
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET texto = EXCLUDED.texto, observacoes = EXCLUDED.observacoes;
