-- PROMPT 43 (follow-up) · Remover a urgência com o endocrinologista do TEXTO da
-- Conduta — ela passou a ser um BANNER VERMELHO fixo no laudo (frontend), ao final
-- da Conduta Orientativa, para os desfechos de insulina.
-- ---------------------------------------------------------------------------
-- Tira as 2 frases de urgência ("Caso opte por associar…" e "Se não houver
-- agenda…") do bloco `conduta` das 3 chaves de insulina (r2/r3/r4b × ficha_a/
-- ficha_c). O componente BannerUrgenciaEndocrino renderiza essas frases em
-- destaque; deixá-las também no texto duplicaria. A linha de reteste puerperal
-- PERMANECE no texto (decisão clínica: reteste em dois lugares).
--
-- ⚠️ Como toda mudança em laudo_textos, NÃO roda no Publish do Lovable — precisa
--    ser aplicada à mão no Supabase SQL Editor (mesmo $t$…$t$).
-- ---------------------------------------------------------------------------

UPDATE public.laudo_textos
SET texto = $t$Iniciar insulinoterapia na dose de [dose total de insulina]:

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

ATENÇÃO: Reteste puerperal: realizar GTT 75g (jejum e 2h) entre 6 e 8 semanas após o parto, para reclassificação do estado glicêmico.$t$,
    observacoes = 'Rascunho de IA (Prompt 43) pendente de ratificação clínica das Dras. Marilsa/Iracema — urgência endócrino movida para banner do laudo em 2026-07-09.'
WHERE bloco = 'conduta'
  AND status = 'publicado'
  AND tipo_consulta IN ('ficha_a','ficha_c')
  AND desfecho_clinico IN ('r2_insulina','r3_insulina','r4b_insulina');
