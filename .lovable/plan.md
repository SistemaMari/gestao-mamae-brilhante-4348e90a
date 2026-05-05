## Voltar a exibir a barra de filtros globais em "Filtros e exportação"

Hoje, em `src/pages/admin/AdminLayout.tsx` (linha 69), a `BarraFiltrosGlobais` está oculta tanto em `/admin/admins` quanto em `/admin/exportar`:

```tsx
{!["/admin/admins", "/admin/exportar"].includes(pathname) && (
  <BarraFiltrosGlobais />
)}
```

### Mudança

Tirar `/admin/exportar` da lista de exclusão (mantendo só `/admin/admins`):

```tsx
{pathname !== "/admin/admins" && <BarraFiltrosGlobais />}
```

### Resultado

- `/admin/exportar` **volta a exibir** a barra de filtros globais (período, país, estado, cidade, tipo de conta, unidade, momento diagnóstico) — exatamente o que você pediu.
- `/admin/admins` continua sem a barra.
- Demais rotas admin permanecem inalteradas.

Sem mudanças em contexto, exportações ou outros componentes.