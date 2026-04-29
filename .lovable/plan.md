## Objetivo

Criar 6 contas de teste — uma para cada perfil + 1 consultório Free extra para testar bloqueios — todas com a mesma senha, mais 1 unidade fictícia e dados de exemplo (pacientes, fichas, laudos), para você logar e ver as telas reais de cada perfil.

## Credenciais

Senha única para todas: **Teste@2026**

| E-mail | Perfil | Plano | Redireciona para |
|---|---|---|---|
| consultorio@teste.dramari | Consultório | Profissional (100 laudos) | /dashboard |
| consultorio.free@teste.dramari | Consultório | Free (3 laudos / 3 pacientes) | /dashboard |
| institucional@teste.dramari | Institucional (vinc. unidade) | — | /dashboard |
| gestor@teste.dramari | Gestor da unidade | — | /gestao |
| gestorgeral@teste.dramari | Gestor geral | — | /consolidar |
| admin@teste.dramari | Admin | — | /admin |

## Dados fictícios que serão criados

**1 Unidade**: "Hospital Teste DMG" (São Paulo / SP), ativa, plano ativo.

**Vínculos**:
- institucional@ → vinculado à unidade, perfil_institucional = 'institucional'
- gestor@ → vinculado à unidade, perfil_institucional = 'gestor'
- gestorgeral@ → linha em `gestores_gerais` + vínculo em `gestores_gerais_unidades` com a unidade
- admin@ → linha em `admins`

**3 Pacientes** vinculados à unidade (visíveis para institucional + gestor):
- Paciente A — com Consulta 1 (Ficha A) preenchida e laudo gerado "TEM DMG"
- Paciente B — com Consulta 1 (Ficha B/GTT) e laudo "NÃO TEM DMG"
- Paciente C — rascunho aguardando GJ (status_ficha = 'aguardando_gj')

**1 Paciente** vinculado ao consultorio@ (sem unidade), com 1 laudo gerado, para o consultório Profissional ter algo no dashboard.

Os laudos serão inseridos com `conteudo_laudo` em texto markdown realista (cabeçalho + bloco 1 + 2 + 3) para a tela `/laudo/:id` renderizar corretamente.

## Execução técnica

```text
1. Criar usuários no auth.users via Admin API (service role) — 6 chamadas
2. Inserir linhas em public.profissionais (consultorio×2, institucional, gestor)
   • triggers sync_profissional_role populam user_roles
3. Inserir gestor geral em public.gestores_gerais + vínculo em
   gestores_gerais_unidades
   • trigger sync_gestor_geral_role popula user_roles
4. Inserir admin em public.admins
   • trigger sync_admin_role popula user_roles
5. Inserir 1 unidade + ajustar unidade_id dos institucional/gestor
6. Inserir pacientes, consultas, exames_glicemia, laudos
```

Tudo isso será executado via **edge function única e descartável** `seed-test-accounts` (service role) chamada uma vez. A função:

- É idempotente — checa se cada e-mail já existe e pula
- Confirma e-mail automaticamente (`email_confirm: true`) para pular verificação
- Retorna JSON com a tabela de credenciais ao final
- Inclui guarda: só roda se header `x-seed-secret` bater com um secret novo `SEED_ADMIN_SECRET`

Após o seed funcionar, a edge function fica no projeto mas protegida pelo secret. Você pode pedir para removê-la depois.

## O que você verá após aprovar

1. Mensagem confirmando que as 6 contas foram criadas
2. Tabela com os 6 e-mails e a senha `Teste@2026`
3. Instrução: vá para `/login`, entre com cada conta e o sistema te leva direto para a home do perfil

## O que NÃO está no escopo

- Não vou tocar em nada do código de auth, rotas ou ProtectedRoute (já auditado e correto)
- Não vou criar fluxo de signup público (continua sem autocadastro, conforme regra do projeto)
- Os dados fictícios são mínimos para preencher as telas — não são um seed completo de QA

Posso prosseguir?