# Reset + Reconstrução do /admin (Prompt 22 com correções visuais)

Substituir todo o código atual de `/admin` pelo shell especificado no Prompt 22, aplicando as 2 correções de identidade visual e respeitando o Prompt Raiz.

---

## Parte A — Deleções (limpeza do código fora do spec)

### A.1 Páginas removidas
- `src/pages/AdminPage.tsx`
- `src/pages/AdminAdminsPage.tsx`
- `src/pages/AdminUnidadesPage.tsx`

### A.2 Edge Function removida
- `supabase/functions/admin-gerenciar-usuarios/` (do disco)
- `admin-gerenciar-usuarios` (do projeto deployado, via `supabase--delete_edge_functions`)

### A.3 Não tocar
- Tabelas (`admins`, `profissionais`, `unidades`, `pacientes`, `laudos`, `gestores_gerais`, `convites`, etc.) — sem migrations.
- `/dashboard`, `/gestao`, `/consolidar`, `/login` e seus arquivos.
- Demais Edge Functions.
- `GestaoPage.tsx`, `GestaoEquipePage.tsx`, `src/components/gestao/*`.

---

## Parte B — Reconstrução do /admin conforme Prompt 22

### B.1 Estrutura de arquivos novos

```
src/pages/admin/
  AdminLayout.tsx              ← shell: guarda + sidebar + header + <Outlet/>
  VisaoGeralPage.tsx           ← /admin (cards de resumo + placeholder)
  DiagnosticosPage.tsx         ← /admin/diagnosticos (placeholder)
  ExportarPage.tsx             ← /admin/exportar (placeholder)
  AdminsPage.tsx               ← /admin/admins (placeholder)
  InstitucionaisPage.tsx       ← /admin/institucionais (placeholder)

src/components/admin/
  AdminSidebar.tsx             ← sidebar lateral (shadcn Sidebar)
  AdminHeader.tsx              ← logo + título + saudação + logout
  PlaceholderSecao.tsx         ← card centralizado "em construção"
  CardResumo.tsx               ← card de número grande + label
```

### B.2 Rotas em `src/App.tsx`

Remover (deleção):
- `import AdminPage from "./pages/AdminPage"` (linha 16)
- `import AdminUnidadesPage from "./pages/AdminUnidadesPage"` (linha 17)
- `import AdminAdminsPage from "./pages/AdminAdminsPage"` (linha 18)
- Rotas `/vitrine/admin`, `/vitrine/admin/base-conhecimento`, `/preview/admin`
- Rotas planas `/admin`, `/admin/base-conhecimento`, `/admin/unidades`, `/admin/admins` (linhas 124-127)

Adicionar (estrutura aninhada):
```tsx
<Route element={<ProtectedRoute allowedProfiles={['admin']}><AdminLayout /></ProtectedRoute>}>
  <Route path="/admin" element={<VisaoGeralPage />} />
  <Route path="/admin/diagnosticos" element={<DiagnosticosPage />} />
  <Route path="/admin/exportar" element={<ExportarPage />} />
  <Route path="/admin/admins" element={<AdminsPage />} />
  <Route path="/admin/institucionais" element={<InstitucionaisPage />} />
</Route>
```

### B.3 Verificação de acesso (Prompt 22 §3.1, §3.2 e critério #12)

Dois níveis, ambos ativos em toda navegação `/admin/*`:

1. `ProtectedRoute allowedProfiles={['admin']}` — já existente, valida perfil via sessão.
2. Dentro de `AdminLayout`, hook `useAdminGuard()` que a cada montagem/route-change:
   - Lê `auth.uid()` da sessão Supabase.
   - `supabase.from('admins').select('id, nome').eq('id', uid).maybeSingle()`.
   - Se não encontrou → `navigate('/login', { replace: true })` silencioso (sem toast).
   - Se encontrou → guarda `nome` em estado para o header.

A query roda em toda mudança de pathname `/admin/*` (não só no mount inicial).

### B.4 AdminLayout (shell)

Layout flex: sidebar fixa à esquerda + área de conteúdo à direita com `<AdminHeader />` no topo e `<Outlet />` abaixo. Usa `SidebarProvider` do shadcn. Sidebar `collapsible="icon"` com `SidebarTrigger` no header (responsivo tablet → hamburguer).

### B.5 AdminHeader (Prompt 22 §3.3)

- Logo placeholder Dra. Mari (canto superior esquerdo do header).
- Título: "Painel Administrativo — Dra. Mari DMG Diagnóstica" (fonte Sora).
- Saudação: "Olá, {nome}" puxado de `admins.nome`.
- Botão de logout à direita: `supabase.auth.signOut()` → redirect `/login`.
- `SidebarTrigger` à esquerda (visível sempre, conforme guideline shadcn).

### B.6 AdminSidebar (Prompt 22 §3.4 + CORREÇÃO 1)

