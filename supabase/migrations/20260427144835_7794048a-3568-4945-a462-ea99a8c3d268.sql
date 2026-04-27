-- Descobrir a constraint atual
ALTER TABLE public.profissionais 
  DROP CONSTRAINT IF EXISTS profissionais_perfil_institucional_check;

ALTER TABLE public.profissionais 
  ADD CONSTRAINT profissionais_perfil_institucional_check 
  CHECK (perfil_institucional IN (
    'consultorio', 
    'institucional', 
    'gestor', 
    'gestor_geral', 
    'admin',
    'sistema'
  ));