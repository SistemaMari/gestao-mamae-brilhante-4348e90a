## Mudanças

### 1. `src/pages/admin/AdminLayout.tsx`
Esconder `BarraFiltrosGlobais` em `/admin/institucionais` (faz parte de cadastro, não de métricas).

```tsx
{!["/admin/admins", "/admin/institucionais"].includes(pathname) && <BarraFiltrosGlobais />}
```

### 2. `src/components/admin/institucional/AbaUnidades.tsx`
Adicionar input de busca por **nome da unidade** (hospital):
- Novo state `busca`.
- Input com ícone `Search` (mesmo padrão da AbaGestoresUnidade), largura ~260px, placeholder "Buscar por nome da unidade…".
- Filtro no `useMemo`: `u.nome.toLowerCase().includes(q)`.
- Posicionar ao lado dos selects existentes.

### 3. `src/components/admin/institucional/AbaGestoresGerais.tsx`
Adicionar input de busca por **nome do gestor**:
- Novo state `busca`.
- Header passa a ter input à esquerda + contagem + botão "Cadastrar gestor geral" à direita.
- Filtro: `g.nome.toLowerCase().includes(q)`.

## Não muda
- BarraFiltrosGlobais permanece nas demais páginas (Visão Geral, Diagnósticos, Exportar) intacta.
- Nenhuma migration / Edge Function.
- Demais abas (Contratantes, Profissionais, Gestores Unidade) não tocadas.

## Entregáveis pós-implementação
- Resumo dos 3 arquivos alterados.
- Print da aba Unidades com novo campo de busca.
- Print da aba Gestores Gerais com novo campo de busca.
- Confirmação de que barra global não aparece mais em `/admin/institucionais`.