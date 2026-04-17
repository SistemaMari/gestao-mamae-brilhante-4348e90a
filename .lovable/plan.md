

## Plano: Prompt 15 — Design System do Laudo (`LaudoCompleto`)

### Decisões aprovadas
- **Refator**: criar `LaudoCompleto` que **envolve** os cards de Bloco 1 atuais (não os apaga).
- **Markdown**: instalar `react-markdown` + `remark-gfm` agora.
- **Cards antigos**: mantidos.

### Arquivos novos
- `src/components/laudo/LaudoCompleto.tsx` — orquestrador.
- `src/components/laudo/LaudoCabecalho.tsx` — "Laudo Dra. Mari DMG Diagnóstica", data, paciente, IG, badge cenário (fundo branco, borda inferior `#D6BCFA`).
- `src/components/laudo/Bloco2Justificativa.tsx` — card lavanda `#F1F0FB` / borda `#D6BCFA`, título DM Serif Display `#7E69AB`. 4 estados.
- `src/components/laudo/Bloco3Conduta.tsx` — card menta `#D1FAE5` / borda `#5EEAD4`, título `#0D7364`. 4 estados.
- `src/components/laudo/GradeGlicemicaCompacta.tsx` — readonly, 4 ou 6 pontos × N dias, células coloridas, `—` para vazias, linha de percentual.
- `src/components/laudo/ProximaFichaCard.tsx` — card lilás `#E8E0FF`. Cenários 5/7/GTT-neg não renderizam.
- `src/components/laudo/NotasTecnicasCard.tsx` — card cinza `#F1F5F9` com as 4 notas obrigatórias.
- `src/components/laudo/InstrucaoCtrlP.tsx` — texto `#94A3B8` + ícone Printer.
- `src/components/laudo/SkeletonShimmer.tsx` — 3 linhas shimmer (variante lavanda ou menta).
- `src/components/laudo/markdownComponents.tsx` — mapeamento `react-markdown` → JSX por variante (`lilas` | `menta`).
- `src/lib/laudoMapping.ts` — `mapearCenario(consulta)` e `extrairGrade(consulta)`.
- `src/styles/print.css` — `@media print`, `.no-print`, `.print-only`, `page-break-inside: avoid`, `-webkit-print-color-adjust: exact`, margens 15mm, rodapé legal.

### Arquivos alterados
- `src/main.tsx` — importar `print.css`.
- `src/index.css` — keyframes `shimmer`.
- `src/pages/FichaPacientePage.tsx` — envolver cada bloco "resultado de consulta" do histórico (e o card standalone) com `<LaudoCompleto …>{cardAtual}</LaudoCompleto>`. Aplicar `className="no-print"` em sidebar / topbar / botões de ação.

### Dependência
- `npm i react-markdown remark-gfm`.

### Contrato (`LaudoCompleto`)
```ts
type StatusIA = 'pendente' | 'gerando' | 'pronto' | 'erro';
type Cenario = 1 | 2 | 3 | 4 | 5 | 6 | '6B' | 7 | 8 | 'negativo';

interface Props {
  paciente: { nome: string };
  igSemanas: number; igDias: number;
  dataLaudo: Date;
  cenario: Cenario;
  bloco2: string | null;
  bloco3: string | null;
  statusIA: StatusIA;
  erroIA?: { codigo?: number; mensagem: string } | null;
  notasTecnicas?: string[]; // default = 4 notas padrão
  gradeGlicemica?: { pontos: 4|6; diasPreenchidos: number; valores: …; percentual: number } | null;
  proximaFichaTexto?: string | null;
  onTentarNovamente?: () => void;
  children: React.ReactNode; // Bloco 1 = card atual
}
```

### Estados visuais (Blocos 2/3)
- `pendente`: pulso + texto "será gerada em breve."
- `gerando`: 3 shimmer lines + "Gerando…".
- `pronto`: react-markdown com mapeamento da variante.
- `erro`: card `#FEE2E2`/borda `#FCA5A5`. Se `codigo === 403`: "Limite de laudos atingido" + botão "Ver planos" → `/planos`. Caso contrário: "Tentar novamente".

### Print
- `.no-print { display: none !important; }` em sidebar, topbar, botões `+ Nova consulta` / `Registrar parto`, instrução Ctrl+P.
- `@page { margin: 15mm; }`; cards com `page-break-inside: avoid` e `-webkit-print-color-adjust: exact`.
- Rodapé legal `print-only`: "Gerado por Dra. Mari DMG Diagnóstica — [data] — Este documento não substitui a avaliação médica.".
- Comportamento por status conforme tabela 3.8 do prompt.

### Mapeamento de cenário (em `FichaPacientePage`)
- `consulta_1` → 1 ou negativo.
- `retorno_1` → 1, 6, 6B, 8 ou negativo.
- `ficha_a`/`ficha_c` → 2 (≥70%) ou 3 (<70%), grade 4 pontos.
- `ficha_b`/`ficha_d` → 4 (≥70%) ou 7 (<70%), grade 6 pontos.
- `retorno_gtt` → 6, 6B ou negativo.
- `registro_parto`/`resultado_parto` → cenário 5 (encerramento, sem próxima ficha).

### Critérios de aceite
1–18 cobertos. Item 17 ("substituir cards") vira "envolver cards" por decisão do usuário — comportamento clínico permanece idêntico.

### Fora de escopo
- Conteúdo real dos Blocos 2/3 (Prompt 16).
- Edge Function `gerar-laudo` (Prompt 16).
- Logotipo no cabeçalho.
- Lógica diagnóstica.

### Memória
Criar `mem://features/laudo-completo` com a estrutura dos 8 elementos e o contrato de props.

