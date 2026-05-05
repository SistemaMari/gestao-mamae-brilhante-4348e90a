## Objetivo

Criar uma rota de vitrine `/vitrine/ficha-carimbada` que mostra uma ficha de paciente fictícia com o componente `CarimboAtendimento` em suas três variantes (banner, inline, lista), para visualizar o design sem precisar de login institucional.

## Arquivos

**Editar:**
- `src/components/clinico/CarimboAtendimento.tsx` — adicionar props opcionais de mock:
  - `mockProfissional` na variante `banner` (pula `useAuth` + query no Supabase).
  - `registros` na variante `lista` (pula `useQuery` se vier preenchido).
  - Sem quebrar uso atual: se props não vierem, comportamento permanece idêntico.
- `src/App.tsx` — adicionar `<Route path="/vitrine/ficha-carimbada" element={<FichaCarimbadaDemo />} />`.
- `src/pages/PreviewHubPage.tsx` — adicionar card "Ficha carimbada (demo)" no array `previewCards`.

**Criar:**
- `src/pages/_dev/FichaCarimbadaDemo.tsx` — página com dados mockados inline.

## Conteúdo da página demo

```
┌────────────────────────────────────────────┐
│ ← Voltar para a vitrine                    │
│                                            │
│ Maria Aparecida da Silva   |  32a · 28+3s │
│ UBS Vila Esperança · Cartão SUS 700...    │
├────────────────────────────────────────────┤
│ [BANNER verde-água]                        │
│ Atendendo como: Dra. Carolina Mendes      │
│ — CRM 123456 | UBS Vila Esperança         │
├────────────────────────────────────────────┤
│ Operações recentes                         │
│  • Laudo gerado     — Dra. Carolina ...   │
│  • Ficha B/D        — Dr. Rafael Tavares  │
│  • GTT              — Enf. Ana Paula ...  │
│  • Consulta inicial — Dr. Rafael Tavares  │
├────────────────────────────────────────────┤
│ Histórico de atendimentos (variante lista) │
│  8 registros mockados em ordem cronológica │
└────────────────────────────────────────────┘
```

6 a 8 carimbos fictícios cobrindo os 11 tipos de operação (`abrir_ficha`, `consulta_inicial`, `retorno`, `ficha_ac`, `ficha_bd`, `gtt`, `gerar_laudo`, etc.) com 3 profissionais diferentes para mostrar mudança de atendente.

## Identidade visual

Reuso 100% do design atual do `CarimboAtendimento`:
- Banner: borda `#99F6E4`, fundo `#F0FDFA`, texto `#0F766E`.
- Lista: título Sora `#5B3A8E`, divisores neutros, fundo branco.
- Cabeçalho da paciente segue padrão do `FichaPacientePage` real (Sora bold, sem cores novas).

## Fora do escopo

- Não cria registros no banco.
- Não toca em formulários clínicos reais.
- Não modifica `FichaPacientePage` real.
- Botões de ação ("Editar", "Gerar laudo") aparecem desabilitados com tooltip "demo".