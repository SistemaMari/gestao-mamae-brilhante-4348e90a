## Objetivo

Habilitar edição de perfil para o usuário **Institucional**, reaproveitando o máximo possível da tela do Consultório, com escopo ajustado à natureza corporativa do perfil.

## Escopo funcional

**Habilitado (igual ao consultório):**
- Foto de perfil (upload + remover, com confirmação)
- Nome completo
- Telefone/WhatsApp
- Data de aniversário (dispara saudação no dashboard institucional)
- Alterar senha (exige senha atual)
- Dados profissionais: Especialidade, Conselho, Número, UF
- Enviar depoimento público (mesmo fluxo de moderação do admin)
- Enviar feedback (com anexo opcional)

**Diferente do consultório:**
- **E-mail**: read-only + botão "Solicitar alteração" (idem consultório hoje).
- **Vínculo institucional**: novo card read-only exibindo o nome da **Unidade** vinculada (buscado via `profissionais.unidade_id → unidades.nome`). Sem edição.
- **Excluir conta**: NÃO exibir. Apenas o Gestor desliga via "Gestão de Equipe".
- **Plano/cota**: não exibir (não se aplica ao institucional).
- **Feedback com cópia ao Gestor**: quando o admin responder o feedback por e-mail (Gmail Compose), o **e-mail do Gestor da unidade** entra automaticamente no campo **Cc**. Assim o profissional pode reportar problemas sem esconder do gestor, mas o gestor fica ciente da resposta.

## Estrutura de código

**Nova rota**: `/institucional/perfil` (dentro do `AppShellInstitucional`), reutilizando a estrutura visual do `PerfilPage.tsx` do consultório.

**Refactor**: extrair de `src/pages/PerfilPage.tsx` os cards reutilizáveis em componentes:
- `PerfilCardFoto`
- `PerfilCardDadosPessoais`
- `PerfilCardDadosProfissionais`
- `PerfilCardSenha`
- `PerfilCardFeedback`
- `PerfilCardDepoimento`
- **Novo**: `PerfilCardVinculoInstitucional` (só na versão institucional)

Cada card recebe props para controlar visibilidade (ex.: `mostrarExcluirConta`, `mostrarPlano`) — evita duplicação.

**Novo arquivo**: `src/pages/institucional/PerfilInstitucionalPage.tsx` compõe os cards com as flags corretas.

**Navegação**: adicionar item "Meu perfil" no rodapé da sidebar institucional (padrão já usado no consultório), abaixo dos itens principais.

## Backend

**Migration**: nenhuma nova tabela. Reaproveita `profissionais`, `feedbacks_usuario`, `depoimentos_usuario`, `avatares-profissionais` (bucket).

**Ajuste no FeedbacksAdminPage**: quando o autor do feedback for `tipo_perfil = 'institucional'`, a função `admin_get_contatos_usuarios` (já existente) passa a retornar também o `email_gestor_unidade`. O helper `responderPorEmail` inclui esse e-mail no parâmetro `cc=` do Gmail Compose. Se não houver gestor definido, envia sem Cc e mostra um aviso discreto.

**RPC a ajustar** (via migration): expandir `admin_get_contatos_usuarios` para retornar `email_gestor_unidade` (nullable) — busca o profissional com `tipo_perfil='gestor'` na mesma `unidade_id`. Sem mudança de schema, só a função.

## Detalhes técnicos

- Aniversário: reaproveita a lógica de saudação especial já implementada no `DashboardPage` — precisa ser replicada no dashboard institucional (verificar se já existe; se não, extrair para hook `useSaudacaoAniversario`).
- Bucket `avatares-profissionais`: já tem policy para admin ler; usuário institucional já tem upload próprio via `user_id` — nenhuma mudança de RLS.
- Depoimento: sem alteração (mesma tabela, mesmo fluxo pendente → aprovação admin).
- Feedback: sem alteração de tabela; apenas UI do admin ganha Cc automático.

## Fora de escopo (não fazer agora)

- Edição de `unidade_id` pelo próprio institucional.
- Notificar o gestor toda vez que o institucional abre feedback (só quando admin responde).
- Auto-exclusão de conta.
- Trocar e-mail sem intervenção do admin.

## Ordem de execução

1. Migration: expandir `admin_get_contatos_usuarios` para retornar `email_gestor_unidade`.
2. Refactor `PerfilPage` do consultório em cards reutilizáveis (sem mudança visual/comportamental para o consultório).
3. Criar `PerfilCardVinculoInstitucional`.
4. Criar `PerfilInstitucionalPage` compondo os cards com flags.
5. Rota + item de sidebar no `AppShellInstitucional`.
6. Ajustar `FeedbacksAdminPage.responderPorEmail` para incluir Cc do gestor quando autor for institucional.
7. Verificar saudação de aniversário no dashboard institucional; adicionar se ausente.