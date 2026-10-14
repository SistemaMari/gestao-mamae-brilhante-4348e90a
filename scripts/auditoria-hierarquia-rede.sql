-- Auditoria da hierarquia rede → gestor geral → unidade → gestor → profissionais → gestantes.
-- SOMENTE LEITURA. Cada linha = um tipo de problema e quantos casos existem.
-- Rodar no SQL Editor do Supabase (ou pedir ao Lovable "rode esta consulta").

WITH gestores AS (
  SELECT unidade_id, count(*) AS n
  FROM profissionais
  WHERE perfil_institucional = 'gestor' AND acesso_revogado = false AND unidade_id IS NOT NULL
  GROUP BY unidade_id
)
SELECT '1. Unidade ativa SEM gestor' AS problema, count(*) AS casos
FROM unidades u LEFT JOIN gestores g ON g.unidade_id = u.id
WHERE u.ativa = true AND g.unidade_id IS NULL
UNION ALL
SELECT '2. Unidade com MAIS DE UM gestor ativo', count(*) FROM gestores WHERE n > 1
UNION ALL
SELECT '3. Gestor ou profissional institucional SEM unidade', count(*)
FROM profissionais
WHERE perfil_institucional IN ('gestor', 'institucional') AND unidade_id IS NULL AND acesso_revogado = false
UNION ALL
SELECT '4. Conta com unidade mas sem perfil institucional', count(*)
FROM profissionais
WHERE unidade_id IS NOT NULL AND perfil_institucional IS NULL
UNION ALL
SELECT '5. Gestor geral SEM nenhuma rede vinculada', count(*)
FROM gestores_gerais gg
WHERE coalesce(gg.acesso_revogado, false) = false
  AND NOT EXISTS (SELECT 1 FROM gestores_gerais_contratantes c WHERE c.gestor_geral_id = gg.id)
UNION ALL
SELECT '6. Gestor geral vendo unidade de rede à qual NÃO está vinculado', count(*)
FROM gestores_gerais_unidades ggu
JOIN unidades u ON u.id = ggu.unidade_id
WHERE NOT EXISTS (
  SELECT 1 FROM gestores_gerais_contratantes c
  WHERE c.gestor_geral_id = ggu.gestor_geral_id AND c.contratante_id = u.contratante_id
)
UNION ALL
SELECT '7. Gestante em unidade diferente da unidade da profissional dela', count(*)
FROM pacientes p JOIN profissionais pr ON pr.id = p.profissional_id
WHERE p.is_rascunho = false AND p.unidade_id IS NOT NULL
  AND pr.unidade_id IS DISTINCT FROM p.unidade_id
UNION ALL
SELECT '8. Mesma pessoa com dois papéis (admin / gestor geral / profissional)', count(*)
FROM (
  SELECT user_id FROM (
    SELECT user_id FROM admins
    UNION ALL SELECT user_id FROM gestores_gerais
    UNION ALL SELECT user_id FROM profissionais
  ) x
  GROUP BY user_id HAVING count(*) > 1
) duplicados
ORDER BY 1;
