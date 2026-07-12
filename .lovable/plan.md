## Substituir "Dica do dia" por frases sobre DMG

**Arquivo:** `src/pages/DashboardPage.tsx` (array `DICAS`, linhas 223-232)

### Mudanças
1. Substituir as 7 dicas atuais de conduta pelo pool de **15 frases DMG** (afirmativas + educativas) validado acima.
2. Trocar a rotação de `new Date().getDay()` (0-6, presa a dia da semana) para **sorteio determinístico por dia do ano** sobre o pool de 15, de forma que:
   - a frase é estável durante o dia inteiro,
   - muda no dia seguinte,
   - varre todo o pool ao longo do tempo (não fica preso a 7 posições).
3. Opcional (leve): renomear o rótulo interno "Dica do dia" caso queira algo como "MARI lembra" ou "DMG do dia" — **manter "Dica do dia" por padrão** salvo indicação em contrário.

### Detalhe técnico
```ts
const DICAS = [ /* 15 frases DMG aprovadas */ ];
const diaDoAno = Math.floor(
  (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
);
const dicaHoje = DICAS[diaDoAno % DICAS.length];
```

Sem impacto em outros componentes, tokens de design ou i18n (o texto do card já é PT-BR hard-coded hoje).