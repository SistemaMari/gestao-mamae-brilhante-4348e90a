# Sidebar fixa com botão Sair sempre visível

## Objetivo
Em todas as telas do sistema (todos os perfis), a sidebar lateral deve permanecer fixa na viewport. O conteúdo de navegação rola internamente quando necessário, mas o **botão "Sair"** (rodapé da sidebar) fica sempre ancorado e visível, independente da posição de scroll da página.

## Escopo — apenas frontend/layout
Ajustar as quatro shells de sidebar existentes para usar altura de viewport fixa + nav com overflow interno + rodapé sticky. Nenhuma mudança de lógica, rotas, permissões ou dados.

### Arquivos afetados
1. `src/components/AppShellClinico.tsx` — consultório, institucional, e fallback clínico (gestor/gestor_geral acessando ficha)
2. `src/components/gestor/AppShellGestor.tsx` — gestor de unidade
3. `src/components/gestor-geral/AppShellGestorGeral.tsx` — gestor geral
4. `src/pages/admin/AdminLayout.tsx` + `src/components/admin/AdminSidebar.tsx` — admin

## Padrão de implementação

Para cada shell, a `<aside>`/`<Sidebar>` passa a ter:

```
sticky top-0  h-screen  flex flex-col  overflow-hidden
```

Estrutura interna em três faixas:

```text
┌─────────────────────────┐
│ Header/identidade       │  shrink-0
├─────────────────────────┤
│ Nav (rola se preciso)   │  flex-1 overflow-y-auto
├─────────────────────────┤
│ Rodapé com Sair         │  shrink-0  (sempre visível)
└─────────────────────────┘
```

### Detalhes por shell

**AppShellClinico** — no `SidebarContent`, o `<nav>` recebe `flex-1 overflow-y-auto` e o bloco do logout permanece como bloco `shrink-0` no final. A `<aside>` desktop ganha `sticky top-0 h-[calc(100vh-4rem)]` (descontando o header de 64px) e `overflow-hidden`. O drawer mobile já cobre a tela toda, mas vamos garantir o mesmo padrão (nav rola, Sair fixo no rodapé do drawer).

**AppShellGestor / AppShellGestorGeral / AdminSidebar (shadcn)** — esses usam o componente `Sidebar` do shadcn dentro de `SidebarProvider`. O próprio `Sidebar` já fica fixo; o ajuste é garantir que **dentro** do `SidebarContent`:
- O grupo de navegação use `flex-1 overflow-y-auto min-h-0`
- O bloco do rodapé (`mt-auto` com botão Sair) seja `shrink-0` e fique fora da área scrollável

No `AppShellGestor` hoje o rodapé já usa `mt-auto`, mas o `SidebarContent` é `flex flex-col` sem `overflow-hidden` no contêiner; quando o menu é grande, o rodapé "empurra" e some. Vamos adicionar `h-screen overflow-hidden` no wrapper e `overflow-y-auto min-h-0` no grupo de menu.

`AdminSidebar` hoje **não tem rodapé com Sair** — o Sair vive no `AdminHeader` (dropdown no topo). Não precisa de mudança no rodapé, mas igual aplicamos `overflow-hidden`/`overflow-y-auto` para consistência caso o menu cresça.

## Verificação
- Build limpa.
- Testar visualmente em `/dashboard` (consultório), `/gestao` (gestor), `/consolidar` (gestor geral), `/admin` (admin), e numa ficha longa (`/paciente/:id`) — em todos os casos, scrollar a página principal mantém o botão Sair visível na lateral.
- Conferir que em telas baixas (ex.: 600px de altura) o nav rola internamente e o Sair continua ancorado.
