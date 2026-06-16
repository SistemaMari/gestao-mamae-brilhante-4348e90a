
CREATE OR REPLACE FUNCTION public.seed_pacientes_teste_para_gestores()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_unidade uuid := 'cbaaf853-fb18-44c9-8da3-8d36f8ed3b10';
  v_gestor record;
  v_src record;
  v_new_pac uuid;
  v_marker text;
  v_pac_count int := 0;
  v_skipped int := 0;
  v_gestores int := 0;
  v_cons_map jsonb;
  v_usg_map jsonb;
  v_perfil_map jsonb;
  v_cons record;
  v_usg record;
  v_pg record;
  v_new_id uuid;
  v_mapped_cons uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin' USING ERRCODE = '42501';
  END IF;

  FOR v_gestor IN
    SELECT id, unidade_id
    FROM public.profissionais
    WHERE perfil_institucional = 'gestor'
      AND acesso_revogado = false
      AND unidade_id IS NOT NULL
      AND unidade_id <> v_origem_unidade
  LOOP
    v_gestores := v_gestores + 1;
    v_marker := '-G' || substr(v_gestor.unidade_id::text, 1, 8);

    FOR v_src IN
      SELECT *
      FROM public.pacientes
      WHERE unidade_id = v_origem_unidade
        AND nome ILIKE 'Teste%'
        AND is_rascunho = false
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.pacientes
        WHERE unidade_id = v_gestor.unidade_id
          AND numero_identificacao = v_src.numero_identificacao || v_marker
      ) THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      v_new_pac := gen_random_uuid();

      INSERT INTO public.pacientes (
        id, profissional_id, unidade_id, nome, numero_identificacao,
        dum, usg_data, usg_ig_semanas, usg_ig_dias, status_ficha,
        dmg_gestacao_anterior, data_ultima_consulta, tipo_retorno,
        data_proximo_retorno, created_at, updated_at, data_nascimento,
        pais, estado, cidade, tipo_identificacao, is_rascunho, whatsapp,
        referencia_ig, referencia_usg_id
      ) VALUES (
        v_new_pac, v_gestor.id, v_gestor.unidade_id, v_src.nome,
        v_src.numero_identificacao || v_marker,
        v_src.dum, v_src.usg_data, v_src.usg_ig_semanas, v_src.usg_ig_dias,
        v_src.status_ficha, v_src.dmg_gestacao_anterior,
        v_src.data_ultima_consulta, v_src.tipo_retorno,
        v_src.data_proximo_retorno, v_src.created_at, now(),
        v_src.data_nascimento, v_src.pais, v_src.estado, v_src.cidade,
        v_src.tipo_identificacao, false, v_src.whatsapp,
        v_src.referencia_ig, NULL
      );
      v_pac_count := v_pac_count + 1;

      v_usg_map := '{}'::jsonb;
      FOR v_usg IN SELECT * FROM public.exames_usg WHERE paciente_id = v_src.id LOOP
        v_new_id := gen_random_uuid();
        INSERT INTO public.exames_usg (id, paciente_id, data_exame, ig_semanas, ig_dias, ordem, criado_em, criado_por)
        VALUES (v_new_id, v_new_pac, v_usg.data_exame, v_usg.ig_semanas, v_usg.ig_dias, v_usg.ordem, v_usg.criado_em, v_gestor.id);
        v_usg_map := v_usg_map || jsonb_build_object(v_usg.id::text, v_new_id::text);
      END LOOP;

      IF v_src.referencia_usg_id IS NOT NULL AND v_usg_map ? v_src.referencia_usg_id::text THEN
        UPDATE public.pacientes
        SET referencia_usg_id = (v_usg_map->>v_src.referencia_usg_id::text)::uuid
        WHERE id = v_new_pac;
      END IF;

      v_cons_map := '{}'::jsonb;
      FOR v_cons IN SELECT * FROM public.consultas WHERE paciente_id = v_src.id LOOP
        v_new_id := gen_random_uuid();
        INSERT INTO public.consultas (
          id, paciente_id, profissional_id, tipo, numero_sequencial, data,
          ig_semanas, ig_dias, observacoes, status_gerado, created_at,
          cenario_clinico, is_rascunho, status_ficha, ficha_finalizada_em
        ) VALUES (
          v_new_id, v_new_pac, v_gestor.id, v_cons.tipo, v_cons.numero_sequencial,
          v_cons.data, v_cons.ig_semanas, v_cons.ig_dias, v_cons.observacoes,
          v_cons.status_gerado, v_cons.created_at, v_cons.cenario_clinico,
          v_cons.is_rascunho, v_cons.status_ficha, v_cons.ficha_finalizada_em
        );
        v_cons_map := v_cons_map || jsonb_build_object(v_cons.id::text, v_new_id::text);
      END LOOP;

      INSERT INTO public.exames_glicemia (
        id, consulta_id, paciente_id, profissional_id, valor_mgdl, tipo_exame,
        data_exame, ig_semanas_na_data, ig_dias_na_data, created_at,
        gtt_jejum, gtt_1h, gtt_2h, gtt_recurso_limitado
      )
      SELECT gen_random_uuid(),
             NULLIF(v_cons_map->>eg.consulta_id::text, '')::uuid,
             v_new_pac, v_gestor.id, eg.valor_mgdl, eg.tipo_exame,
             eg.data_exame, eg.ig_semanas_na_data, eg.ig_dias_na_data, eg.created_at,
             eg.gtt_jejum, eg.gtt_1h, eg.gtt_2h, eg.gtt_recurso_limitado
      FROM public.exames_glicemia eg
      WHERE eg.paciente_id = v_src.id;

      INSERT INTO public.decisoes_ficha_a (
        id, consulta_id, paciente_id, profissional_id, checklist_dieta,
        checklist_exercicio, checklist_ganho_peso, checklist_pfe_us, checklist_ca,
        checklist_la, percentual_meta, regra_aplicada, conduta_gerada,
        memoria_glicosimetro, pactuacao_adesao, dose_insulina_total,
        dose_insulina_manha, dose_insulina_noite, proxima_ficha_recomendada,
        created_at, updated_at
      )
      SELECT gen_random_uuid(),
             NULLIF(v_cons_map->>d.consulta_id::text, '')::uuid,
             v_new_pac, v_gestor.id, d.checklist_dieta, d.checklist_exercicio,
             d.checklist_ganho_peso, d.checklist_pfe_us, d.checklist_ca, d.checklist_la,
             d.percentual_meta, d.regra_aplicada, d.conduta_gerada,
             d.memoria_glicosimetro, d.pactuacao_adesao, d.dose_insulina_total,
             d.dose_insulina_manha, d.dose_insulina_noite, d.proxima_ficha_recomendada,
             d.created_at, d.updated_at
      FROM public.decisoes_ficha_a d
      WHERE d.paciente_id = v_src.id;

      INSERT INTO public.laudos (
        id, paciente_id, consulta_id, profissional_id, cenario_clinico,
        conteudo_laudo, status, metadata, created_at, updated_at
      )
      SELECT gen_random_uuid(), v_new_pac,
             NULLIF(v_cons_map->>l.consulta_id::text, '')::uuid,
             v_gestor.id, l.cenario_clinico, l.conteudo_laudo, l.status,
             l.metadata, l.created_at, l.updated_at
      FROM public.laudos l
      WHERE l.paciente_id = v_src.id;

      v_perfil_map := '{}'::jsonb;
      FOR v_pg IN SELECT * FROM public.perfis_glicemicos WHERE paciente_id = v_src.id LOOP
        v_new_id := gen_random_uuid();
        v_mapped_cons := NULLIF(v_cons_map->>v_pg.consulta_id::text, '')::uuid;
        INSERT INTO public.perfis_glicemicos (
          id, paciente_id, consulta_id, profissional_id, tipo_perfil,
          peso_paciente_kg, data_inicio, data_fim, percentual_meta, decisao,
          dose_insulina_calculada, created_at, tipo_pos_prandial, conduta_e,
          dose_insulina_manha, dose_insulina_noite, proxima_ficha_recomendada,
          total_preenchidos, na_meta
        ) VALUES (
          v_new_id, v_new_pac, v_mapped_cons, v_gestor.id, v_pg.tipo_perfil,
          v_pg.peso_paciente_kg, v_pg.data_inicio, v_pg.data_fim, v_pg.percentual_meta,
          v_pg.decisao, v_pg.dose_insulina_calculada, v_pg.created_at,
          v_pg.tipo_pos_prandial, v_pg.conduta_e, v_pg.dose_insulina_manha,
          v_pg.dose_insulina_noite, v_pg.proxima_ficha_recomendada,
          v_pg.total_preenchidos, v_pg.na_meta
        );
        v_perfil_map := v_perfil_map || jsonb_build_object(v_pg.id::text, v_new_id::text);
      END LOOP;

      INSERT INTO public.valores_perfil (id, perfil_id, dia, ponto, valor_mgdl, created_at)
      SELECT gen_random_uuid(),
             (v_perfil_map->>vp.perfil_id::text)::uuid,
             vp.dia, vp.ponto, vp.valor_mgdl, vp.created_at
      FROM public.valores_perfil vp
      WHERE vp.perfil_id IN (SELECT id FROM public.perfis_glicemicos WHERE paciente_id = v_src.id)
        AND v_perfil_map ? vp.perfil_id::text;

      INSERT INTO public.registros_atendimento (
        id, paciente_id, profissional_id, unidade_id, tipo_operacao,
        recurso_id, recurso_tipo, profissional_nome, profissional_crm,
        profissional_especialidade, created_at
      )
      SELECT gen_random_uuid(), v_new_pac, v_gestor.id, v_gestor.unidade_id,
             ra.tipo_operacao, ra.recurso_id, ra.recurso_tipo,
             ra.profissional_nome, ra.profissional_crm, ra.profissional_especialidade,
             ra.created_at
      FROM public.registros_atendimento ra
      WHERE ra.paciente_id = v_src.id;

      INSERT INTO public.partos (
        id, paciente_id, profissional_id, unidade_id, data_parto, via_parto,
        classificacao_rn, peso_rn_g, ig_parto_semanas, ig_parto_dias,
        intercorrencia_materna, descricao_intercorrencia_materna,
        intercorrencia_neonatal, descricao_intercorrencia_neonatal,
        observacoes, created_at, updated_at, is_rascunho
      )
      SELECT gen_random_uuid(), v_new_pac, v_gestor.id, v_gestor.unidade_id,
             pa.data_parto, pa.via_parto, pa.classificacao_rn, pa.peso_rn_g,
             pa.ig_parto_semanas, pa.ig_parto_dias, pa.intercorrencia_materna,
             pa.descricao_intercorrencia_materna, pa.intercorrencia_neonatal,
             pa.descricao_intercorrencia_neonatal, pa.observacoes,
             pa.created_at, pa.updated_at, pa.is_rascunho
      FROM public.partos pa
      WHERE pa.paciente_id = v_src.id;

    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'gestores_processados', v_gestores,
    'pacientes_clonadas', v_pac_count,
    'puladas_ja_existentes', v_skipped,
    'executado_em', now()
  );
END;
$$;