5 itens com ícones Lucide:
1. Visão Geral → `/admin` → `BarChart3`
2. Diagnósticos → `/admin/diagnosticos` → `Map`
3. Filtros e Exportação → `/admin/exportar` → `Download`
4. Administradores → `/admin/admins` → `Users`
5. Contas Institucionais → `/admin/institucionais` → `Building2`

Item ativo via `NavLink` + `useLocation` (pathname exato).

**Estilo (CORREÇÃO 1 — sobrepõe Prompt 22 §3.7):**
- Fundo da sidebar: `#FFFFFF`
- Borda direita: `1px solid #E2E8F0`
- Largura: ~250px
- Item inativo: texto `#64748B`
- Item ativo: fundo `#E8E0FF`, texto `#7E69AB` (mantido do Prompt 22 §3.4)
- Hover item: fundo `#F1F5F9`

### B.7 VisaoGeralPage (Prompt 22 §3.6 + CORREÇÃO 2)

4 cards no topo em grid responsivo (4 colunas desktop / 2 tablet):

| Card | Query |
|---|---|
| Total de profissionais | `supabase.from('profissionais').select('*', { count: 'exact', head: true })` |
| Total de unidades | `supabase.from('unidades').select('*', { count: 'exact', head: true })` |
| Total de pacientes | `supabase.from('pacientes').select('*', { count: 'exact', head: true })` |
| Total de laudos gerados | `supabase.from('laudos').select('*', { count: 'exact', head: true })` |

> **Nota técnica:** Prompt 22 cita `laudos_historico`; a tabela real no banco é `laudos`. Usar `laudos`. Sem alteração de schema.

**Estilo card de resumo (CORREÇÃO 2 — sobrepõe Prompt 22 §3.7):**
- Fundo `#FFFFFF`, borda `#E2E8F0`, sombra sutil, radius 12px.
- Número grande: 32px, bold, **`#1E293B`** (em vez de `#2D2B55`).
- Label: 14px, `#64748B`, fonte Plus Jakarta Sans.

Abaixo dos cards: card placeholder grande "Métricas gerais — em breve" usando `PlaceholderSecao`.

### B.8 PlaceholderSecao (Prompt 22 §3.5)

Card centralizado na área de conteúdo:
- Fundo `#F8FAFC`, borda `#E2E8F0`, radius 12px, padding generoso.
- Ícone `Construction` do Lucide, cor `#9b87f5`.
- Título da seção (Sora, 20px, `#1E293B`).
- Texto: "Esta seção será construída em breve." (`#64748B`).

Páginas que usam: `DiagnosticosPage`, `ExportarPage`, `AdminsPage`, `InstitucionaisPage`. Cada uma passa o título e mensagem específicos do Prompt 22 §3.4.

### B.9 Identidade visual aplicada (Prompt Raiz §4.1)

- Fundo da área de conteúdo: `#F8FAFC`.
- Tipografia: títulos Sora, corpo Plus Jakarta Sans (já configuradas no projeto).
- Sem azul royal, coral, laranja de marca. Sem rosa protagonista.
- Branco domina.
- Layout desktop-first; em tablet a sidebar colapsa em hamburguer (shadcn `collapsible="icon"` + trigger no header).
- Sem otimização para celular (Prompt 22 §3.7).

---

## Parte C — Fora de escopo (Prompt 22 §4)

Não construir agora:
- Métricas detalhadas (Prompts 23-25).
- Gerenciamento real de admins (Prompt 26).
- Gerenciamento de unidades/gestores gerais (Prompt 27).
- Qualquer Edge Function nova. As 4 contas/queries do §3.6 usam o cliente Supabase direto do frontend com RLS atual (admins têm SELECT em tudo, conforme Prompt 22 §BLOCO 1).

---

## Critérios de aceite (Prompt 22 §BLOCO 5)

1. Admin loga e cai em `/admin` com shell carregado.
2. Não-admin que tenta `/admin*` é redirecionado para `/login` silenciosamente.
3. Header mostra "Olá, {nome}" e logout funciona.
4. Sidebar tem os 5 itens visíveis e clicáveis.
5. Item ativo destacado (fundo `#E8E0FF`, texto `#7E69AB`).
6. Cada item carrega seu placeholder na área de conteúdo.
7. Rotas `/admin/diagnosticos`, `/admin/exportar`, `/admin/admins`, `/admin/institucionais` existem.
8. 4 cards de resumo na Visão Geral exibem contagens reais.
9. Sidebar colapsa em hamburguer no tablet.
10. Layout desktop-first.
11. Cores e tipografia seguem o Prompt Raiz, **com as 2 correções**:
    - Sidebar branca (`#FFFFFF`) com borda `#E2E8F0` e texto inativo `#64748B`.
    - Número grande dos cards em `#1E293B`.
12. Verificação de admin roda em toda mudança de rota dentro de `/admin/*`.
