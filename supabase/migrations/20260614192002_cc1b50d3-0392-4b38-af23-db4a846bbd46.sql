do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name='profissionais_acesso_revogado_por_fkey'
      and table_schema='public' and table_name='profissionais'
  ) then
    alter table public.profissionais
      add constraint profissionais_acesso_revogado_por_fkey
      foreign key (acesso_revogado_por) references auth.users(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name='gestores_gerais_acesso_revogado_por_fkey'
      and table_schema='public' and table_name='gestores_gerais'
  ) then
    alter table public.gestores_gerais
      add constraint gestores_gerais_acesso_revogado_por_fkey
      foreign key (acesso_revogado_por) references auth.users(id)
      on delete set null;
  end if;
end $$;