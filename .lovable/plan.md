## Restaurar vitrine em /vitrine/* (mantendo / privado)

### Confirmação prévia
- Os dois arquivos deletados ainda existem no histórico do Git (commit `0ed9b802...`). Vou recuperá-los na íntegra via `git show <commit>^:<path>`, o que garante restauração byte-a-byte do código original — sem recriar à mão.
- `PreviewHubPage.tsx`: 544 linhas (página de cards + `PreviewCompletarPerfilPage`, `PreviewGestaoEquipePage`, `PreviewCadastroConvitePage`).
- `PreviewAppShell.tsx`: 191 linhas (shell de demo com sidebar e dados fictícios).

### Etapa 1 — Restaurar arquivos deletados

**Recuperar do Git** (conteúdo idêntico ao que existia antes):
- `src/pages/PreviewHubPage.tsx`
- `src/components/PreviewAppShell.tsx`

### Etapa 2 — Atualizar `src/App.tsx`

**Adicionar imports** (logo após os imports de páginas existentes):
```ts
import PreviewHubPage, {
  PreviewCompletarPerfilPage,
  PreviewGestaoEquipePage,
  PreviewCadastroConvitePage,
} from "./pages/PreviewHubPage";
import PreviewAppShell from "./components/PreviewAppShell";
```

**Adicionar rotas** dentro do `<Routes>`, logo abaixo do bloco "Public routes" e antes do bloco do `AppShellClinico`:

```tsx
{/* Vitrine pública (sem login) — acessível por URL direta */}
<Route path="/vitrine" element={<PreviewHubPage />} />
<Route path="/vitrine/completar-perfil" element={<PreviewCompletarPerfilPage />} />
<Route path="/vitrine/gestao" element={<GestaoPage />} />
<Route path="/vitrine/gestao/equipe" element={<PreviewGestaoEquipePage />} />
<Route path="/vitrine/consolidar" element={<ConsolidarPage />} />
<Route path="/vitrine/cadastro-convite" element={<PreviewCadastroConvitePage />} />

{/* Vitrine com App Shell de demonstração */}
<Route element={<PreviewAppShell />}>
  <Route path="/vitrine/dashboard" element={<DashboardPage />} />
  <Route path="/vitrine/paciente/nova" element={<PacientePage />} />
  <Route path="/vitrine/paciente/:id" element={<PacientePage />} />
  <Route path="/vitrine/planos" element={<PlanosPage />} />
  <Route path="/vitrine/perfil" element={<PerfilPage />} />
</Route>
```

### O que NÃO muda

- Rota `/` permanece `<Navigate to="/login" replace />` (raiz continua privada).
- Nenhum redirect `/preview/*` será restaurado.
- Nenhuma rota autenticada (`<ProtectedRoute>`) é tocada.
- `AppShellClinico.tsx` permanece como está, com "Meus Cursos" no menu.
- `MeusCursosPage.tsx` e `/meus-cursos` permanecem intactos.
- `LoginPage`, `RecuperarSenhaPage`, `NovaSenhaPage`, `CadastroConvitePage` (rota real `/convite/:token`) inalterados.
- Sidebars `AdminSidebar`, `AppSidebar` e `AppShellClinico` não são modificadas.
- `previewPatients.ts` permanece no projeto (já estava preservado).

### Resultado esperado

| URL | Comportamento |
|---|---|
| `/` | Redireciona para `/login` (privado) |
| `/login` | Tela de login (real) |
| `/vitrine` | Página de cards da vitrine (pública) |
| `/vitrine/dashboard` | Dashboard de demo dentro do `PreviewAppShell` |
| `/vitrine/paciente/nova`, `/vitrine/planos`, `/vitrine/perfil`, etc. | Telas de demo no shell |
| `/dashboard`, `/meus-cursos`, demais rotas autenticadas | Inalteradas, exigem login |
| `/preview/*` | 404 (não restaurado, conforme pedido) |

### Resumo de arquivos
- **Restaurar do git** (2): `src/pages/PreviewHubPage.tsx`, `src/components/PreviewAppShell.tsx`.
- **Editar** (1): `src/App.tsx` — adicionar 2 imports e ~13 linhas de rotas.
- **Não tocar**: nenhum outro arquivo.

Aguardando aprovação para executar.