

# Corrigir login real e gestão de usuários

## Problema atual

Os dois usuários já existem em `auth.users` (Lovable Cloud → Users), mas **não estão vinculados a nenhum perfil** nas tabelas `admins`, `gestores_gerais` ou `profissionais`. Por isso o login chega até autenticar, mas cai em "Perfil não encontrado". Não existe nenhuma tela hoje para promover um usuário a admin nem para escolher tipo de conta no primeiro acesso.

## O que vai ser feito

### 1. Promover os dois usuários existentes a admin (imediato)

Inserir registros na tabela `admins` para:
- `strategyaisolucoes@gmail.com` (user_id `5a881ae0-1ea6-4365-8a8f-d5e94f613b64`)
- `moadecarvalho@gmail.com` (user_id `6ba34fda-311d-4ca0-9246-b78b00ec7b92`)

Resultado: ambos passam a logar normalmente e cair em `/admin`.

### 2. Tela de onboarding para contas sem perfil

Nova rota `/onboarding` (protegida, só exige login):

- Aparece automaticamente sempre que um usuário autenticado não tem registro em `admins`, `gestores_gerais` nem `profissionais`.
- Apresenta duas opções:
  - **"Sou profissional autônomo (consultório)"** → cria registro em `profissionais` com `unidade_id = null` e redireciona para `/completar-perfil`.
  - **"Vou usar via instituição"** → mostra mensagem explicando que precisa receber um convite do gestor da unidade e oferece botão "Sair".
- O `AuthContext` redireciona automaticamente para `/onboarding` quando `profile === null`, em vez de mostrar a tela bloqueada atual.

### 3. Painel admin: gestão de usuários e promoção

Nova seção em `/admin` chamada **"Gestão de usuários"** com:

- **Lista de todos os profissionais** (nome, e-mail, perfil atual, unidade, data de cadastro).
- **Lista de admins e gestores gerais** atuais.
- Ações por usuário:
  - **Promover a admin** → insere em `admins`.
  - **Promover a gestor geral** → insere em `gestores_gerais`.
  - **Remover privilégio admin/gestor geral** → remove o registro correspondente.
  - **Vincular a uma unidade como gestor** (cria/atualiza `profissionais.unidade_id` + `perfil_institucional='gestor'`).
- **Criar nova unidade** (formulário simples: nome + tipo).

Tudo isso protegido por uma edge function `admin-gerenciar-usuarios` que valida via JWT que o solicitante é admin (usando `is_admin(auth.uid())`).

### 4. Garantir que admins consigam logar mesmo se já tiverem conta

Hoje o `LoginPage` faz polling sequencial (`admins` → `gestores_gerais` → `profissionais`). Isso funciona, mas falha silenciosamente se houver delay no `AuthContext`. Vou simplificar: depois do `signIn` bem-sucedido, redireciona para `/` e deixa o `AuthContext` + roteamento decidir o destino com base no perfil determinado.

## Detalhes técnicos

**Banco (migration + insert):**
- INSERT em `admins` para os dois user_ids existentes (com `nome` extraído do e-mail).
- Adicionar policy `INSERT/DELETE` em `admins` e `gestores_gerais` restrita a `is_admin(auth.uid())` para permitir o painel admin gerenciar.
- Adicionar policy `INSERT/UPDATE` em `unidades` restrita a admins.

**Edge function nova:** `admin-gerenciar-usuarios` (com JWT) — recebe `{ acao, alvo_user_id, payload }` e executa promoção/rebaixamento usando service role após validar que quem chamou é admin.

**Frontend:**
- `src/contexts/AuthContext.tsx`: quando `profile === null` e usuário autenticado, expor flag `needsOnboarding`.
- `src/components/ProtectedRoute.tsx`: redirecionar para `/onboarding` quando `needsOnboarding` (em vez da tela bloqueada).
- `src/pages/OnboardingPage.tsx` (novo): duas opções de tipo de conta.
- `src/pages/AdminPage.tsx`: substituir os três placeholders ("Profissionais recentes", "Unidades cadastradas", "Log do sistema") por uma seção real de gestão de usuários com tabela, busca e botões de ação.
- `src/pages/LoginPage.tsx`: simplificar polling após signIn.
- `src/App.tsx`: registrar `/onboarding`.

## Resultado esperado

1. Você consegue logar **agora** com `strategyaisolucoes@gmail.com` e `moadecarvalho@gmail.com` e cai direto em `/admin`.
2. Quando você criar um terceiro usuário pelo painel do Lovable Cloud (ou ele se cadastrar via convite futuro), ele cai na tela de onboarding e escolhe o tipo de conta — sem ficar travado.
3. A partir de `/admin` você consegue promover qualquer profissional cadastrado a admin ou gestor geral, sem precisar mexer no banco.

