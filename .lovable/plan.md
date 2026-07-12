## Objetivo
Transformar o sidebar do perfil **Institucional** (hoje `src/components/AppSidebar.tsx`) para ter a mesma linguagem visual e organização do sidebar do **Admin** (`src/components/admin/AdminSidebar.tsx`).

## Escopo
Mudança restrita ao sidebar quando `profile === 'institucional'`. Outros perfis (consultório, gestor, gestor_geral, admin) permanecem inalterados no `AppSidebar.tsx`.

## Mudanças

### 1. Header
- Substituir o quadradinho "DM + MARI" por a imagem `@/assets/mari-logo.png` ocupando a largura do sidebar (igual Admin).
- No estado colapsado, mostrar apenas o logo 36×36 arredondado.

### 2. Itens de navegação (institucional)
Nova lista, na ordem:
1. Pacientes → `/dashboard`
2. Nova paciente → `/paciente/nova`
3. **[divisor cinza `#E2E8F0`]**
4. Tutorial → `/tutorial` (rota já existente em `TutorialPage.tsx`)

Item **Perfil** sai da lista principal e passa para o rodapé (equivalente ao "Configurações" do Admin).

Estilo dos itens: fundo ativo `#E8E0FF`, texto ativo `#7E69AB`, hover `#F1F5F9`, texto padrão `#64748B` — idêntico ao Admin.

### 3. Rodapé (fundo lilás `#F5F0FF`, borda superior `#E2E8F0`)
Estrutura igual Admin:
- Avatar circular 36×36 com gradiente `linear-gradient(135deg, #7E69AB, #9b87f5)` e iniciais do nome.
- Nome do profissional (Sora, semibold) + email (xs, `#94A3B8`) abaixo.
- Link **Perfil** (ícone `UserCircle` + label) apontando para `/perfil`, com mesmo estilo ativo/hover dos itens do menu.
- Botão **Sair** (variant outline) com ícone `LogOut`.

No estado colapsado: apenas ícone de Perfil (link) e ícone Sair centralizados.

### 4. Nome do profissional
Buscar via Supabase quando `profile === 'institucional'`:
```ts
supabase.from('profissionais').select('nome').eq('user_id', user.id).maybeSingle()
```
Usar hook local com `useEffect` (padrão já usado em `AppShellGestor.tsx`). Fallback: primeira parte do email.

### 5. Estado colapsado
Manter o toggle atual (botão "Recolher"/chevron) já que o `AppSidebar` não usa o `SidebarProvider` do shadcn — está com estado local `useState`. Move-se o chevron para o rodapé, discreto abaixo do botão Sair, como hoje.

## Arquivo alterado
- `src/components/AppSidebar.tsx` — única alteração. Consultório/gestor/gestor_geral/admin continuam renderizando o layout atual (branch por `profile`).

## Fora de escopo
- Não mexer no `AdminSidebar.tsx`, `AppShellGestor.tsx`, rotas, ou permissões.
- Não criar página `/configuracoes` para institucional — Perfil segue apontando para `/perfil`.
