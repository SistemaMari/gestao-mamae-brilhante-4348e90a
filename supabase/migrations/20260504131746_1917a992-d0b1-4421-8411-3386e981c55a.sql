
-- Bucket privado para exportações administrativas (separado de 'relatorios')
INSERT INTO storage.buckets (id, name, public)
VALUES ('exportacoes-admin', 'exportacoes-admin', false)
ON CONFLICT (id) DO NOTHING;

-- Sem políticas para authenticated/anon: acesso só via service_role (Edge Function)
-- e download via signed URL. Garantimos que não existem policies permissivas.
DROP POLICY IF EXISTS "exportacoes-admin authenticated select" ON storage.objects;
DROP POLICY IF EXISTS "exportacoes-admin authenticated insert" ON storage.objects;

-- Agendar cron diário (03:15 UTC) para limpar exportações > 7 dias
SELECT cron.unschedule('limpar-exportacoes-admin-diario')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'limpar-exportacoes-admin-diario'
);

SELECT cron.schedule(
  'limpar-exportacoes-admin-diario',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ywldvotfgbxufcyjdvnq.supabase.co/functions/v1/limpar-exportacoes-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
