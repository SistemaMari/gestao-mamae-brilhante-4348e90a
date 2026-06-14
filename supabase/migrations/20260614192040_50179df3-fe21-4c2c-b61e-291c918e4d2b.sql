alter table public.profissionais
  drop constraint if exists profissionais_acesso_revogado_por_fkey;

alter table public.profissionais
  add constraint profissionais_acesso_revogado_por_fkey
  foreign key (acesso_revogado_por) references auth.users(id)
  on delete set null;