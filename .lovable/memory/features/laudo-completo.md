---
name: Laudo Completo
description: Design system do laudo (Prompt 15) — wrapper LaudoCompleto, 8 elementos, contrato de props, estados IA e print
type: feature
---

## Estrutura (8 elementos)
1. **Cabeçalho** (`LaudoCabecalho`) — fundo branco, borda inferior `#D6BCFA`. Título "Laudo Dra. Mari DMG Diagnóstica", paciente, IG, data, badge cenário.
2. **Bloco 1** (children) — cards clínicos atuais (Consulta1ResultCard, Retorno1ResultCard, FichaACResultCard, FichaBDResultCard, GttResultCard, EncerramentoPartoCard, RegistroPartoReadOnlyCard).
3. **Grade glicêmica compacta** (`GradeGlicemicaCompacta`) — readonly 4 ou 6 pontos × N dias, células `#DCFCE7`/`#FEE2E2`, `—` vazias, % no rodapé.
4. **Bloco 2 — Justificativa** (`Bloco2Justificativa`) — card lavanda `#F1F0FB` / borda `#D6BCFA`, título DM Serif `#7E69AB`. Markdown via `react-markdown` + `remark-gfm`.
5. **Bloco 3 — Conduta** (`Bloco3Conduta`) — card menta `#D1FAE5` / borda `#5EEAD4`, título `#0D7364`. Markdown com mesma lib.
6. **Próxima ficha** (`ProximaFichaCard`) — card lilás `#E8E0FF`. Não renderiza nos cenários 5, 7 e negativo.
7. **Notas técnicas** (`NotasTecnicasCard`) — card `#F1F5F9`, 4 notas padrão.
8. **Instrução Ctrl+P** (`InstrucaoCtrlP`) — texto `#94A3B8` + ícone Printer. Classe `no-print`.

## Contrato (`LaudoCompletoProps`)
```ts
type StatusIA = 'pendente' | 'gerando' | 'pronto' | 'erro';
type Cenario = 1 | 2 | 3 | 4 | 5 | 6 | '6B' | 7 | 8 | 'negativo';

interface LaudoCompletoProps {
  paciente: { nome: string };
  igSemanas: number; igDias: number;
  dataLaudo: Date;
  cenario: Cenario;
  children: ReactNode;          // Bloco 1
  bloco2: string | null;        // markdown
  bloco3: string | null;        // markdown
  statusIA: StatusIA;
  erroIA?: { codigo?: number; mensagem: string } | null;
  gradeGlicemica?: GradeGlicemicaProps | null;
  proximaFichaTexto?: string | null;
  notasTecnicas?: string[];
  onTentarNovamente?: () => void;
}
```

## Estados IA (Blocos 2 e 3)
- `pendente`: pulse + "será gerada em breve."
- `gerando`: 3 linhas shimmer (variante lavanda ou menta) + "Gerando…".
- `pronto`: ReactMarkdown + remarkGfm.
- `erro`: card `#FEE2E2`/borda `#FCA5A5`. `codigo === 403` → "Limite atingido" + botão "Ver planos" → `/planos`. Senão → "Tentar novamente".

## Print (`src/styles/print.css`)
- `.no-print` oculto; `.print-only` exibido.
- `@page { margin: 15mm }`. Cards com `page-break-inside: avoid` e `-webkit-print-color-adjust: exact`.
- Rodapé legal `print-only`: "Gerado por Dra. Mari DMG Diagnóstica — [data] — Este documento não substitui a avaliação médica.".
- Múltiplos laudos: `page-break-before: always` entre `.laudo-completo`.

## Mapeamento de cenário (`src/lib/laudoMapping.ts`)
- `mapearCenario(consulta)` → 1..8 ou 'negativo'.
- `semProximaFicha(cenario)` → true para 5, 7, 'negativo'.

## Decisão de refator
LaudoCompleto **envolve** os cards de Bloco 1 atuais (não substitui). Cards antigos permanecem.
