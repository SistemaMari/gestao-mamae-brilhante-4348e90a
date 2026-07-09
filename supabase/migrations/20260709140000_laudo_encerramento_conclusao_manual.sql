-- PROMPT 43 (follow-up) · Conclusão do encerramento MANUAL — 3 textos editáveis
-- ---------------------------------------------------------------------------
-- Quando o profissional encerra o acompanhamento pelo popup "Encerrar
-- acompanhamento" (parto / aborto / não retornou), o card passa a exibir uma
-- CONCLUSÃO CLÍNICA. Estes 3 textos ficam editáveis no painel admin
-- (/admin/laudos), como os demais laudos.
--
-- Chaves: tipo_consulta='encerramento', bloco='conclusao', desfecho ∈
-- {parto, aborto, nao_retornou}. "Outro" e "insulinização" NÃO entram aqui
-- (têm texto próprio no card / no laudo de insulina).
--
-- Reteste puerperal (banner): parto/aborto SIM (calculado da data do evento);
-- não-retornou NÃO — isso é decidido no frontend, não aqui.
--
-- ⚠️ Como toda mudança em laudo_textos, NÃO roda no Publish do Lovable —
--    aplicar à mão no Supabase SQL Editor. Textos são RASCUNHO de IA, para as
--    Dras ratificarem/editarem no admin.
-- ---------------------------------------------------------------------------

INSERT INTO public.laudo_textos
  (tipo_consulta, desfecho_clinico, bloco, ordem_bloco, titulo_bloco, texto, status, observacoes)
VALUES
  ('encerramento','parto','conclusao',1,'Conclusão do encerramento',
$t$Encerramento do acompanhamento no parto. A paciente teve diagnóstico de diabete mellitus gestacional, tratada com terapia nutricional e atividade física, com controle glicêmico mantido ao longo do acompanhamento, sem necessidade de insulina. A responsabilidade pela gestante permanece com o obstetra.$t$,
   'publicado','Rascunho de IA (Prompt 43) pendente de ratificação clínica — 2026-07-09.'),

  ('encerramento','aborto','conclusao',1,'Conclusão do encerramento',
$t$Encerramento do acompanhamento após aborto. A paciente teve diagnóstico de diabete mellitus gestacional, tratada com terapia nutricional e atividade física, com controle glicêmico mantido, sem necessidade de insulina.$t$,
   'publicado','Rascunho de IA (Prompt 43) pendente de ratificação clínica — 2026-07-09.'),

  ('encerramento','nao_retornou','conclusao',1,'Conclusão do encerramento',
$t$Encerramento por não comparecimento. A paciente não retornou para dar continuidade ao acompanhamento do diabete mellitus gestacional. Recomenda-se, se possível, contato telefônico para reavaliação.$t$,
   'publicado','Rascunho de IA (Prompt 43) pendente de ratificação clínica — 2026-07-09.')
ON CONFLICT (tipo_consulta, desfecho_clinico, bloco) WHERE status = 'publicado'
DO UPDATE SET texto = EXCLUDED.texto, titulo_bloco = EXCLUDED.titulo_bloco, observacoes = EXCLUDED.observacoes;
